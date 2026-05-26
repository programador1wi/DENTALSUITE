import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { SurfaceSelector } from "./surface-selector";
import type { ToothProcedureStatus } from "../services/clinical.service";

type ProfessionalOption = { id: string; label: string };
type ProcedureOption = { id: string; label: string };

const CONDITION_OPTIONS = [
  { value: "CARIES", label: "Caries" },
  { value: "FRACTURA CORONARIA", label: "Fractura coronaria" },
  { value: "FRACTURA CORONARIA COMPROMETIENDO PULPA", label: "Fractura coronaria comprometiendo pulpa" },
  { value: "AUSENCIA DENTARIA", label: "Ausencia dentaria" },
  { value: "OBTURACION DEFECTUOSA", label: "Obturacion defectuosa" },
  { value: "DESGASTE DENTAL", label: "Desgaste dental" },
  { value: "MALPOSICION", label: "Malposicion" },
  { value: "MOVILIDAD", label: "Movilidad" },
  { value: "LESION PERIAPICAL", label: "Lesion periapical" },
  { value: "SENSIBILIDAD", label: "Sensibilidad" },
  { value: "OTRA", label: "Otra (especificar)" }
] as const;

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

export function ToothDetailPanel({
  toothNumber,
  surface,
  onSurfaceChange,
  professionals,
  procedures,
  history,
  historyLoading,
  onCreateCondition,
  onCreateProcedure,
  onUpdateProcedureStatus
}: {
  toothNumber: string;
  surface: string;
  onSurfaceChange: (surface: string) => void;
  professionals: ProfessionalOption[];
  procedures: ProcedureOption[];
  history?: ToothHistoryPayload;
  historyLoading: boolean;
  onCreateCondition: (payload: { professionalId: string; toothNumber: string; surface?: string; condition: string; diagnosis?: string; notes?: string }) => void;
  onCreateProcedure: (payload: {
    professionalId: string;
    toothNumber: string;
    surface?: string;
    procedureId?: string;
    diagnosis?: string;
    notes?: string;
    status?: ToothProcedureStatus;
  }) => void;
  onUpdateProcedureStatus: (payload: { toothProcedureId: string; status: ToothProcedureStatus; notes?: string; createClinicalEvolution?: boolean }) => void;
}) {
  const [professionalId, setProfessionalId] = useState("");
  const [condition, setCondition] = useState("");
  const [customCondition, setCustomCondition] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [conditionNotes, setConditionNotes] = useState("");

  const [procedureId, setProcedureId] = useState("");
  const [procedureStatus, setProcedureStatus] = useState<ToothProcedureStatus>("PLANNED");
  const [procedureDiagnosis, setProcedureDiagnosis] = useState("");
  const [procedureNotes, setProcedureNotes] = useState("");

  useEffect(() => {
    setCondition("");
    setCustomCondition("");
    setDiagnosis("");
    setConditionNotes("");
    setProcedureId("");
    setProcedureStatus("PLANNED");
    setProcedureDiagnosis("");
    setProcedureNotes("");
  }, [toothNumber]);

  if (!toothNumber) {
    return <EmptyState title="Selecciona una pieza" description="Selecciona una pieza en el odontograma para registrar diagnostico y tratamiento." />;
  }

  const resolvedCondition = condition === "OTRA" ? customCondition.trim() : condition;

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="mb-3 text-base font-semibold">Pieza {toothNumber}</h3>
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
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Diagnostico por pieza</h4>
          <Select value={condition} onChange={(event) => setCondition(event.target.value)}>
            <option value="">Selecciona causa/condicion</option>
            {CONDITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          {condition === "OTRA" ? (
            <Input
              className="mt-2"
              placeholder="Especifica la condicion"
              value={customCondition}
              onChange={(event) => setCustomCondition(event.target.value)}
            />
          ) : null}
          <Input className="mt-2" placeholder="Diagnostico" value={diagnosis} onChange={(event) => setDiagnosis(event.target.value)} />
          <Textarea className="mt-2" rows={2} placeholder="Notas" value={conditionNotes} onChange={(event) => setConditionNotes(event.target.value)} />
          <Button
            className="mt-3"
            disabled={!professionalId || !resolvedCondition}
            onClick={() =>
              onCreateCondition({
                professionalId,
                toothNumber,
                surface: surface || undefined,
                condition: resolvedCondition,
                diagnosis: diagnosis || undefined,
                notes: conditionNotes || undefined
              })
            }
          >
            Registrar diagnostico
          </Button>
        </Card>

        <Card>
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Tratamiento por pieza</h4>
          <Select value={procedureId} onChange={(event) => setProcedureId(event.target.value)}>
            <option value="">Procedimiento (opcional)</option>
            {procedures.map((procedure) => (
              <option key={procedure.id} value={procedure.id}>
                {procedure.label}
              </option>
            ))}
          </Select>
          <Select className="mt-2" value={procedureStatus} onChange={(event) => setProcedureStatus(event.target.value as ToothProcedureStatus)}>
            <option value="PLANNED">PLANNED</option>
            <option value="ACCEPTED">ACCEPTED</option>
            <option value="IN_PROGRESS">IN_PROGRESS</option>
            <option value="COMPLETED">COMPLETED</option>
            <option value="CANCELLED">CANCELLED</option>
          </Select>
          <Input className="mt-2" placeholder="Diagnostico" value={procedureDiagnosis} onChange={(event) => setProcedureDiagnosis(event.target.value)} />
          <Textarea className="mt-2" rows={2} placeholder="Notas" value={procedureNotes} onChange={(event) => setProcedureNotes(event.target.value)} />
          <Button
            className="mt-3"
            disabled={!professionalId}
            onClick={() =>
              onCreateProcedure({
                professionalId,
                toothNumber,
                surface: surface || undefined,
                procedureId: procedureId || undefined,
                diagnosis: procedureDiagnosis || undefined,
                notes: procedureNotes || undefined,
                status: procedureStatus
              })
            }
          >
            Registrar tratamiento
          </Button>
        </Card>
      </div>

      {historyLoading ? <LoadingState message="Cargando historial dental..." /> : null}

      <DataTable
        rows={history?.records ?? []}
        empty={<EmptyState title="Sin historial por pieza" description="No hay registros en esta pieza." />}
        columns={[
          { key: "createdAt", title: "Fecha", render: (row) => new Date(row.createdAt).toLocaleString() },
          { key: "condition", title: "Condicion" },
          { key: "surface", title: "Superficie" },
          { key: "status", title: "Estado" },
          { key: "diagnosis", title: "Diagnostico" }
        ]}
      />

      <div className="space-y-2">
        {!history?.procedures.length ? <EmptyState title="Sin tratamientos registrados" description="Aun no hay tratamientos para esta pieza." /> : null}
        {history?.procedures.map((procedure) => (
          <Card key={procedure.id}>
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
          </Card>
        ))}
      </div>
    </div>
  );
}
