import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { Textarea } from "@/components/ui/textarea";
import type { PatientListItem } from "@/features/patients/services/patients.service";
import type { Branch } from "@/features/settings/branches/services/branches.service";
import type { Chair } from "@/features/settings/chairs/services/chairs.service";
import type { Professional } from "@/features/settings/professionals/services/professionals.service";
import type { Appointment, AppointmentPayload, AppointmentStatus } from "../services/appointments.service";

type FormState = {
  branchId: string;
  patientId: string;
  professionalId: string;
  chairId: string;
  title: string;
  reason: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  notes: string;
};

const defaultForm: FormState = {
  branchId: "",
  patientId: "",
  professionalId: "",
  chairId: "",
  title: "",
  reason: "",
  status: "SCHEDULED",
  startAt: "",
  endAt: "",
  notes: ""
};

export function AppointmentModal({
  open,
  appointment,
  initialValues,
  branches,
  professionals,
  chairs,
  patients,
  onClose,
  onSubmit
}: {
  open: boolean;
  appointment?: Appointment | null;
  initialValues?: Partial<AppointmentPayload> | null;
  branches: Branch[];
  professionals: Professional[];
  chairs: Chair[];
  patients: PatientListItem[];
  onClose: () => void;
  onSubmit: (payload: AppointmentPayload) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!appointment) {
      setForm(toFormDefaults(initialValues));
      return;
    }
    setForm({
      branchId: appointment.branchId,
      patientId: appointment.patientId ?? "",
      professionalId: appointment.professionalId,
      chairId: appointment.chairId ?? "",
      title: appointment.title,
      reason: appointment.reason ?? "",
      status: appointment.status,
      startAt: toLocalInput(appointment.startAt),
      endAt: toLocalInput(appointment.endAt),
      notes: appointment.notes ?? ""
    });
  }, [appointment, initialValues, open]);

  const filteredChairs = useMemo(() => chairs.filter((chair) => !form.branchId || chair.branchId === form.branchId), [chairs, form.branchId]);
  const filteredProfessionals = useMemo(
    () => professionals.filter((professional) => !form.branchId || professional.branches.some((branch) => branch.id === form.branchId)),
    [professionals, form.branchId]
  );
  const filteredPatients = useMemo(
    () => patients.filter((patient) => !form.branchId || patient.branchId === form.branchId),
    [patients, form.branchId]
  );

  const submit = async () => {
    setSubmitting(true);
    try {
      await onSubmit({
        branchId: form.branchId,
        patientId: form.status === "BLOCKED" ? undefined : form.patientId || undefined,
        professionalId: form.professionalId,
        chairId: form.chairId || undefined,
        title: form.title,
        reason: form.reason || undefined,
        status: form.status,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        notes: form.notes || undefined
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} title={appointment ? "Editar cita" : "Nueva cita"} onClose={onClose}>
      <div className="grid gap-3">
        <Select value={form.status} onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as AppointmentStatus }))}>
          <option value="SCHEDULED">Agendada</option>
          <option value="PENDING_CONFIRMATION">Por confirmar</option>
          <option value="BLOCKED">Bloqueo</option>
        </Select>
        <Select value={form.branchId} onChange={(event) => setForm((prev) => ({ ...prev, branchId: event.target.value, chairId: "", patientId: "", professionalId: "" }))}>
          <option value="">Sucursal</option>
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>{branch.name}</option>
          ))}
        </Select>
        <Select value={form.patientId} disabled={form.status === "BLOCKED"} onChange={(event) => setForm((prev) => ({ ...prev, patientId: event.target.value }))}>
          <option value="">Paciente</option>
          {filteredPatients.map((patient) => (
            <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</option>
          ))}
        </Select>
        <Select value={form.professionalId} onChange={(event) => setForm((prev) => ({ ...prev, professionalId: event.target.value }))}>
          <option value="">Profesional</option>
          {filteredProfessionals.map((professional) => (
            <option key={professional.id} value={professional.id}>{professional.firstName} {professional.lastName}</option>
          ))}
        </Select>
        <Select value={form.chairId} onChange={(event) => setForm((prev) => ({ ...prev, chairId: event.target.value }))}>
          <option value="">Sillon opcional</option>
          {filteredChairs.map((chair) => (
            <option key={chair.id} value={chair.id}>{chair.name}</option>
          ))}
        </Select>
        <Input placeholder="Titulo" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} />
        <Input placeholder="Motivo" value={form.reason} onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))} />
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            type="datetime-local"
            value={form.startAt}
            onChange={(event) => setForm((prev) => ({ ...prev, startAt: event.target.value, endAt: prev.endAt || addMinutesToLocalInput(event.target.value, 30) }))}
          />
          <Input type="datetime-local" value={form.endAt} onChange={(event) => setForm((prev) => ({ ...prev, endAt: event.target.value }))} />
        </div>
        <Textarea rows={2} placeholder="Notas" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} type="button">Cancelar</Button>
          <Button onClick={() => void submit()} disabled={submitting || !form.branchId || !form.professionalId || !form.title || !form.startAt || !form.endAt}>
            {submitting ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function toFormDefaults(initialValues?: Partial<AppointmentPayload> | null): FormState {
  return {
    ...defaultForm,
    branchId: initialValues?.branchId ?? "",
    patientId: initialValues?.patientId ?? "",
    professionalId: initialValues?.professionalId ?? "",
    chairId: initialValues?.chairId ?? "",
    title: initialValues?.title ?? "",
    reason: initialValues?.reason ?? "",
    status: initialValues?.status ?? "SCHEDULED",
    startAt: initialValues?.startAt ? toLocalInput(initialValues.startAt) : "",
    endAt: initialValues?.endAt ? toLocalInput(initialValues.endAt) : "",
    notes: initialValues?.notes ?? ""
  };
}

function addMinutesToLocalInput(value: string, minutes: number) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() + minutes);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}
