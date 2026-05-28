import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Mail, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { cn } from "@/lib/utils/cn";
import { PatientSectionPage } from "../components/patient-section-page";
import { useAddPatientNote, usePatient } from "../hooks/use-patients";

const TASK_PREFIX = "[CRM_TASK]";
const COMMUNICATION_PREFIX = "[CRM_COMMUNICATION]";

export function PatientCrmPage() {
  const { id = "" } = useParams();
  const patientQuery = usePatient(id);
  const addNote = useAddPatientNote();
  const [activeTab, setActiveTab] = useState<"tasks" | "communications">("tasks");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [communicationType, setCommunicationType] = useState("Llamada");
  const [communicationMessage, setCommunicationMessage] = useState("");

  const crmItems = useMemo(() => {
    const notes = patientQuery.data?.notes ?? [];
    return {
      tasks: notes.filter((note) => note.note.startsWith(TASK_PREFIX)),
      communications: notes.filter((note) => note.note.startsWith(COMMUNICATION_PREFIX))
    };
  }, [patientQuery.data?.notes]);

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!taskTitle.trim()) return;

    await addNote.mutateAsync({
      id,
      isPrivate: true,
      note: [
        TASK_PREFIX,
        `Titulo: ${taskTitle.trim()}`,
        `Fecha limite: ${taskDueDate || "Sin fecha"}`,
        `Descripcion: ${taskDescription.trim() || "-"}`
      ].join("\n")
    });
    setTaskTitle("");
    setTaskDescription("");
    setTaskDueDate("");
  };

  const handleCreateCommunication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!communicationMessage.trim()) return;

    await addNote.mutateAsync({
      id,
      isPrivate: true,
      note: [
        COMMUNICATION_PREFIX,
        `Tipo: ${communicationType}`,
        `Mensaje: ${communicationMessage.trim()}`
      ].join("\n")
    });
    setCommunicationMessage("");
  };

  if (patientQuery.isLoading) return <LoadingState message="Cargando CRM del paciente..." />;
  if (patientQuery.isError) return <ErrorState message={patientQuery.error.message} />;
  if (!patientQuery.data) return <ErrorState message="Paciente no encontrado" />;

  return (
    <PatientSectionPage patientId={id} title="Paciente - CRM" description="Seguimiento vinculado al expediente del paciente.">
      <div className="flex border-b border-slate-200 text-sm font-semibold">
        <TabButton active={activeTab === "tasks"} onClick={() => setActiveTab("tasks")}>
          Tareas de seguimiento
        </TabButton>
        <TabButton active={activeTab === "communications"} onClick={() => setActiveTab("communications")}>
          Registro de comunicaciones
        </TabButton>
      </div>

      {activeTab === "tasks" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="space-y-3 lg:col-span-2">
            <h3 className="text-base font-semibold text-slate-900">Tareas del paciente</h3>
            {!crmItems.tasks.length ? (
              <EmptyState title="Sin tareas" description="Las tareas que registres quedaran guardadas en este paciente." />
            ) : (
              <div className="space-y-3">
                {crmItems.tasks.map((note) => (
                  <CrmNoteCard key={note.id} icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} note={note.note} createdAt={note.createdAt} />
                ))}
              </div>
            )}
          </Card>
          <Card>
            <h3 className="mb-4 font-semibold text-slate-800">Nueva tarea</h3>
            <form className="space-y-4" onSubmit={handleCreateTask}>
              <Input placeholder="Titulo" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} />
              <Textarea placeholder="Descripcion" rows={3} value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} />
              <Input type="date" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} />
              <Button className="w-full" type="submit" disabled={!taskTitle.trim() || addNote.isPending}>
                <Plus className="h-4 w-4" />
                Agregar tarea
              </Button>
            </form>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="space-y-3 lg:col-span-2">
            <h3 className="text-base font-semibold text-slate-900">Comunicaciones del paciente</h3>
            {!crmItems.communications.length ? (
              <EmptyState title="Sin comunicaciones" description="Los contactos registrados quedaran vinculados al paciente." />
            ) : (
              <div className="space-y-3">
                {crmItems.communications.map((note) => (
                  <CrmNoteCard key={note.id} icon={<Mail className="h-5 w-5 text-sky-600" />} note={note.note} createdAt={note.createdAt} />
                ))}
              </div>
            )}
          </Card>
          <Card>
            <h3 className="mb-4 font-semibold text-slate-800">Registrar contacto</h3>
            <form className="space-y-4" onSubmit={handleCreateCommunication}>
              <Select value={communicationType} onChange={(event) => setCommunicationType(event.target.value)}>
                <option>Llamada</option>
                <option>Email</option>
                <option>SMS</option>
                <option>WhatsApp</option>
                <option>Presencial</option>
              </Select>
              <Textarea placeholder="Mensaje o notas" rows={4} value={communicationMessage} onChange={(event) => setCommunicationMessage(event.target.value)} />
              <Button className="w-full" type="submit" disabled={!communicationMessage.trim() || addNote.isPending}>
                <Send className="h-4 w-4" />
                Guardar registro
              </Button>
            </form>
          </Card>
        </div>
      )}
    </PatientSectionPage>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-b-2 px-4 py-3 transition-colors",
        active ? "border-slate-800 text-slate-800" : "border-transparent text-slate-500 hover:text-slate-700"
      )}
    >
      {children}
    </button>
  );
}

function CrmNoteCard({ icon, note, createdAt }: { icon: ReactNode; note: string; createdAt: string }) {
  const lines = note.split("\n").slice(1);
  return (
    <article className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        {lines.map((line) => (
          <p key={line} className="break-words text-sm text-slate-700">
            {line}
          </p>
        ))}
        <p className="mt-2 text-xs text-slate-400">{new Date(createdAt).toLocaleString("es-MX")}</p>
      </div>
    </article>
  );
}
