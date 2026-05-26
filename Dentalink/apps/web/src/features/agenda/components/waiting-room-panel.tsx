import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import type { Appointment } from "../services/appointments.service";
import { AppointmentCard } from "./appointment-card";

export function WaitingRoomPanel({
  appointments,
  onStart,
  onComplete,
  onNoShow
}: {
  appointments: Appointment[];
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onNoShow: (id: string) => void;
}) {
  return (
    <Card>
      <h3 className="mb-3 text-base font-semibold text-slate-900">Sala de espera</h3>
      {!appointments.length ? (
        <EmptyState title="Sin pacientes en espera" description="No hay citas marcadas como llegada, sala o atencion." />
      ) : (
        <div className="grid gap-3">
          {appointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onEdit={() => undefined}
              onCancel={() => undefined}
              onReschedule={() => undefined}
              onConfirm={() => undefined}
              onArrive={() => undefined}
              onWaitingRoom={() => undefined}
              onStart={onStart}
              onComplete={onComplete}
              onNoShow={onNoShow}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
