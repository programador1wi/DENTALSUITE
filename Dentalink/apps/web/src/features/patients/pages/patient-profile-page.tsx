import { type BaseSyntheticEvent, type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useParams, useLocation } from "react-router-dom";
import {
  Bold,
  Calendar,
  Check,
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
  Search,
  Send,
  Underline,
  User
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/feedback/loading-state";
import { Modal } from "@/components/ui/modal";
import { PatientAppointmentsTab } from "../components/patient-appointments-tab";
import { PatientBenefitsCoverageView } from "./patient-benefits-coverage-view";
import { PatientSecondaryNav } from "../components/patient-secondary-nav";
import { PatientSubnav } from "../components/patient-subnav";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RichTextEditor } from "@/features/clinical/components/rich-text-editor";
import { patientFormSchema, type PatientFormValues, GENDERS, MEXICO_STATES } from "@/lib/validations/patient";
import { useAppointments } from "@/features/agenda/hooks/use-appointments";
import { useDocumentsMutations } from "@/features/documents/hooks/use-documents";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useUsersQuery } from "@/features/settings/users/hooks/use-users";
import { useBranchStore } from "@/stores/branch.store";
import { useAuthStore } from "@/stores/auth.store";
import { getPatientStatusLabel, getPatientStatusTone } from "../components/patient-status";
import { PatientHeader } from "../components/patient-header";
import { PatientIdentityCard } from "../components/patient-identity-card";
import {
  useAddPatientAlert,
  useAddPatientNote,
  usePatient,
  usePatientEmail,
  usePatientEmails,
  useSendPatientEmail,
  usePatientTaskMutations,
  usePatientTasks,
  usePatientTimeline,
  useUpdatePatient
} from "../hooks/use-patients";
import type { PatientDetail, PatientPayload, PatientStatus, PatientTask } from "../services/patients.service";

const statuses: PatientStatus[] = [
  "NEW",
  "PROVISIONAL",
  "ACTIVE",
  "IN_TREATMENT",
  "INACTIVE",
  "DEBTOR",
  "COMPLETED"
];
const EMAIL_PREFIX = "[CRM_EMAIL]";
const EMAIL_ALLOWED_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx"
];
const EMAIL_MAX_ATTACHMENTS = 3;
const EMAIL_MAX_TOTAL_BYTES = 25 * 1024 * 1024;

type ProfileTab = "data" | "benefits-coverages" | "appointments" | "comments" | "tasks" | "emails";

function profileTabs(patientId: string, appointmentCount?: number) {
  return [
    { to: `/patients/${patientId}/profile`, label: "Datos personales" },
    { to: `/patients/${patientId}/profile/benefits-coverages`, label: "Beneficios y coberturas" },
    {
      to: `/patients/${patientId}/profile/appointments`,
      label: "Citas",
      permission: "appointments.read",
      count: appointmentCount
    },
    { to: `/patients/${patientId}/profile/comments`, label: "Comentarios administrativos" },
    { to: `/patients/${patientId}/profile/tasks`, label: "Tareas de gestion" },
    { to: `/patients/${patientId}/profile/emails`, label: "Emails" }
  ];
}

function normalizeProfileTab(value?: string): ProfileTab {
  if (
    value === "benefits-coverages" ||
    value === "appointments" ||
    value === "comments" ||
    value === "tasks" ||
    value === "emails"
  )
    return value;
  return "data";
}

function isEmailNote(note: string) {
  return note.startsWith(EMAIL_PREFIX);
}

