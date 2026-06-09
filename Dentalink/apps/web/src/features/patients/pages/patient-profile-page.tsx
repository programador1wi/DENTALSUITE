import { type BaseSyntheticEvent, type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useParams } from "react-router-dom";
import {
  Bold,
  ChevronDown,
  CircleDot,
  Italic,
  List,
  ListOrdered,
  Mail,
  Maximize2,
  MessageCircle,
  Paperclip,
  Plus,
  Printer,
  Search,
  Send,
  Underline
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/feedback/loading-state";
import { PatientSecondaryNav } from "../components/patient-secondary-nav";
import { PatientSubnav } from "../components/patient-subnav";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { patientFormSchema, type PatientFormValues } from "@/lib/validations/patient";
import { useAppointments } from "@/features/agenda/hooks/use-appointments";
import type { Appointment, AppointmentStatus } from "@/features/agenda/services/appointments.service";
import { useDocumentsMutations } from "@/features/documents/hooks/use-documents";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useUsersQuery } from "@/features/settings/users/hooks/use-users";
import { getPatientStatusLabel, getPatientStatusTone } from "../components/patient-status";
import { PatientHeader } from "../components/patient-header";
import {
  useAddPatientAlert,
  useAddPatientNote,
  usePatient,
  usePatientTaskMutations,
  usePatientTasks,
  usePatientTimeline,
  useUpdatePatient
} from "../hooks/use-patients";
import type { PatientDetail, PatientPayload, PatientStatus, PatientTask } from "../services/patients.service";

const statuses: PatientStatus[] = ["NEW", "ACTIVE", "IN_TREATMENT", "INACTIVE", "DEBTOR", "COMPLETED"];
const EMAIL_PREFIX = "[CRM_EMAIL]";

type ProfileTab = "data" | "appointments" | "comments" | "tasks" | "emails";

const appointmentStatusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: "Agendada",
  CONFIRMED: "Confirmada",
  PENDING_CONFIRMATION: "Por confirmar",
  ARRIVED: "Llego",
  WAITING_ROOM: "Sala de espera",
  IN_PROGRESS: "En atencion",
  COMPLETED: "Atendida",
  CANCELLED_BY_PATIENT: "Cancelada por paciente",
  CANCELLED_BY_CLINIC: "Cancelada por clinica",
  NO_SHOW: "No asistio",
  RESCHEDULED: "Reagendada",
  BLOCKED: "Bloqueada"
};

const inactiveAppointmentStatuses = new Set<AppointmentStatus>([
  "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_CLINIC",
  "NO_SHOW",
  "RESCHEDULED"
]);

function profileTabs(patientId: string) {
  return [
    { to: `/patients/${patientId}/profile`, label: "Datos personales" },
    { to: `/patients/${patientId}/profile/appointments`, label: "Citas", permission: "appointments.read" },
    { to: `/patients/${patientId}/profile/comments`, label: "Comentarios administrativos" },
    { to: `/patients/${patientId}/profile/tasks`, label: "Tareas de gestion" },
    { to: `/patients/${patientId}/profile/emails`, label: "Emails" }
  ];
}

function normalizeProfileTab(value?: string): ProfileTab {
  if (value === "appointments" || value === "comments" || value === "tasks" || value === "emails") return value;
  return "data";
}

function isEmailNote(note: string) {
  return note.startsWith(EMAIL_PREFIX);
}

