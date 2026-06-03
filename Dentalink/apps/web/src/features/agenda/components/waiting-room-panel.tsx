import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import type { Appointment } from "../services/appointments.service";
import { AppointmentCard } from "./appointment-card";

export function WaitingRoomPanel({
  appointments,
  onWaitingRoom,
  onStart,
  onComplete,
  onNoShow
}: {
  appointments: Appointment[];
  onWaitingRoom: (id: string) => void;
  onStart: (id: string) => void;
  onComplete: (id: string) => void;
  onNoShow: (id: string) => void;
}) {
  return (
    <Card>
      <h3 className="mb-3 text-base font-semibold text-slate-900">Sala de espera</h3>
      {!appointments.length ? (
        <EmptyState title="Sin pacientes en espera" description="No hay citas marcadas como llegada, sala o atención." />
      ) : (
        <div className="grid gap-3">
          {appointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              onEdit={() => undefined}
              onWaitingRoom={onWaitingRoom}
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
