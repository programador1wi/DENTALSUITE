import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function FutureAppointmentsModal({
  pending,
  onClose,
  onConfirm,
  saving
}: {
  pending: { futureAppointmentsCount: number } | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  saving: boolean;
}) {
  return (
    <Modal open={Boolean(pending)} title="Mover citas futuras" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
          <CalendarClock className="mt-0.5 h-5 w-5 flex-none" />
          <div>
            <p className="font-semibold">
              Este plan tiene {pending?.futureAppointmentsCount ?? 0} citas futuras.
            </p>
            <p className="mt-1">
              Puedes moverlas a la nueva sucursal y doctor, o dejarlas como estaban en la agenda.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            No mover citas
          </Button>
          <Button disabled={saving} onClick={() => void onConfirm()}>
            Mover citas futuras
          </Button>
        </div>
      </div>
    </Modal>
  );
}
