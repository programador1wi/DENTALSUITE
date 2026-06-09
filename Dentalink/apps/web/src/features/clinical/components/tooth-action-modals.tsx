import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Activity, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { SurfaceSelector } from "./surface-selector";
import type { ToothProcedureStatus } from "../services/clinical.service";

type ProfessionalOption = { id: string; label: string };
type ProcedureOption = { id: string; label: string };

type ToothHistoryPayload = {
  records: Array<{ id: string; createdAt: string; condition: string; status: string; surface?: string | null; diagnosis?: string | null; notes?: string | null }>;
  procedures: Array<{
    id: string;
    status: ToothProcedureStatus;
    diagnosis?: string | null;
    notes?: string | null;
    procedure?: { code: string; name: string } | null;
    createdAt: string;
  }>;
};

function fdiLabel(toothNumber: string) {
  return toothNumber.length >= 2 ? `${toothNumber[0]}.${toothNumber[1]}` : toothNumber;
}

export function ToothTreatmentModal({
  open,
  toothNumber,
  surface,
  professionals,
  procedures,
  onSurfaceChange,
  onClose,
  onCreateProcedure
}: {
  open: boolean;
  toothNumber: string;
  surface: string;
  professionals: ProfessionalOption[];
  procedures: ProcedureOption[];
  onSurfaceChange: (surface: string) => void;
  onClose: () => void;
  onCreateProcedure: (payload: {
    professionalId: string;
    toothNumber: string;
    surface?: string;
    procedureId?: string;
    diagnosis?: string;
    notes?: string;
    status?: ToothProcedureStatus;
  }) => void;
}) {
  const [professionalId, setProfessionalId] = useState("");
  const [procedureId, setProcedureId] = useState("");
  const [procedureStatus, setProcedureStatus] = useState<ToothProcedureStatus>("PLANNED");
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    setProcedureId("");
    setProcedureStatus("PLANNED");
    setDiagnosis("");
    setNotes("");
  }, [toothNumber, open]);

  return (
    <Modal open={open} title={`Agregar tratamiento - Pieza ${fdiLabel(toothNumber)}`} onClose={onClose} size="lg">
      <div className="grid gap-3 md:grid-cols-2">
        <Select value={professionalId} onChange={(event) => setProfessionalId(event.target.value)}>
          <option value="">Profesional</option>
          {professionals.map((professional) => (
            <option key={professional.id} value={professional.id}>
              {professional.label}
            </option>
          ))}
        </Select>
        <SurfaceSelector value={surface} onChange={onSurfaceChange} />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Select value={procedureId} onChange={(event) => setProcedureId(event.target.value)}>
          <option value="">Procedimiento (opcional)</option>
          {procedures.map((procedure) => (
            <option key={procedure.id} value={procedure.id}>
              {procedure.label}
            </option>
          ))}
        </Select>
        <Select value={procedureStatus} onChange={(event) => setProcedureStatus(event.target.value as ToothProcedureStatus)}>
          <option value="PLANNED">PLANNED</option>
          <option value="ACCEPTED">ACCEPTED</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="CANCELLED">CANCELLED</option>
        </Select>
      </div>

      <Input className="mt-3" placeholder="Diagnostico" value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} />
      <Textarea className="mt-3" rows={3} placeholder="Notas del tratamiento" value={notes} onChange={(event) => setNotes(event.target.value)} />

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          disabled={!professionalId}
          onClick={() =>
            onCreateProcedure({
              professionalId,
              toothNumber,
              surface: surface || undefined,
              procedureId: procedureId || undefined,
              diagnosis: diagnosis || undefined,
              notes: notes || undefined,
              status: procedureStatus
            })
          }
        >
          Guardar tratamiento
        </Button>
      </div>
    </Modal>
  );
}

