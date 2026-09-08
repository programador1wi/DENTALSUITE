import { Link } from "react-router-dom";
import { FileText, MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_ROUTES } from "@/lib/routes";
import { formatDateTime } from "./treatment-modal-helpers";

export function PatientSignaturePanel({
  patientId,
  notes,
  onAddComment
}: {
  patientId: string;
  notes: Array<{ id: string; note: string; createdAt: string }>;
  onAddComment: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <h2 className="text-base font-semibold text-slate-900">Firma del paciente</h2>
          <Link to={APP_ROUTES.patients.clinicalConsents(patientId)}>
            <Button variant="secondary" size="sm">
              <FileText className="mr-1 h-4 w-4" />
              Crear consentimiento
            </Button>
          </Link>
        </div>
        <div className="space-y-4 py-4 text-sm">
          <div>
            <p className="font-semibold text-slate-900">Evoluciónes</p>
            <p className="mt-1 text-slate-500">No hay documentos pendientes por firmar.</p>
          </div>
          <div className="border-t border-dashed border-slate-200 pt-4">
            <p className="font-semibold text-slate-900">Consentimientos</p>
            <p className="mt-1 text-slate-500">
              Consulta o crea consentimientos desde la ficha del paciente.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <h2 className="text-base font-semibold text-slate-900">Comentarios para el paciente</h2>
          <Button variant="secondary" size="sm" onClick={onAddComment}>
            <MessageSquarePlus className="mr-1 h-4 w-4" />
            Agregar
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {notes.slice(0, 3).map((note) => (
            <div key={note.id} className="rounded border border-slate-100 bg-slate-50 p-3 text-sm">
              <p className="text-slate-700">{note.note}</p>
              <p className="mt-1 text-xs text-slate-400">{formatDateTime(note.createdAt)}</p>
            </div>
          ))}
          {!notes.length ? (
            <p className="text-center text-sm text-slate-400">
              Sin comentario, agrega uno para imprimirlo en presupuestos.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