export function PatientProfilePage() {
  const { id = "", profileTab } = useParams();
  const activeTab = normalizeProfileTab(profileTab);
  const patientQuery = usePatient(id);
  const timelineQuery = usePatientTimeline(id);
  const appointmentQuery = useAppointments({ patientId: id }, activeTab === "appointments");
  const branchQuery = useBranches(undefined, "ACTIVE");
  const updatePatient = useUpdatePatient();
  const addPatientNote = useAddPatientNote();
  const addPatientAlert = useAddPatientAlert();
  const [newNote, setNewNote] = useState("");
  const [alertType, setAlertType] = useState("");
  const [alertDescription, setAlertDescription] = useState("");
  const [alertSeverity, setAlertSeverity] = useState("MEDIUM");
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: {
      branchId: "",
      firstName: "",
      lastName: "",
      birthDate: "",
      gender: "",
      documentType: "",
      documentNumber: "",
      email: "",
      phone: "",
      alternatePhone: "",
      occupation: "",
      referredBy: "",
      source: "",
      status: "ACTIVE",
      addressStreet: "",
      addressCity: "",
      addressState: "",
      addressCountry: "",
      addressZipCode: "",
      emergencyName: "",
      emergencyRelationship: "",
      emergencyPhone: "",
      emergencyEmail: "",
      alertType: "",
      alertDescription: "",
      alertSeverity: ""
    }
  });

  useEffect(() => {
    if (!patientQuery.data) return;
    const emergency = patientQuery.data.contacts.find((contact) => contact.isEmergencyContact);
    form.reset({
      branchId: patientQuery.data.branchId,
      firstName: patientQuery.data.firstName,
      lastName: patientQuery.data.lastName,
      birthDate: patientQuery.data.birthDate?.slice(0, 10) ?? "",
      gender: patientQuery.data.gender ?? "",
      documentType: patientQuery.data.documentType ?? "",
      documentNumber: patientQuery.data.documentNumber ?? "",
      email: patientQuery.data.email ?? "",
      phone: patientQuery.data.phone ?? "",
      alternatePhone: patientQuery.data.alternatePhone ?? "",
      occupation: patientQuery.data.occupation ?? "",
      referredBy: patientQuery.data.referredBy ?? "",
      source: patientQuery.data.source ?? "",
      status: patientQuery.data.status,
      addressStreet: patientQuery.data.address?.street ?? "",
      addressCity: patientQuery.data.address?.city ?? "",
      addressState: patientQuery.data.address?.state ?? "",
      addressCountry: patientQuery.data.address?.country ?? "",
      addressZipCode: patientQuery.data.address?.zipCode ?? "",
      emergencyName: emergency?.name ?? "",
      emergencyRelationship: emergency?.relationship ?? "",
      emergencyPhone: emergency?.phone ?? "",
      emergencyEmail: emergency?.email ?? "",
      alertType: "",
      alertDescription: "",
      alertSeverity: ""
    });
  }, [form, patientQuery.data]);

  useEffect(() => {
    if (!patientQuery.data?.email || emailTo) return;
    setEmailTo(patientQuery.data.email);
  }, [emailTo, patientQuery.data?.email]);

  const patient = patientQuery.data;
  const activeAlerts = useMemo(
    () => patient?.medicalAlerts.filter((alert) => alert.isActive) ?? [],
    [patient?.medicalAlerts]
  );
  const notes = patient?.notes ?? [];
  const administrativeNotes = useMemo(() => notes.filter((note) => !isEmailNote(note.note)), [notes]);
  const emailNotes = useMemo(() => notes.filter((note) => isEmailNote(note.note)), [notes]);

  if (patientQuery.isLoading) return <LoadingState message="Cargando paciente..." />;
  if (patientQuery.isError) return <ErrorState message={patientQuery.error.message} />;
  if (!patient) return <EmptyState title="Paciente no encontrado" description="El registro no existe o fue desactivado." />;

  const onSubmit = form.handleSubmit(async (values) => {
    const payload: Partial<PatientPayload> = {
      branchId: values.branchId,
      firstName: values.firstName,
      lastName: values.lastName,
      birthDate: values.birthDate || undefined,
      gender: values.gender || undefined,
      documentType: values.documentType || undefined,
      documentNumber: values.documentNumber || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      alternatePhone: values.alternatePhone || undefined,
      occupation: values.occupation || undefined,
      referredBy: values.referredBy || undefined,
      source: values.source || undefined,
      status: values.status
    };

    payload.address =
      values.addressStreet || values.addressCity || values.addressState || values.addressCountry || values.addressZipCode
        ? {
            street: values.addressStreet || undefined,
            city: values.addressCity || undefined,
            state: values.addressState || undefined,
            country: values.addressCountry || undefined,
            zipCode: values.addressZipCode || undefined
          }
        : undefined;

    payload.contacts = values.emergencyName
      ? [
          {
            name: values.emergencyName,
            relationship: values.emergencyRelationship || undefined,
            phone: values.emergencyPhone || undefined,
            email: values.emergencyEmail || undefined,
            isEmergencyContact: true
          }
        ]
      : [];

    await updatePatient.mutateAsync({ id, payload });
  });

  const handleCreateEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const to = emailTo.trim();
    const subject = emailSubject.trim();
    const body = emailBody.trim();
    if (!to || !subject) return;

    await addPatientNote.mutateAsync({
      id,
      isPrivate: true,
      note: [EMAIL_PREFIX, `Para: ${to}`, `Asunto: ${subject}`, `Mensaje: ${body || "-"}`].join("\n")
    });
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setEmailSubject("");
    setEmailBody("");
  };

  return (
    <div className="space-y-4">
      <PatientHeader patientId={id} />
      <PatientSubnav patientId={id} />
      <PatientSecondaryNav tabs={profileTabs(id)} label="Datos personales" />

      {activeTab === "data" ? (
        <PatientDataTab
          patient={patient}
          activeAlerts={activeAlerts}
          branchOptions={branchQuery.data ?? []}
          form={form}
          onSubmit={onSubmit}
          updating={updatePatient.isPending}
          alertType={alertType}
          alertDescription={alertDescription}
          alertSeverity={alertSeverity}
          setAlertType={setAlertType}
          setAlertDescription={setAlertDescription}
          setAlertSeverity={setAlertSeverity}
          addPatientAlert={() =>
            void addPatientAlert
              .mutateAsync({
                id,
                payload: {
                  type: alertType,
                  description: alertDescription,
                  severity: alertSeverity,
                  isActive: true
                }
              })
              .then(() => {
                setAlertType("");
                setAlertDescription("");
                setAlertSeverity("MEDIUM");
              })
          }
          addingAlert={addPatientAlert.isPending}
          timelineQuery={timelineQuery}
          patientId={id}
        />
      ) : null}

      {activeTab === "appointments" ? <AppointmentsTab patientId={id} appointments={appointmentQuery} /> : null}

      {activeTab === "comments" ? (
        <CommentsTab
          patientId={id}
          notes={administrativeNotes}
          newNote={newNote}
          setNewNote={setNewNote}
          saving={addPatientNote.isPending}
        />
      ) : null}

      {activeTab === "tasks" ? <TasksTab patientId={id} branchId={patient.branchId} /> : null}

      {activeTab === "emails" ? (
        <EmailsTab
          notes={emailNotes}
          emailTo={emailTo}
          setEmailTo={setEmailTo}
          emailSubject={emailSubject}
          setEmailSubject={setEmailSubject}
          emailBody={emailBody}
          setEmailBody={setEmailBody}
          onCreateEmail={handleCreateEmail}
          saving={addPatientNote.isPending}
        />
      ) : null}
    </div>
  );
}

