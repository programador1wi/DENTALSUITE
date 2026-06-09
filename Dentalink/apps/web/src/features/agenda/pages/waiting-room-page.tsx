import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { ChairFilter, BranchFilter, ProfessionalFilter } from "../components/filters";
import { WaitingRoomPanel } from "../components/waiting-room-panel";
import { useAppointmentActions, useAppointments } from "../hooks/use-appointments";
import { useChairs } from "@/features/settings/chairs/hooks/use-chairs";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { useBranchStore } from "@/stores/branch.store";

export function WaitingRoomPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [professionalId, setProfessionalId] = useState("");
  const [chairId, setChairId] = useState("");
  const { activeBranchId, setActiveBranchId } = useBranchStore();
  const branchId = activeBranchId;
  const branches = useBranches(undefined, "ACTIVE");
  const professionals = useProfessionals(undefined, "true", { branchId: branchId || undefined, pageSize: 100 });
  const chairs = useChairs(undefined, "true");
  const appointments = useAppointments({ date, view: "day", branchId: branchId || undefined, professionalId: professionalId || undefined, chairId: chairId || undefined });
  const actions = useAppointmentActions();
  const visibleProfessionals = professionals.data ?? [];
  const visibleChairs = useMemo(
    () => (chairs.data ?? []).filter((chair) => !branchId || chair.branchId === branchId),
    [branchId, chairs.data]
  );

  useEffect(() => {
    if (!professionalId || visibleProfessionals.some((professional) => professional.id === professionalId)) return;
    setProfessionalId("");
  }, [professionalId, visibleProfessionals]);

  useEffect(() => {
    if (!chairId || visibleChairs.some((chair) => chair.id === chairId)) return;
    setChairId("");
  }, [chairId, visibleChairs]);

  if (appointments.isLoading) return <LoadingState message="Cargando sala de espera..." />;
  if (appointments.isError) return <ErrorState message={appointments.error.message} />;

  const waiting = (appointments.data ?? []).filter((appointment) => ["ARRIVED", "WAITING_ROOM", "IN_PROGRESS"].includes(appointment.status));

  return (
    <div className="space-y-4">
      <PageHeader 
        title="Sala de espera" 
        description="Control operativo de llegada y atención." 
        helpText="La Sala de Espera permite realizar el seguimiento operativo en tiempo real de los pacientes desde que ingresan a la clínica, controlando su flujo de atención: ingreso en recepción, tiempos transcurridos en sala de espera y el paso a la atención con el odontólogo."
      />
      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          <Link to="/agenda/day"><Button variant="secondary">Agenda</Button></Link>
          <Link to="/agenda/waiting-room"><Button>Sala de espera</Button></Link>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <div className="flex items-center gap-1.5 w-full">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="flex-1" />
            <HelpTooltip content="Filtra el flujo de sala de espera para una fecha específica. Por defecto muestra el día de hoy." />
          </div>
          <div className="flex items-center gap-1.5 w-full">
            <BranchFilter value={branchId} branches={branches.data ?? []} onChange={setActiveBranchId} />
            <HelpTooltip content="Muestra los pacientes citados en la sucursal seleccionada. Las recepcionistas y clínicos solo verán las sucursales a las que tienen acceso asignado." />
          </div>
          <div className="flex items-center gap-1.5 w-full">
            <ProfessionalFilter value={professionalId} professionals={visibleProfessionals} onChange={setProfessionalId} />
            <HelpTooltip content="Filtra a los pacientes en espera según el odontólogo asignado para su atención en el día." />
          </div>
          <div className="flex items-center gap-1.5 w-full">
            <ChairFilter value={chairId} chairs={visibleChairs} onChange={setChairId} />
            <HelpTooltip content="Muestra los pacientes citados y distribuidos según el sillón clínico asignado, ideal para optimizar el espacio físico." />
          </div>
        </div>
      </Card>
      <WaitingRoomPanel
        appointments={waiting}
        onWaitingRoom={(id) => void actions.waitingRoom.mutate(id)}
        onStart={(id) => void actions.start.mutate(id)}
        onComplete={(id) => void actions.complete.mutate(id)}
        onNoShow={(id) => void actions.noShow.mutate(id)}
      />
    </div>
  );
}