export function PatientProfilePage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const activeTabMatch = location.pathname.match(/\/profile\/([^/]+)/);
  const activeTab = normalizeProfileTab(activeTabMatch ? activeTabMatch[1] : undefined);
  const { activeBranchId } = useBranchStore();
  const patientQuery = usePatient(id);
  const timelineQuery = usePatientTimeline(id);
  const appointmentCountQuery = useAppointments({ patientId: id }, true);
  const branchQuery = useBranches(undefined, "ACTIVE");
  const updatePatient = useUpdatePatient();
  const addPatientNote = useAddPatientNote();
  const addPatientAlert = useAddPatientAlert();
  const [newNote, setNewNote] = useState("");
  const [alertType, setAlertType] = useState("");
  const [alertDescription, setAlertDescription] = useState("");
  const [alertSeverity, setAlertSeverity] = useState("MEDIUM");

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
      branchId: patientQuery.data.branchId || activeBranchId || "",
      firstName: patientQuery.data.firstName,
      lastName: patientQuery.data.lastName,
      birthDate: patientQuery.data.birthDate?.slice(0, 10) ?? "",
      gender: (patientQuery.data.gender as any) ?? "",
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
      addressState: (patientQuery.data.address?.state as any) ?? "",
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
  }, [form, patientQuery.data, activeBranchId]);

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
  if (!patient)
    return (
      <EmptyState title="Paciente no encontrado" description="El registro no existe o fue desactivado." />
    );

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
      values.addressStreet ||
      values.addressCity ||
      values.addressState ||
      values.addressCountry ||
      values.addressZipCode
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

  return (
    <div className="space-y-4">
      <PatientHeader patientId={id} />
      <PatientSubnav patientId={id} />
      <PatientSecondaryNav
        tabs={profileTabs(id, appointmentCountQuery.data?.length)}
        label="Datos personales"
      />

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

      {activeTab === "benefits-coverages" ? (
        <PatientBenefitsCoverageView patientId={id} patient={patient} />
      ) : null}

      {activeTab === "appointments" ? <PatientAppointmentsTab patientId={id} /> : null}

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
        <EmailsTab patientId={id} patientEmail={patient.email ?? ""} notes={emailNotes} />
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
  const lastAppointmentLabel = formatPatientDateTime(patient.summary.lastAppointment);
  const nextAppointmentLabel = formatPatientDateTime(patient.summary.nextAppointment);

  useEffect(() => {
    if (!form.formState.isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [form.formState.isDirty]);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-5">
        <Card className="md:col-span-3">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Datos del paciente</h3>
              <p className="text-sm text-slate-500">
                Informacion general, contacto, direccion y administracion.
              </p>
            </div>
            {form.formState.isDirty ? (
              <Badge value="Cambios pendientes" tone="warning" />
            ) : (
              <Badge value="Sin cambios" tone="success" />
            )}
          </div>
          <form className="space-y-3" onSubmit={onSubmit}>
            <SectionLabel title="Informacion general" />
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Sucursal" error={form.formState.errors.branchId?.message}>
                <Select {...form.register("branchId")}>
                  <option value="">Selecciona</option>
                  {branchOptions.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Nombre" error={form.formState.errors.firstName?.message}>
                <Input {...form.register("firstName")} />
              </Field>
              <Field label="Apellidos" error={form.formState.errors.lastName?.message}>
                <Input {...form.register("lastName")} />
              </Field>
            </div>
            <SectionLabel title="Identificacion" />
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Nacimiento" error={form.formState.errors.birthDate?.message}>
                <Input type="date" {...form.register("birthDate")} />
              </Field>
              <Field label="Genero" error={form.formState.errors.gender?.message}>
                <Select {...form.register("gender")}>
                  <option value="">Selecciona</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Documento" error={form.formState.errors.documentNumber?.message}>
                <Input {...form.register("documentNumber")} />
              </Field>
              <Field label="Estado del paciente" error={form.formState.errors.status?.message}>
                <Select {...form.register("status")}>
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {getPatientStatusLabel(status)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <SectionLabel title="Contacto" />
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Telefono" error={form.formState.errors.phone?.message}>
                <Input
                  type="tel"
                  onInput={(e) => (e.currentTarget.value = e.currentTarget.value.replace(/[^0-9+]/g, ""))}
                  {...form.register("phone")}
                />
              </Field>
              <Field label="Telefono alterno" error={form.formState.errors.alternatePhone?.message}>
                <Input
                  type="tel"
                  onInput={(e) => (e.currentTarget.value = e.currentTarget.value.replace(/[^0-9+]/g, ""))}
                  {...form.register("alternatePhone")}
                />
              </Field>
              <Field label="Email" error={form.formState.errors.email?.message}>
                <Input type="email" {...form.register("email")} />
              </Field>
            </div>
            <SectionLabel title="Direccion" />
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Calle" error={form.formState.errors.addressStreet?.message}>
                <Input {...form.register("addressStreet")} />
              </Field>
              <Field label="Ciudad" error={form.formState.errors.addressCity?.message}>
                <Input {...form.register("addressCity")} />
              </Field>
              <Field label="Estado/Provincia" error={form.formState.errors.addressState?.message}>
                <Select {...form.register("addressState")}>
                  <option value="">Selecciona</option>
                  {MEXICO_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <SectionLabel title="Contacto de emergencia" />
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Contacto emergencia" error={form.formState.errors.emergencyName?.message}>
                <Input {...form.register("emergencyName")} />
              </Field>
              <Field label="Relacion" error={form.formState.errors.emergencyRelationship?.message}>
                <Input {...form.register("emergencyRelationship")} />
              </Field>
              <Field label="Telefono emergencia" error={form.formState.errors.emergencyPhone?.message}>
                <Input
                  type="tel"
                  onInput={(e) => (e.currentTarget.value = e.currentTarget.value.replace(/[^0-9+]/g, ""))}
                  {...form.register("emergencyPhone")}
                />
              </Field>
            </div>
            <SectionLabel title="Informacion administrativa" />
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Ocupacion" error={form.formState.errors.occupation?.message}>
                <Input {...form.register("occupation")} />
              </Field>
              <Field label="Fuente" error={form.formState.errors.source?.message}>
                <Input {...form.register("source")} />
              </Field>
              <Field label="Referido por" error={form.formState.errors.referredBy?.message}>
                <Input {...form.register("referredBy")} />
              </Field>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {form.formState.isDirty ? (
                <Button type="button" variant="ghost" onClick={() => form.reset()}>
                  Descartar cambios
                </Button>
              ) : null}
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
              <SummaryRow
                label="Estado"
                value={
                  <Badge
                    value={getPatientStatusLabel(patient.status)}
                    tone={getPatientStatusTone(patient.status)}
                  />
                }
              />
              <SummaryRow label="Proxima cita" value={nextAppointmentLabel} />
              <SummaryRow label="Ultima cita" value={lastAppointmentLabel} />
              <SummaryRow label="Saldo" value={formatMoney(patient.summary.balance)} />
              <SummaryRow label="Tratamientos activos" value={String(patient.summary.activeTreatments)} />
              <SummaryRow label="Beneficios activos" value={String(patient.summary.activeBenefits ?? 0)} />
              <SummaryRow
                label="Cobertura por vencer"
                value={
                  patient.summary.coverageExpiringSoon
                    ? `${patient.summary.coverageExpiringSoon.providerName} - ${formatPatientDateTime(patient.summary.coverageExpiringSoon.endsAt)}`
                    : "Sin dato"
                }
              />
            </div>
          </Card>

          <PatientIdentityCard
            patientId={patient.id}
            patientName={`${patient.firstName} ${patient.lastName}`}
            patientBranchId={patient.branchId}
            patientPhone={patient.phone}
          />

          <Card className={patient.summary.hasCriticalAlert ? "border-red-400" : undefined}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Alertas medicas</h3>
              <Badge
                value={patient.summary.hasCriticalAlert ? "Critica" : "Sin riesgo"}
                tone={patient.summary.hasCriticalAlert ? "danger" : "success"}
              />
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
          <Input
            value={alertType}
            onChange={(event) => setAlertType(event.target.value)}
            placeholder="Tipo de alerta"
          />
          <Input
            value={alertDescription}
            onChange={(event) => setAlertDescription(event.target.value)}
            placeholder="Descripcion de alerta"
          />
          <Select value={alertSeverity} onChange={(event) => setAlertSeverity(event.target.value)}>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </Select>
          <Button
            onClick={addPatientAlert}
            disabled={!alertType.trim() || !alertDescription.trim() || addingAlert}
          >
            Agregar alerta
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Timeline</h3>
          <Link
            to={`/patients/${patientId}/clinical/history`}
            className="text-sm text-brand-700 hover:underline"
          >
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
                {"note" in event.payload ? (
                  <p className="mt-1 text-slate-700">{String(event.payload.note)}</p>
                ) : null}
                {"description" in event.payload ? (
                  <p className="mt-1 text-slate-700">{String(event.payload.description)}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
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
      <div className="grid gap-4 p-4 lg:grid-cols-[460px_1fr] xl:grid-cols-[520px_1fr]">
        <div className="flex flex-col rounded-md shadow-sm border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 overflow-hidden transition-shadow">
          <RichTextEditor
            value={newNote}
            onChange={setNewNote}
            placeholder="Escribe un comentario..."
            className="border-0 rounded-none focus-within:ring-0 focus-within:ring-offset-0 shadow-none"
          />
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <label className="group cursor-pointer inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:text-sky-700 transition-colors">
                Adjuntar Archivos
                <Input
                  className="hidden"
                  type="file"
                  multiple
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                />
              </label>
              <span className="text-[11px] text-slate-400">(Formatos aceptados: jpg, pdf, xlsx, docx)</span>
            </div>
            <Button
              onClick={onSave}
              disabled={!newNote.trim() || saving || uploading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-md shadow-sm"
            >
              <Check className="h-4 w-4" />
              {saving || uploading ? "Guardando..." : "Agregar comentario"}
            </Button>
          </div>
          {files.length ? (
            <div className="border-t border-slate-200 bg-white px-4 py-3 flex flex-wrap gap-2">
              {files.map((file, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm"
                >
                  <Paperclip className="h-3 w-3 text-slate-400" />
                  <span className="truncate max-w-[200px]">{file.name}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-h-[120px] border border-slate-200 bg-white p-4 shadow-sm rounded-sm">
          {!notes.length ? (
            <EmptyState title="Sin comentarios" description="No existe ningun comentario administrativo." />
          ) : (
            <div className="space-y-3">
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  user={note.user}
                  note={note.note}
                  createdAt={note.createdAt}
                  attachments={note.attachments}
                />
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
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(event) => setShowCompleted(event.target.checked)}
            />
            Ver tareas completadas
          </label>
          <Button
            type="button"
            onClick={createTask}
            disabled={!detail.trim() || mutations.createTask.isPending}
          >
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

function parseEmailNote(htmlContent: string) {
  let clean = htmlContent;
  if (clean.startsWith("[CRM_EMAIL]\n")) clean = clean.replace("[CRM_EMAIL]\n", "");
  else if (clean.startsWith("[CRM_EMAIL]")) clean = clean.replace("[CRM_EMAIL]", "");
  clean = clean.trim();

  // 1. Try parsing HTML format
  if (clean.includes("<div") && clean.includes("Para:")) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(clean, "text/html");

      let to = "";
      let subject = "";

      const strongs = doc.querySelectorAll("strong");
      strongs.forEach((strong) => {
        const parentText = strong.parentElement?.textContent || "";
        if (strong.textContent?.includes("Para:")) {
          to = parentText.replace("Para:", "").trim();
        } else if (strong.textContent?.includes("Asunto:")) {
          subject = parentText.replace("Asunto:", "").trim();
        }
      });

      const bodyDiv = doc.querySelector(".prose");
      if (bodyDiv) {
        return { to, subject, body: bodyDiv.innerHTML, isHtml: true };
      }
    } catch (e) {
      // Fallback
    }
  }

  // 2. Try parsing plain text with regex (single-line or multiline with double space/newline separator)
  const regex = /Para:\s*(.*?)\s*Asunto:\s*(.*?)(?:\s{2,}|\n+)(.*)/is;
  const match = clean.match(regex);
  if (match) {
    return {
      to: match[1].trim(),
      subject: match[2].trim(),
      body: match[3].trim(),
      isHtml: false
    };
  }

  // 3. Fallback: Parse Plain Text line by line
  const lines = clean.split("\n");
  let to = "";
  let subject = "";
  const bodyLines: string[] = [];

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed.toLowerCase().startsWith("para:")) {
      to = trimmed.substring(5).trim();
    } else if (trimmed.toLowerCase().startsWith("asunto:")) {
      subject = trimmed.substring(7).trim();
    } else {
      bodyLines.push(line);
    }
  });

  return {
    to,
    subject,
    body: bodyLines.join("\n").trim(),
    isHtml: false
  };
}

function EmailsTab({
  patientId,
  patientEmail,
  notes
}: {
  patientId: string;
  patientEmail: string;
  notes: PatientDetail["notes"];
}) {
  const [composeOpen, setComposeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [emailTo, setEmailTo] = useState(patientEmail);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isCopyRequested, setIsCopyRequested] = useState(false);
  const [selectedNote, setSelectedNote] = useState<PatientDetail["notes"][number] | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  const addPatientNote = useAddPatientNote();
  const sendPatientEmail = useSendPatientEmail();
  const documents = useDocumentsMutations();
  const saving =
    addPatientNote.isPending || documents.uploadPatientBinaryFile.isPending || sendPatientEmail.isPending;

  useEffect(() => {
    if (patientEmail && !emailTo) setEmailTo(patientEmail);
  }, [patientEmail]);

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

  const handleCreateEmail = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const to = emailTo.trim();
    const subject = emailSubject.trim();
    const body = emailBody.trim();
    if (!to || !subject) return;

    const uploadedFiles = await Promise.all(
      files.map((file) =>
        documents.uploadPatientBinaryFile.mutateAsync({
          patientId,
          file,
          category: "OTHER"
        })
      )
    );
    const fileAttachmentIds = uploadedFiles.map((f) => f.id);

    try {
      await sendPatientEmail.mutateAsync({
        id: patientId,
        idempotencyKey: crypto.randomUUID(),
        payload: {
          subject,
          bodyHtmlBase64: btoa(unescape(encodeURIComponent(body || " "))),
          copyToSender: isCopyRequested,
          fileAttachmentIds
        }
      });
    } catch (error) {
      console.error("Failed to send email:", error);
      return; // Do not save note if email failed
    }

    const htmlNote = `[CRM_EMAIL]
<div class="mb-3 text-sm">
  <p><strong>Para:</strong> ${to}</p>
  <p><strong>Asunto:</strong> ${subject}</p>
  ${isCopyRequested ? `<p class="text-xs text-slate-500">(Copia enviada al remitente)</p>` : ""}
</div>
<div class="prose prose-sm max-w-none border-t border-slate-100 pt-3">
  ${body || "-"}
</div>`;

    await addPatientNote.mutateAsync({
      id: patientId,
      isPrivate: true,
      note: htmlNote,
      fileAttachmentIds
    });

    setComposeOpen(false);
    setEmailSubject("");
    setEmailBody("");
    setIsCopyRequested(false);
    setFiles([]);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all">
      <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Registro de Emails</h2>
            <p className="text-xs text-slate-500 mt-1">
              Monitorea y envía correspondencia electrónica al paciente.
            </p>
          </div>

          <Button
            type="button"
            className="w-full md:w-auto bg-[#31b866] hover:bg-[#299c56] text-white shadow-sm hover:shadow transition-all duration-200 border-0"
            onClick={() => setComposeOpen((value) => !value)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Redactar nuevo email
          </Button>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:flex-wrap flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9 bg-white border-slate-200/80 focus:border-brand-500 focus:ring-brand-500/20 focus:ring-2 outline-none text-slate-900"
              placeholder="Buscar por asunto o contenido..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Filtrar por mes:
              </span>
              <Input
                className="w-36 sm:w-44 bg-white border-slate-200/80 text-slate-700 focus:border-brand-500 focus:ring-brand-500/20"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Filtrar por:
              </span>
              <Select
                className="w-32 sm:w-44 bg-white border-slate-200/80 text-slate-700 focus:border-brand-500"
                defaultValue="all"
              >
                <option value="all">Todos</option>
              </Select>
            </div>
          </div>
        </div>

        {composeOpen ? (
          <form
            className="mt-6 rounded-xl border border-slate-150 bg-slate-50/40 p-5 shadow-inner"
            onSubmit={handleCreateEmail}
          >
            <h3 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Mail className="h-4 w-4 text-[#31b866]" /> Redactar Nuevo Mensaje
            </h3>

            <div className="mb-4 grid gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Input
                  className="flex-1 bg-white border-slate-200 focus:border-brand-500 focus:ring-brand-500/20 focus:ring-2 text-slate-900"
                  placeholder="Asunto del correo"
                  value={emailSubject}
                  onChange={(event) => setEmailSubject(event.target.value)}
                />
                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer shrink-0 select-none bg-white border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 transition-colors">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-brand-500 focus:ring-brand-500/20 bg-white h-4 w-4"
                    checked={isCopyRequested}
                    onChange={(e) => setIsCopyRequested(e.target.checked)}
                  />
                  Recibir copia en mi bandeja
                </label>
              </div>
            </div>

            <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500 transition-all">
              <RichTextEditor
                value={emailBody}
                onChange={setEmailBody}
                placeholder="Escribe el cuerpo del correo aquí..."
                className="min-h-[250px] border-0 rounded-none focus-within:ring-0 focus-within:ring-offset-0 shadow-none p-3 text-slate-950"
              />
            </div>

            <div className="mt-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-slate-100 pt-4">
              <div className="flex flex-col gap-2 max-w-xl">
                <div className="text-[10px] text-slate-500 leading-normal">
                  <strong className="text-slate-600 font-semibold">Reglas de adjuntos:</strong> Máximo de 3
                  archivos, total menor a 25MB. Formatos permitidos: PNG, JPG, PDF, DOC(X), XLS(X), PPT(X).
                </div>
                <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-all shadow-sm w-fit">
                  <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                  Adjuntar archivos
                  <Input
                    className="hidden"
                    type="file"
                    multiple
                    accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                    onChange={(event) => {
                      const selectedFiles = Array.from(event.target.files ?? []);
                      setFiles((prev) => [...prev, ...selectedFiles].slice(0, 3));
                    }}
                  />
                </label>
                {files.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {files.map((f, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 shadow-sm"
                      >
                        <span className="truncate max-w-[150px]">{f.name}</span>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-red-500 ml-1 font-bold"
                          onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 shrink-0 justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                  onClick={() => {
                    setComposeOpen(false);
                    setFiles([]);
                  }}
                >
                  Descartar
                </Button>
                <Button
                  type="submit"
                  className="bg-[#31b866] hover:bg-[#299c56] text-white border-0 shadow-sm hover:shadow transition-all"
                  disabled={!emailTo.trim() || !emailSubject.trim() || saving}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {saving ? "Enviando..." : "Enviar Correo"}
                </Button>
              </div>
            </div>
          </form>
        ) : null}
      </div>

      <div className="min-h-[400px] p-8 bg-slate-50/30">
        {!filteredNotes.length ? (
          <EmptyState
            title="No se encontró ningún registro de email"
            description="Aquí podrás ver el registro de todos los emails que se envían al paciente."
          />
        ) : (
          <div className="mx-auto max-w-4xl space-y-4">
            {filteredNotes.map((note) => (
              <NoteCard
                key={note.id}
                icon={<Mail className="h-5 w-5 text-sky-600" />}
                note={note.note}
                createdAt={note.createdAt}
                attachments={note.attachments}
                onClick={() => setSelectedNote(note)}
              />
            ))}
          </div>
        )}
      </div>
      {selectedNote
        ? (() => {
            const emailDetails = parseEmailNote(selectedNote.note);
            return (
              <Modal
                open={!!selectedNote}
                title={emailDetails.subject || "Correo Enviado"}
                onClose={() => setSelectedNote(null)}
                size="lg"
              >
                <div className="space-y-6 pt-4">
                  {/* Envelope Header */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5 text-sm space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">De:</p>
                        <p className="font-medium text-slate-800">
                          Dental+{" "}
                          <span className="text-xs text-slate-500 font-normal">
                            &lt;no-reply@dentalsuite.com&gt;
                          </span>
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">
                        {new Date(selectedNote.createdAt).toLocaleString("es-MX", {
                          dateStyle: "long",
                          timeStyle: "short"
                        })}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Para:</p>
                      <p className="font-medium text-slate-800 text-sky-600">
                        {emailDetails.to || patientEmail || "Paciente"}
                      </p>
                    </div>

                    {emailDetails.subject && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                          Asunto:
                        </p>
                        <p className="font-semibold text-slate-900">{emailDetails.subject}</p>
                      </div>
                    )}
                  </div>

                  {/* Email Content Body */}
                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm min-h-[200px] max-h-[50vh] overflow-y-auto">
                    {emailDetails.isHtml ? (
                      <div
                        className="prose prose-sm max-w-none text-slate-700 break-words prose-p:leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: emailDetails.body }}
                      />
                    ) : emailDetails.body ? (
                      <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-sans">
                        {emailDetails.body}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">
                        Este correo no contiene texto en el cuerpo.
                      </p>
                    )}
                  </div>

                  {/* Attachments */}
                  {selectedNote.attachments?.length ? (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Archivos Adjuntos
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedNote.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.fileAttachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:bg-sky-50/50 hover:border-sky-200 transition-all duration-200"
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-slate-500">
                              <Paperclip className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium text-slate-700">
                                {attachment.fileAttachment.originalName}
                              </p>
                              <p className="text-[10px] text-slate-400">Haga clic para descargar</p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </Modal>
            );
          })()
        : null}
    </section>
  );
}

function formatDentalinkDate(dateString: string) {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  const day = d.getDate();
  const months = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
  ];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `Creada el ${day} de ${month} de ${year} ${hours}:${minutes}`;
}

function NoteCard({
  icon,
  user,
  note,
  createdAt,
  attachments,
  onClick
}: {
  icon?: ReactNode;
  user?: { id?: string; firstName?: string; lastName?: string };
  note: string;
  createdAt: string;
  attachments?: PatientDetail["notes"][number]["attachments"];
  onClick?: () => void;
}) {
  let displayNote = note;
  if (displayNote.startsWith("[CRM_EMAIL]\n")) displayNote = displayNote.replace("[CRM_EMAIL]\n", "");
  else if (displayNote.startsWith("[CRM_EMAIL]")) displayNote = displayNote.replace("[CRM_EMAIL]", "");

  const isHtml = displayNote.includes("<") && displayNote.includes(">");
  const authorName = user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim().toUpperCase() : null;

  const renderHeader = () => {
    if (authorName || !icon) {
      return (
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3 text-xs text-sky-600">
          <div className="flex items-center gap-1.5 font-bold tracking-wide uppercase">
            <User className="h-3.5 w-3.5 shrink-0 text-sky-600" />
            <span>{authorName || "USUARIO"}</span>
          </div>
          <div className="flex items-center gap-1.5 text-sky-600 font-medium">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-sky-600" />
            <span>{formatDentalinkDate(createdAt)}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  const renderFooter = () => {
    if (!authorName && icon) {
      return (
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
          <span className="font-medium">
            {new Date(createdAt).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" })}
          </span>
          <span className="text-sky-600 font-semibold">Entregado</span>
        </div>
      );
    }
    return null;
  };

  return (
    <article
      onClick={onClick}
      className={`group relative flex gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-2xs hover:shadow-xs transition-all duration-200 ${onClick ? "cursor-pointer hover:bg-slate-50/30" : ""}`}
    >
      {icon && !authorName ? (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 transition-colors group-hover:bg-sky-100/80">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        {renderHeader()}
        {isHtml ? (
          <div
            className="prose prose-sm max-w-none text-slate-700 break-words 
              prose-p:my-1 prose-ul:my-1 prose-ol:my-1 
              [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:list-item [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5
              [&_strong]:font-semibold [&_strong]:text-slate-800
              [&_p]:leading-relaxed"
            dangerouslySetInnerHTML={{ __html: displayNote }}
          />
        ) : (
          <div className="space-y-1.5 text-slate-700 text-sm leading-relaxed">
            {note.split("\n").filter((line) => !line.startsWith("[")).map((line, idx) => (
              <p key={idx} className="break-words">
                {line}
              </p>
            ))}
          </div>
        )}
        {attachments?.length ? (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            {attachments.map((attachment) => (
              <a
                key={attachment.id}
                href={attachment.fileAttachment.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-150 bg-slate-50/50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-sky-50 hover:text-sky-700 hover:border-sky-200 transition-all duration-200"
              >
                <Paperclip className="h-3.5 w-3.5 text-slate-400 group-hover:text-sky-500" />
                <span className="max-w-[200px] truncate">{attachment.fileAttachment.originalName}</span>
              </a>
            ))}
          </div>
        ) : null}
        {renderFooter()}
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
    return (
      <EmptyState title="Sin tareas" description="No hay tareas de gestion registradas para este paciente." />
    );
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
                  <CircleDot
                    className={`h-4 w-4 ${task.status === "COMPLETED" ? "text-emerald-500" : task.type.toLowerCase().includes("cita") ? "text-fuchsia-600" : "text-sky-600"}`}
                  />
                  {task.type}
                </span>
              </td>
              <td className="px-3 py-4 text-slate-700">{task.detail}</td>
              <td className="px-3 py-4 text-slate-700">
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString("es-MX") : "-"}
              </td>
              <td className="px-3 py-4">
                <Select
                  value={task.assignedToId ?? ""}
                  onChange={(event) => onAssign(task.id, event.target.value)}
                >
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

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-sm text-slate-700 flex flex-col">
      <span>{label}</span>
      {children}
      {error ? <span className="text-xs text-red-500">{error}</span> : null}
    </label>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <div className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
    </div>
  );
}

function formatPatientDateTime(value?: string | null) {
  if (!value) return "Sin dato";
  return new Date(value).toLocaleString("es-MX", { dateStyle: "long", timeStyle: "short" });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 2
  }).format(value);
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