function PatientDataTab({
  patient,
  activeAlerts,
  branchOptions,
  form,
  onSubmit,
  updating,
  alertType,
  alertDescription,
  alertSeverity,
  setAlertType,
  setAlertDescription,
  setAlertSeverity,
  addPatientAlert,
  addingAlert,
  timelineQuery,
  patientId
}: {
  patient: PatientDetail;
  activeAlerts: PatientDetail["medicalAlerts"];
  branchOptions: Array<{ id: string; name: string }>;
  form: UseFormReturn<PatientFormValues>;
  onSubmit: (event?: BaseSyntheticEvent) => Promise<void>;
  updating: boolean;
  alertType: string;
  alertDescription: string;
  alertSeverity: string;
  setAlertType: (value: string) => void;
  setAlertDescription: (value: string) => void;
  setAlertSeverity: (value: string) => void;
  addPatientAlert: () => void;
  addingAlert: boolean;
  timelineQuery: ReturnType<typeof usePatientTimeline>;
  patientId: string;
}) {
  const lastAppointmentLabel = patient.summary.lastAppointment ?? "Sin dato";
  const nextAppointmentLabel = patient.summary.nextAppointment ?? "Sin dato";

  return (
    <>
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="md:col-span-3">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Datos del paciente</h3>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Sucursal">
                <Select {...form.register("branchId")}>
                  <option value="">Selecciona</option>
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Nombre"><Input {...form.register("firstName")} /></Field>
              <Field label="Apellidos"><Input {...form.register("lastName")} /></Field>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Nacimiento"><Input type="date" {...form.register("birthDate")} /></Field>
              <Field label="Genero"><Input {...form.register("gender")} /></Field>
              <Field label="Documento"><Input {...form.register("documentNumber")} /></Field>
              <Field label="Estado">
                <Select {...form.register("status")}>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {getPatientStatusLabel(status)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Telefono"><Input {...form.register("phone")} /></Field>
              <Field label="Telefono alterno"><Input {...form.register("alternatePhone")} /></Field>
              <Field label="Email"><Input {...form.register("email")} /></Field>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Calle"><Input {...form.register("addressStreet")} /></Field>
              <Field label="Ciudad"><Input {...form.register("addressCity")} /></Field>
              <Field label="Estado"><Input {...form.register("addressState")} /></Field>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Contacto emergencia"><Input {...form.register("emergencyName")} /></Field>
              <Field label="Relacion"><Input {...form.register("emergencyRelationship")} /></Field>
              <Field label="Telefono emergencia"><Input {...form.register("emergencyPhone")} /></Field>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={updating}>
                {updating ? "Guardando..." : "Actualizar paciente"}
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-4 md:col-span-2">
          <Card>
            <h3 className="mb-3 text-base font-semibold text-slate-900">Resumen</h3>
            <div className="space-y-2 text-sm text-slate-700">
              <SummaryRow label="Estado" value={<Badge value={getPatientStatusLabel(patient.status)} tone={getPatientStatusTone(patient.status)} />} />
              <SummaryRow label="Proxima cita" value={nextAppointmentLabel} />
              <SummaryRow label="Ultima cita" value={lastAppointmentLabel} />
              <SummaryRow label="Saldo" value={`$${patient.summary.balance.toFixed(2)}`} />
              <SummaryRow label="Tratamientos activos" value={String(patient.summary.activeTreatments)} />
            </div>
          </Card>

          <Card className={patient.summary.hasCriticalAlert ? "border-red-400" : undefined}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Alertas medicas</h3>
              <Badge value={patient.summary.hasCriticalAlert ? "Critica" : "Sin riesgo"} tone={patient.summary.hasCriticalAlert ? "danger" : "success"} />
            </div>
            {!activeAlerts.length ? (
              <p className="text-sm text-slate-600">Sin alertas activas.</p>
            ) : (
              <ul className="space-y-2">
                {activeAlerts.map((alert) => (
                  <li key={alert.id} className="rounded-lg border border-slate-200 p-2">
                    <p className="text-sm font-medium text-slate-900">{alert.type}</p>
                    <p className="text-xs text-slate-600">{alert.description}</p>
                    <p className="text-xs text-slate-500">{alert.severity}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card>
        <h3 className="mb-2 text-base font-semibold text-slate-900">Agregar alerta medica</h3>
        <div className="grid gap-2 md:grid-cols-[1fr_2fr_180px_auto]">
          <Input value={alertType} onChange={(event) => setAlertType(event.target.value)} placeholder="Tipo de alerta" />
          <Input value={alertDescription} onChange={(event) => setAlertDescription(event.target.value)} placeholder="Descripcion de alerta" />
          <Select value={alertSeverity} onChange={(event) => setAlertSeverity(event.target.value)}>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </Select>
          <Button onClick={addPatientAlert} disabled={!alertType.trim() || !alertDescription.trim() || addingAlert}>
            Agregar alerta
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Timeline</h3>
          <Link to={`/patients/${patientId}/clinical/history`} className="text-sm text-brand-700 hover:underline">
            Ir a clinico
          </Link>
        </div>
        {timelineQuery.isLoading ? <LoadingState message="Cargando timeline..." /> : null}
        {timelineQuery.isError ? <ErrorState message={timelineQuery.error.message} /> : null}
        {!timelineQuery.isLoading && !timelineQuery.data?.length ? (
          <EmptyState title="Sin eventos" description="No hay eventos para este paciente." />
        ) : (
          <ul className="space-y-2">
            {timelineQuery.data?.map((event, index) => (
              <li key={`${event.type}-${index}`} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">{event.type}</span>
                  <span className="text-xs text-slate-500">{new Date(event.date).toLocaleString()}</span>
                </div>
                {"note" in event.payload ? <p className="mt-1 text-slate-700">{String(event.payload.note)}</p> : null}
                {"description" in event.payload ? <p className="mt-1 text-slate-700">{String(event.payload.description)}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function AppointmentsTab({
  patientId,
  appointments
}: {
  patientId: string;
  appointments: ReturnType<typeof useAppointments>;
}) {
  const [search, setSearch] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const rows = appointments.data ?? [];
  const professionals = useMemo(() => {
    const map = new Map<string, Appointment["professional"]>();
    rows.forEach((appointment) => map.set(appointment.professional.id, appointment.professional));
    return [...map.values()].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  }, [rows]);
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((appointment) => {
      if (professionalId && appointment.professional.id !== professionalId) return false;
      if (!term) return true;
      return [
        appointment.id,
        appointment.title,
        appointment.reason ?? "",
        appointment.treatmentPlan?.name ?? "",
        appointment.branch?.name ?? "",
        `${appointment.professional.firstName} ${appointment.professional.lastName}`
      ]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [professionalId, rows, search]);

  if (appointments.isLoading) return <LoadingState message="Cargando citas del paciente..." />;
  if (appointments.isError) return <ErrorState message={appointments.error.message} />;

  return (
    <section className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-5">
        <h2 className="text-2xl font-light text-slate-900">Citas</h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              placeholder="Buscar por numero o nombre de tratamiento"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="flex items-center gap-2">
            <Select className="w-64" value={professionalId} onChange={(event) => setProfessionalId(event.target.value)}>
              <option value="">Profesional o recurso</option>
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.firstName} {professional.lastName}
                </option>
              ))}
            </Select>
            <Button type="button" variant="secondary" aria-label="Imprimir citas" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
            </Button>
            <Link
              to={`/agenda/day?patientId=${encodeURIComponent(patientId)}`}
              className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--action-primary)] text-[var(--text-inverse)] transition hover:bg-[var(--action-primary-hover)]"
              aria-label="Nueva cita"
            >
              <Plus className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-900">
              <th className="px-3 py-3"># Tratamiento</th>
              <th className="px-3 py-3">Sucursal</th>
              <th className="px-3 py-3">Profesional</th>
              <th className="px-3 py-3">Fecha</th>
              <th className="px-3 py-3">Hora</th>
              <th className="px-3 py-3">Duracion</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Comentarios</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((appointment) => {
              const startAt = new Date(appointment.startAt);
              const treatment = appointment.treatmentPlan;
              return (
                <tr key={appointment.id} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-3">
                    <Link to={`/agenda/day?appointmentId=${appointment.id}`} className="text-brand-700 hover:underline">
                      {treatment ? `${shortId(treatment.id)}` : shortId(appointment.id)}
                    </Link>
                    {treatment ? <span className="ml-1 text-slate-500">{treatment.name}</span> : null}
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-slate-900">{appointment.branch?.name ?? "-"}</p>
                    <p className="text-xs text-slate-400">{appointment.chair?.name ?? "Sillon 1"}</p>
                  </td>
                  <td className="px-3 py-3 text-brand-700">
                    {appointment.professional.firstName} {appointment.professional.lastName}
                  </td>
                  <td className="px-3 py-3">{startAt.toLocaleDateString("es-MX", { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="px-3 py-3">{startAt.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="px-3 py-3">{appointment.durationMinutes} min</td>
                  <td className="px-3 py-3">
                    <Badge value={appointmentStatusLabels[appointment.status]} tone={appointmentStatusTone(appointment)} />
                  </td>
                  <td className="px-3 py-3">
                    <Button type="button" variant="secondary" size="sm">
                      <MessageCircle className="h-4 w-4" />
                      Ver
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!filteredRows.length ? (
        <div className="p-8">
          <EmptyState title="Sin citas" description="No hay citas que coincidan con el filtro." />
        </div>
      ) : null}
    </section>
  );
}

function CommentsTab({
  patientId,
  notes,
  newNote,
  setNewNote,
  saving
}: {
  patientId: string;
  notes: PatientDetail["notes"];
  newNote: string;
  setNewNote: (value: string) => void;
  saving: boolean;
}) {
  const addPatientNote = useAddPatientNote();
  const documents = useDocumentsMutations();
  const [files, setFiles] = useState<File[]>([]);
  const uploading = documents.uploadPatientBinaryFile.isPending;

  const onSave = async () => {
    if (!newNote.trim()) return;
    const uploadedFiles = await Promise.all(
      files.map((file) =>
        documents.uploadPatientBinaryFile.mutateAsync({
          patientId,
          file,
          category: "OTHER"
        })
      )
    );
    await addPatientNote.mutateAsync({
      id: patientId,
      note: newNote,
      isPrivate: true,
      fileAttachmentIds: uploadedFiles.map((file) => file.id)
    });
    setNewNote("");
    setFiles([]);
  };

  return (
    <section className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-5">
        <h2 className="text-2xl font-light text-slate-900">Comentarios administrativos</h2>
      </div>
      <div className="grid gap-3 p-3 lg:grid-cols-[360px_1fr]">
        <div className="border border-slate-200 bg-white shadow-sm">
          <div className="flex h-9 items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 text-slate-700">
            <Button type="button" variant="ghost" size="sm" className="w-8 px-0" title="Negrita"><Bold className="h-4 w-4" /></Button>
            <Button type="button" variant="ghost" size="sm" className="w-8 px-0" title="Cursiva"><Italic className="h-4 w-4" /></Button>
            <Button type="button" variant="ghost" size="sm" className="w-8 px-0" title="Subrayado"><Underline className="h-4 w-4" /></Button>
            <Button type="button" variant="ghost" size="sm" className="w-8 px-0" title="Lista"><List className="h-4 w-4" /></Button>
            <Button type="button" variant="ghost" size="sm" className="w-8 px-0" title="Lista numerada"><ListOrdered className="h-4 w-4" /></Button>
            <Button type="button" variant="ghost" size="sm" className="w-8 px-0" title="Expandir"><Maximize2 className="h-4 w-4" /></Button>
          </div>
          <Textarea
            className="min-h-[270px] resize-none rounded-none border-0 shadow-none focus-visible:ring-0"
            value={newNote}
            onChange={(event) => setNewNote(event.target.value)}
          />
          <div className="flex items-end justify-between border-t border-slate-200 p-2">
            <label className="cursor-pointer text-sm text-brand-700">
              <span className="inline-flex items-center gap-1">
                <Paperclip className="h-4 w-4" />
                Adjuntar Archivos
              </span>
              <Input
                className="hidden"
                type="file"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
              />
              <span className="block text-[10px] text-slate-400">(Formatos aceptados: jpg, pdf, xlsx, docx)</span>
            </label>
            <Button onClick={onSave} disabled={!newNote.trim() || saving || uploading}>
              {saving || uploading ? "Guardando..." : "Agregar comentario"}
            </Button>
          </div>
          {files.length ? (
            <div className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
              {files.map((file) => file.name).join(", ")}
            </div>
          ) : null}
        </div>

        <div className="min-h-[120px] border border-slate-200 bg-white p-4 shadow-sm">
          {!notes.length ? (
            <EmptyState title="Sin comentarios" description="No existe ningun comentario administrativo." />
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <NoteCard key={note.id} note={note.note} createdAt={note.createdAt} attachments={note.attachments} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function TasksTab({ patientId, branchId }: { patientId: string; branchId: string }) {
  const [showCompleted, setShowCompleted] = useState(false);
  const [type, setType] = useState("Captura de Presupuesto");
  const [detail, setDetail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const tasks = usePatientTasks(patientId, showCompleted);
  const users = useUsersQuery(undefined, "ACTIVE", branchId);
  const mutations = usePatientTaskMutations();

  const createTask = async () => {
    if (!type.trim() || !detail.trim()) return;
    await mutations.createTask.mutateAsync({
      id: patientId,
      payload: {
        type,
        detail,
        dueDate: dueDate || undefined,
        assignedToId: assignedToId || undefined
      }
    });
    setDetail("");
    setDueDate("");
    setAssignedToId("");
  };

  if (tasks.isLoading) return <LoadingState message="Cargando tareas..." />;
  if (tasks.isError) return <ErrorState message={tasks.error.message} />;

  return (
    <section className="border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-light text-slate-900">Tareas de gestion</h2>
        <div className="flex items-center gap-2">
          <label className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-100 px-3 text-sm text-slate-700">
            <input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} />
            Ver tareas completadas
          </label>
          <Button type="button" onClick={createTask} disabled={!detail.trim() || mutations.createTask.isPending}>
            <Plus className="h-4 w-4" />
            Nueva tarea personalizada
          </Button>
        </div>
      </div>
      <div className="mb-4 grid gap-2 md:grid-cols-[220px_1fr_170px_220px]">
        <Input value={type} onChange={(event) => setType(event.target.value)} placeholder="Tipo tarea" />
        <Input value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Detalle" />
        <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        <Select value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)}>
          <option value="">Responsable</option>
          {(users.data ?? []).map((user) => (
            <option key={user.id} value={user.id}>
              {user.firstName} {user.lastName}
            </option>
          ))}
        </Select>
      </div>
      <PatientTasksTable
        patientId={patientId}
        tasks={tasks.data ?? []}
        users={users.data ?? []}
        onAssign={(taskId, nextAssignedToId) =>
          mutations.updateTask.mutate({ id: patientId, taskId, payload: { assignedToId: nextAssignedToId } })
        }
        onComplete={(taskId) => mutations.completeTask.mutate({ id: patientId, taskId })}
      />
    </section>
  );
}

function EmailsTab({
  notes,
  emailTo,
  setEmailTo,
  emailSubject,
  setEmailSubject,
  emailBody,
  setEmailBody,
  onCreateEmail,
  saving
}: {
  notes: PatientDetail["notes"];
  emailTo: string;
  setEmailTo: (value: string) => void;
  emailSubject: string;
  setEmailSubject: (value: string) => void;
  emailBody: string;
  setEmailBody: (value: string) => void;
  onCreateEmail: (event: FormEvent<HTMLFormElement>) => void;
  saving: boolean;
}) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const filteredNotes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return notes.filter((note) => {
      if (month) {
        const createdMonth = new Date(note.createdAt).toISOString().slice(0, 7);
        if (createdMonth !== month) return false;
      }
      if (!term) return true;
      return note.note.toLowerCase().includes(term);
    });
  }, [month, notes, search]);

  return (
    <section className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-8">
        <h2 className="mb-4 text-2xl font-light text-slate-900">Registro de Emails</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Input className="w-48" placeholder="Buscar" value={search} onChange={(event) => setSearch(event.target.value)} />
          <span className="text-sm font-semibold text-slate-900">Filtrar por mes:</span>
          <Input className="w-44" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          <span className="text-sm font-semibold text-slate-900">Filtrar por:</span>
          <Select className="w-52" defaultValue="all">
            <option value="all">Todos</option>
          </Select>
          <Button type="button" onClick={() => setComposeOpen((value) => !value)}>
            <Plus className="h-4 w-4" />
            Redactar nuevo email
          </Button>
        </div>
        {composeOpen ? (
          <form className="mt-4 grid gap-3 lg:grid-cols-[220px_1fr_auto]" onSubmit={onCreateEmail}>
            <Input type="email" placeholder="Email destino" value={emailTo} onChange={(event) => setEmailTo(event.target.value)} />
            <Input placeholder="Asunto" value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} />
            <Button type="submit" disabled={!emailTo.trim() || !emailSubject.trim() || saving}>
              <Send className="h-4 w-4" />
              Guardar y abrir
            </Button>
            <Textarea className="lg:col-span-3" rows={4} placeholder="Mensaje" value={emailBody} onChange={(event) => setEmailBody(event.target.value)} />
          </form>
        ) : null}
      </div>

      <div className="min-h-[400px] p-8">
        {!filteredNotes.length ? (
          <EmptyState title="No se encontro ningun registro de email" description="Aqui podras ver el registro de todos los emails que se envian al paciente." />
        ) : (
          <div className="mx-auto max-w-3xl space-y-3">
            {filteredNotes.map((note) => (
              <NoteCard key={note.id} icon={<Mail className="h-5 w-5 text-sky-600" />} note={note.note} createdAt={note.createdAt} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function NoteCard({
  icon,
  note,
  createdAt,
  attachments
}: {
  icon?: ReactNode;
  note: string;
  createdAt: string;
  attachments?: PatientDetail["notes"][number]["attachments"];
}) {
  const lines = note.split("\n").filter((line) => !line.startsWith("["));
  return (
    <article className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3">
      {icon ? <div className="mt-0.5">{icon}</div> : null}
      <div className="min-w-0 flex-1">
        {lines.map((line) => (
          <p key={line} className="break-words text-sm text-slate-700">
            {line}
          </p>
        ))}
        {attachments?.length ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.fileAttachment.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs text-brand-700 hover:bg-slate-50"
              >
                <Paperclip className="h-3 w-3" />
                {attachment.fileAttachment.originalName}
              </a>
            ))}
          </div>
        ) : null}
        <p className="mt-2 text-xs text-slate-400">{new Date(createdAt).toLocaleString("es-MX")}</p>
      </div>
    </article>
  );
}

function PatientTasksTable({
  patientId,
  tasks,
  users,
  onAssign,
  onComplete
}: {
  patientId: string;
  tasks: PatientTask[];
  users: Array<{ id: string; firstName: string; lastName: string }>;
  onAssign: (taskId: string, assignedToId: string) => void;
  onComplete: (taskId: string) => void;
}) {
  if (!tasks.length) {
    return <EmptyState title="Sin tareas" description="No hay tareas de gestion registradas para este paciente." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold text-slate-900">
            <th className="px-3 py-3">Tipo tarea</th>
            <th className="px-3 py-3">Detalle</th>
            <th className="px-3 py-3">Vencimiento</th>
            <th className="px-3 py-3">Responsable</th>
            <th className="px-3 py-3">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="border-b border-slate-100 align-middle">
              <td className="px-3 py-4 font-semibold text-slate-900">
                <span className="inline-flex items-center gap-2">
                  <CircleDot className={`h-4 w-4 ${task.status === "COMPLETED" ? "text-emerald-500" : task.type.toLowerCase().includes("cita") ? "text-fuchsia-600" : "text-sky-600"}`} />
                  {task.type}
                </span>
              </td>
              <td className="px-3 py-4 text-slate-700">{task.detail}</td>
              <td className="px-3 py-4 text-slate-700">{task.dueDate ? new Date(task.dueDate).toLocaleDateString("es-MX") : "-"}</td>
              <td className="px-3 py-4">
                <Select value={task.assignedToId ?? ""} onChange={(event) => onAssign(task.id, event.target.value)}>
                  <option value="">Asignar</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.firstName} {user.lastName}
                    </option>
                  ))}
                </Select>
              </td>
              <td className="px-3 py-4">
                {task.status === "COMPLETED" ? (
                  <span className="text-emerald-700">Finalizada</span>
                ) : (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onComplete(task.id)}>
                    Finalizar
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-400">Paciente {shortId(patientId)}</p>
    </div>
  );
}

function shortId(id: string) {
  return id.length > 6 ? id.slice(-6) : id;
}

function Field({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1 text-sm text-slate-700">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs uppercase text-slate-500">{label}</p>
      <p className="font-medium text-slate-900">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function appointmentStatusTone(row: Appointment) {
  if (row.status === "COMPLETED") return "success";
  if (inactiveAppointmentStatuses.has(row.status)) return "danger";
  return "warning";
}