export function ToothInformationModal({
  open,
  toothNumber,
  history,
  historyLoading,
  onClose,
  onCancelRecord,
  onUpdateProcedureStatus
}: {
  open: boolean;
  toothNumber: string;
  history?: ToothHistoryPayload;
  historyLoading: boolean;
  onClose: () => void;
  onCancelRecord: (odontogramRecordId: string) => void;
  onUpdateProcedureStatus: (payload: { toothProcedureId: string; status: ToothProcedureStatus; notes?: string; createClinicalEvolution?: boolean }) => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/25">
      <aside className="flex h-full w-full max-w-[760px] flex-col bg-white shadow-2xl">
        <header className="flex h-[70px] shrink-0 items-center justify-between bg-[#4db2c8] px-6 text-white">
          <h3 className="text-lg font-semibold">Informacion</h3>
          <button type="button" className="grid h-10 w-10 place-items-center text-white/75 hover:text-white" onClick={onClose} aria-label="Cerrar">
            <X className="h-7 w-7" />
          </button>
        </header>

        <div className="border-b border-slate-200 px-6 py-4">
          <h4 className="text-lg text-slate-900">Pieza {fdiLabel(toothNumber)}</h4>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {historyLoading ? <LoadingState message="Cargando informacion dental..." /> : null}

          {!history?.records.length ? <EmptyState title="Sin diagnosticos" description="No hay diagnosticos registrados para esta pieza." /> : null}
          {(history?.records ?? []).map((record) => {
            const cancelled = record.status === "CANCELLED";
            return (
              <div
                key={record.id}
                className={`flex items-start gap-4 border-b border-slate-200 px-6 py-4 ${cancelled ? "bg-slate-50 text-slate-400" : "bg-white text-slate-900"}`}
              >
                <Activity className={`mt-1 h-6 w-6 ${cancelled ? "opacity-35" : "text-slate-900"}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className={cancelled ? "font-medium text-slate-400 line-through" : "font-medium text-slate-900"}>{record.condition}</p>
                      <p className={`text-sm italic ${cancelled ? "text-slate-400" : "text-slate-600"}`}>{record.surface && record.surface !== "ALL" ? record.surface : "Pieza completa"}</p>
                      {record.notes ? <p className={`mt-1 text-sm ${cancelled ? "text-slate-400" : "text-slate-500"}`}>{record.notes}</p> : null}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={cancelled ? "text-sm text-slate-400" : "text-sm text-slate-700"}>{new Date(record.createdAt).toLocaleDateString()}</span>
                      {!cancelled ? (
                        <button
                          type="button"
                          className="grid h-9 w-11 place-items-center rounded bg-red-500 text-lg text-white hover:bg-red-600"
                          onClick={() => onCancelRecord(record.id)}
                          aria-label="Anular diagnostico"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="px-6 py-5">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Tratamientos</h4>
            {!history?.procedures.length ? <EmptyState title="Sin tratamientos registrados" description="Aun no hay tratamientos para esta pieza." /> : null}
            {history?.procedures.map((procedure) => (
              <div key={procedure.id} className="mt-3 rounded-lg border border-slate-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">
                      {procedure.procedure ? `${procedure.procedure.code} - ${procedure.procedure.name}` : "Procedimiento sin catalogo"}
                    </p>
                    <p className="text-xs text-slate-500">{new Date(procedure.createdAt).toLocaleString()}</p>
                  </div>
                  <Badge value={procedure.status} tone={procedure.status === "COMPLETED" ? "success" : procedure.status === "CANCELLED" ? "danger" : "warning"} />
                </div>
                <p className="mt-2 text-sm text-slate-600">{procedure.diagnosis || "-"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {procedure.status !== "COMPLETED" ? (
                    <Button
                      variant="secondary"
                      onClick={() => onUpdateProcedureStatus({ toothProcedureId: procedure.id, status: "COMPLETED", createClinicalEvolution: true })}
                    >
                      Marcar completado
                    </Button>
                  ) : null}
                  {procedure.status !== "CANCELLED" ? (
                    <Button variant="danger" onClick={() => onUpdateProcedureStatus({ toothProcedureId: procedure.id, status: "CANCELLED" })}>
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

export function MultipleToothSelectionModal({
  open,
  onClose
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="multiple-tooth-selection-title"
        className="w-full max-w-[560px] rounded bg-white shadow-[0_18px_44px_rgba(0,0,0,0.35)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="border-b border-slate-200 px-5 py-4">
          <h2 id="multiple-tooth-selection-title" className="text-xl font-bold text-slate-900">
            Como seleccionar multiples piezas?
          </h2>
        </header>

        <div className="px-8 py-9 text-center">
          <div className="flex items-center justify-center gap-10">
            <div className="grid h-[72px] w-[104px] place-items-center rounded border border-slate-500 bg-slate-50 text-2xl font-serif text-slate-600">
              Ctrl
            </div>
            <span className="text-4xl font-light text-slate-600">+</span>
            <div className="relative h-[112px] w-[76px] rotate-[-18deg] rounded-[42px] border border-slate-500 bg-slate-50">
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-slate-500" />
              <div className="absolute left-0 top-[42px] h-px w-full bg-slate-500" />
              <div className="absolute left-0 top-0 h-[42px] w-1/2 rounded-tl-[42px] bg-slate-600" />
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-[460px] text-sm leading-6 text-slate-600">
            <p>
              Para seleccionar multiples piezas, manten presionada la tecla <strong>Ctrl</strong> en el teclado, y luego presiona una a una
              sobre las piezas que desees con el <strong>boton izquierdo del mouse</strong>.
            </p>
          </div>
        </div>

        <footer className="flex justify-end border-t border-slate-200 px-5 py-4">
          <button type="button" className="rounded bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200" onClick={onClose}>
            Cerrar
          </button>
        </footer>
      </section>
    </div>,
    document.body
  );
}
