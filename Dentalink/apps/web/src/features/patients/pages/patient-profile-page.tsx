import { type BaseSyntheticEvent, type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useParams, useLocation } from "react-router-dom";
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
import { PatientAppointmentsTab } from "../components/patient-appointments-tab";
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



function profileTabs(patientId: string, appointmentCount?: number) {
  return [
    { to: `/patients/${patientId}/profile`, label: "Datos personales" },
    { to: `/patients/${patientId}/profile/appointments`, label: "Citas", permission: "appointments.read", count: appointmentCount },
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



  return (
    <div className="space-y-4">
      <PatientHeader patientId={id} />
      <PatientSubnav patientId={id} />
      <PatientSecondaryNav tabs={profileTabs(id, appointmentCountQuery.data?.length)} label="Datos personales" />

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
        <EmailsTab
          patientId={id}
          patientEmail={patient.email ?? ""}
          notes={emailNotes}
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
              <Field label="Nombre" error={form.formState.errors.firstName?.message}><Input {...form.register("firstName")} /></Field>
              <Field label="Apellidos" error={form.formState.errors.lastName?.message}><Input {...form.register("lastName")} /></Field>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="Nacimiento" error={form.formState.errors.birthDate?.message}><Input type="date" {...form.register("birthDate")} /></Field>
              <Field label="Genero" error={form.formState.errors.gender?.message}>
                <Select {...form.register("gender")}>
                  <option value="">Selecciona</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Documento" error={form.formState.errors.documentNumber?.message}><Input {...form.register("documentNumber")} /></Field>
              <Field label="Estado" error={form.formState.errors.status?.message}>
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
              <Field label="Telefono" error={form.formState.errors.phone?.message}><Input type="tel" onInput={(e) => e.currentTarget.value = e.currentTarget.value.replace(/[^0-9+]/g, '')} {...form.register("phone")} /></Field>
              <Field label="Telefono alterno" error={form.formState.errors.alternatePhone?.message}><Input type="tel" onInput={(e) => e.currentTarget.value = e.currentTarget.value.replace(/[^0-9+]/g, '')} {...form.register("alternatePhone")} /></Field>
              <Field label="Email" error={form.formState.errors.email?.message}><Input type="email" {...form.register("email")} /></Field>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Calle" error={form.formState.errors.addressStreet?.message}><Input {...form.register("addressStreet")} /></Field>
              <Field label="Ciudad" error={form.formState.errors.addressCity?.message}><Input {...form.register("addressCity")} /></Field>
              <Field label="Estado" error={form.formState.errors.addressState?.message}>
                <Select {...form.register("addressState")}>
                  <option value="">Selecciona</option>
                  {MEXICO_STATES.map((state) => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Contacto emergencia" error={form.formState.errors.emergencyName?.message}><Input {...form.register("emergencyName")} /></Field>
              <Field label="Relacion" error={form.formState.errors.emergencyRelationship?.message}><Input {...form.register("emergencyRelationship")} /></Field>
              <Field label="Telefono emergencia" error={form.formState.errors.emergencyPhone?.message}><Input type="tel" onInput={(e) => e.currentTarget.value = e.currentTarget.value.replace(/[^0-9+]/g, '')} {...form.register("emergencyPhone")} /></Field>
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
            <div className="flex flex-col gap-1">
              <label className="group cursor-pointer inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm group-hover:border-blue-300 group-hover:bg-blue-50 transition-all">
                  <Paperclip className="h-4 w-4" />
                </div>
                Adjuntar Archivos
                <Input
                  className="hidden"
                  type="file"
                  multiple
                  onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                />
              </label>
              <span className="text-[11px] text-slate-400 pl-10">jpg, pdf, xlsx, docx</span>
            </div>
            <Button 
              onClick={onSave} 
              disabled={!newNote.trim() || saving || uploading}
              className="shrink-0 font-medium"
            >
              {saving || uploading ? "Guardando..." : "Agregar comentario"}
            </Button>
          </div>
          {files.length ? (
            <div className="border-t border-slate-200 bg-white px-4 py-3 flex flex-wrap gap-2">
              {files.map((file, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
                  <Paperclip className="h-3 w-3 text-slate-400" />
                  <span className="truncate max-w-[200px]">{file.name}</span>
                </span>
              ))}
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
  patientId,
  patientEmail,
  notes,
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
  const [files, setFiles] = useState<File[]>([]);
  
  const addPatientNote = useAddPatientNote();
  const documents = useDocumentsMutations();
  const saving = addPatientNote.isPending || documents.uploadPatientBinaryFile.isPending;

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
      fileAttachmentIds: uploadedFiles.map((f) => f.id)
    });
    
    setComposeOpen(false);
    setEmailSubject("");
    setEmailBody("");
    setIsCopyRequested(false);
    setFiles([]);
  };

  return (
    <section className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-6">
        <h2 className="mb-6 text-2xl font-light text-slate-900">Registro de Emails</h2>
        
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:flex-wrap flex-1">
            <Input 
              className="w-full sm:w-64 shrink-0" 
              placeholder="Buscar" 
              value={search} 
              onChange={(event) => setSearch(event.target.value)} 
            />
            
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-sm font-semibold text-slate-900">Filtrar por mes:</span>
              <Input className="w-36 sm:w-44" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
            </div>
            
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-sm font-semibold text-slate-900">Filtrar por:</span>
              <Select className="w-32 sm:w-44" defaultValue="all">
                <option value="all">Todos</option>
              </Select>
            </div>
          </div>
          
          <Button 
            type="button" 
            className="w-full sm:w-auto bg-[#31b866] hover:bg-[#299c56] text-white whitespace-nowrap shrink-0 self-stretch sm:self-auto" 
            onClick={() => setComposeOpen((value) => !value)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Redactar nuevo email
          </Button>
        </div>

        {composeOpen ? (
          <form className="mt-6 rounded-lg border border-slate-200 bg-slate-50/50 p-4 shadow-sm" onSubmit={handleCreateEmail}>
            <div className="mb-4 grid gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Input className="flex-1" placeholder="Asunto" value={emailSubject} onChange={(event) => setEmailSubject(event.target.value)} />
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer shrink-0">
                  <input type="checkbox" className="rounded border-slate-300 text-brand-600 focus:ring-brand-600" checked={isCopyRequested} onChange={(e) => setIsCopyRequested(e.target.checked)} />
                  Recibir una copia de este correo
                </label>
              </div>
            </div>

            <div className="flex flex-col rounded-md border border-slate-300 bg-white shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-brand-500 focus-within:ring-offset-2 transition-shadow">
              <RichTextEditor
                value={emailBody}
                onChange={setEmailBody}
                placeholder="Redacta tu mensaje aquí..."
                className="min-h-[200px] border-0 rounded-none focus-within:ring-0 focus-within:ring-offset-0 shadow-none"
              />
            </div>

            <div className="mt-4 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="flex flex-col gap-2">
                <div className="text-xs text-slate-500">
                  <strong className="text-slate-700 font-semibold">Importante:</strong><br/>
                  Solo se puede adjuntar hasta un máximo de 3 archivos por correo, estos no deben superar los 25MB en total.<br/>
                  Los archivos adjuntos ocuparán espacio de almacenamiento de la clínica.<br/>
                  Funcionalidad compatible con formatos PNG, JPG, PDF, DOC(X), XLS(X), PPT(X).
                </div>
                <label className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 w-fit">
                  <Paperclip className="h-4 w-4" />
                  Adjuntar archivo(s)
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
                  <div className="flex flex-wrap gap-2 mt-1">
                    {files.map((f, i) => (
                      <span key={i} className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm">
                        <span className="truncate max-w-[200px]">{f.name}</span>
                        <button type="button" className="text-slate-400 hover:text-red-500" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}>&times;</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button type="button" variant="secondary" onClick={() => { setComposeOpen(false); setFiles([]); }}>
                  Descartar
                </Button>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700" disabled={!emailTo.trim() || !emailSubject.trim() || saving}>
                  <Send className="h-4 w-4 mr-2" />
                  {saving ? "Guardando..." : "Enviar"}
                </Button>
              </div>
            </div>
          </form>
        ) : null}
      </div>

      <div className="min-h-[400px] p-8 bg-slate-50/30">
        {!filteredNotes.length ? (
          <EmptyState title="No se encontró ningún registro de email" description="Aquí podrás ver el registro de todos los emails que se envían al paciente." />
        ) : (
          <div className="mx-auto max-w-4xl space-y-4">
            {filteredNotes.map((note) => (
              <NoteCard key={note.id} icon={<Mail className="h-5 w-5 text-sky-600" />} note={note.note} createdAt={note.createdAt} attachments={note.attachments} />
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
  let displayNote = note;
  if (displayNote.startsWith("[CRM_EMAIL]\n")) displayNote = displayNote.replace("[CRM_EMAIL]\n", "");
  else if (displayNote.startsWith("[CRM_EMAIL]")) displayNote = displayNote.replace("[CRM_EMAIL]", "");
  
  const isHtml = displayNote.includes("<") && displayNote.includes(">");
  
  if (isHtml) {
    return (
      <article className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3">
        {icon ? <div className="mt-0.5">{icon}</div> : null}
        <div className="min-w-0 flex-1">
          <div
            className="prose prose-sm max-w-none text-slate-700 break-words prose-p:my-1 prose-ul:my-1 prose-ol:my-1 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:list-item [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5"
            dangerouslySetInnerHTML={{ __html: displayNote }}
          />
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
  error,
  children
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="space-y-1 text-sm text-slate-700 flex flex-col">
      <span>{label}</span>
      {children}
      {error ? <span className="text-xs text-red-500">{error}</span> : null}
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

