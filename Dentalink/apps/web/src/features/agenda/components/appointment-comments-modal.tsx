import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAppointmentNotes, useAddAppointmentNote } from "@/features/agenda/hooks/use-appointments";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";

export function AppointmentCommentsModal({
  appointmentId,
  open,
  onClose
}: {
  appointmentId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [newNote, setNewNote] = useState("");
  const notesQuery = useAppointmentNotes(appointmentId ?? "", Boolean(appointmentId) && open);
  const addNoteMutation = useAddAppointmentNote();

  const handleSave = async () => {
    if (!appointmentId || !newNote.trim()) return;
    await addNoteMutation.mutateAsync({
      id: appointmentId,
      payload: { note: newNote, isPrivate: false }
    });
    setNewNote("");
  };

  return (
    <Modal open={open} title="Comentarios de la cita" onClose={onClose} size="xl">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <Textarea
            placeholder="Escriba aqui un nuevo comentario"
            className="min-h-[150px] resize-none"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={() => void handleSave()}
              disabled={!newNote.trim() || addNoteMutation.isPending}
            >
              {addNoteMutation.isPending ? "Guardando..." : "Guardar comentario"}
            </Button>
          </div>
        </div>

        <div className="min-h-[150px] max-h-[300px] overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-4">
          {notesQuery.isLoading ? (
            <LoadingState message="Cargando comentarios..." />
          ) : !notesQuery.data?.length ? (
            <EmptyState title="Sin comentarios" description="Esta cita aun no tiene comentarios registrados." />
          ) : (
            <div className="space-y-3">
              {notesQuery.data.map((note) => (
                <article key={note.id} className="rounded border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-brand-600">
                    <span className="flex items-center gap-1">
                      📅 {new Date(note.createdAt).toLocaleString("es-MX", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{note.note}</p>
                  <div className="mt-2 text-xs text-slate-500">
                    👤 {note.user ? `${note.user.firstName} ${note.user.lastName}` : "Sistema"}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
