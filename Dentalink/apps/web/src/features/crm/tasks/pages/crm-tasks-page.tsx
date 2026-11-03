import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Search,
  UserRound,
  XCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { usePatients } from "@/features/patients/hooks/use-patients";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useUsersQuery } from "@/features/settings/users/hooks/use-users";
import { usePermissions } from "@/hooks/use-permissions";
import { useBranchStore } from "@/stores/branch.store";
import { cn } from "@/lib/utils/cn";
import {
  useCrmTask,
  useCrmTaskHistory,
  useCrmTaskMutations,
  useCrmTasks
} from "../hooks/use-crm-tasks";
import {
  zonedLocalToIso,
  type CrmTask,
  type CrmTaskPriority,
  type CrmTaskType
} from "../services/crm-tasks.service";

const TASK_TYPES: Array<{ value: CrmTaskType; label: string }> = [
  { value: "CITA", label: "Cita" },
  { value: "COBRANZA", label: "Cobranza" },
  { value: "CAPTURA", label: "Captura" },
  { value: "CONTROL", label: "Control" },
  { value: "PERSONALIZADA", label: "Personalizada" }
];

function localDateInput(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function shiftDate(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date(`${value}T12:00:00`)
  );
}

function fullName(user?: { firstName: string; lastName: string } | null) {
  return user ? `${user.firstName} ${user.lastName}`.trim() : "Sin responsable";
}

function typeLabel(type: string) {
  return TASK_TYPES.find((item) => item.value === type)?.label ?? type;
}

function taskTone(type: string) {
  if (type === "COBRANZA") return "warning" as const;
  if (type === "CITA") return "brand" as const;
  if (type === "CONTROL") return "success" as const;
  return "default" as const;
}

export function CrmTasksPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const { hasPermission } = usePermissions();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const selectedTaskId = searchParams.get("taskId") ?? undefined;
  const [selectedDate, setSelectedDate] = useState(searchParams.get("date") ?? localDateInput());
  const [activeTab, setActiveTab] = useState<"today" | "overdue">(
    searchParams.get("tab") === "overdue" ? "overdue" : "today"
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [patientId, setPatientId] = useState("");
  const [formType, setFormType] = useState<CrmTaskType>("CITA");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [dueDate, setDueDate] = useState(selectedDate);
  const [dueTime, setDueTime] = useState("09:00");
  const [priority, setPriority] = useState<CrmTaskPriority>("NORMAL");
  const [formAssignedToId, setFormAssignedToId] = useState("");

  const branches = useBranches(undefined, "ACTIVE");
  const branch = branches.data?.find((item) => item.id === activeBranchId);
  const timezone = branch?.timezone || "America/Mexico_City";
  const patients = usePatients({ branchId: activeBranchId, status: "ACTIVE", pageSize: 100 });
  const users = useUsersQuery(undefined, "ACTIVE", activeBranchId);
  const tasks = useCrmTasks(
    {
      branchId: activeBranchId,
      ...(activeTab === "overdue" ? { overdue: "true" as const } : { date: selectedDate }),
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      ...(status ? { status: status as "PENDING" | "COMPLETED" | "CANCELLED" } : {}),
      ...(type ? { type: type as CrmTaskType } : {}),
      ...(assignedToId ? { assignedToId } : {}),
      page,
      pageSize: 25,
      sortBy: "dueDate",
      sortOrder: "asc"
    },
    Boolean(activeBranchId)
  );
  const selectedTask = useCrmTask(selectedTaskId);
  const history = useCrmTaskHistory(selectedTaskId);
  const mutations = useCrmTaskMutations(activeBranchId);

  const canCreate = hasPermission("crm.tasks.create") || hasPermission("patients.tasks.create");
  const canUpdate = hasPermission("crm.tasks.update") || hasPermission("patients.tasks.update");
  const canComplete = hasPermission("crm.tasks.complete") || hasPermission("patients.tasks.complete");
  const canReopen = hasPermission("crm.tasks.reopen") || canUpdate;
  const canCancel = hasPermission("crm.tasks.cancel") || canUpdate;

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => setPage(1), [activeBranchId, activeTab, selectedDate, debouncedSearch, status, type, assignedToId]);

  const setUrlState = (next: { date?: string; tab?: "today" | "overdue"; taskId?: string | null }) => {
    const params = new URLSearchParams(location.search);
    const date = next.date ?? selectedDate;
    const tab = next.tab ?? activeTab;
    params.set("date", date);
    params.set("tab", tab);
    if (next.taskId === null) params.delete("taskId");
    else if (next.taskId) params.set("taskId", next.taskId);
    navigate({ search: params.toString() }, { replace: true });
  };

  const changeDate = (value: string) => {
    setSelectedDate(value);
    setActiveTab("today");
    setUrlState({ date: value, tab: "today", taskId: null });
  };

  const changeTab = (value: "today" | "overdue") => {
    setActiveTab(value);
    setUrlState({ tab: value, taskId: null });
  };

  const resetForm = () => {
    setPatientId("");
    setFormType("CITA");
    setTitle("");
    setDetail("");
    setDueDate(selectedDate);
    setDueTime("09:00");
    setPriority("NORMAL");
    setFormAssignedToId("");
  };

  const openEdit = (task: CrmTask) => {
    setPatientId(task.patientId);
    setFormType(task.type);
    setTitle(task.title);
    setDetail(task.detail);
    const localDue = task.dueDate
      ? new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
          new Date(task.dueDate)
        )
      : selectedDate;
    const localTime = task.dueDate
      ? new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(
          new Date(task.dueDate)
        )
      : "09:00";
    setDueDate(localDue);
    setDueTime(localTime);
    setPriority(task.priority);
    setFormAssignedToId(task.assignedToId ?? "");
    setEditOpen(true);
  };

  const submitCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    await mutations.create.mutateAsync({
      idempotencyKey: crypto.randomUUID(),
      payload: {
        branchId: activeBranchId,
        patientId,
        type: formType,
        title: title.trim(),
        detail: detail.trim(),
        dueAt: zonedLocalToIso(dueDate, dueTime, timezone),
        priority,
        assignedToId: formAssignedToId || undefined
      }
    });
    setCreateOpen(false);
    resetForm();
  };

  const submitEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTask.data) return;
    await mutations.update.mutateAsync({
      id: selectedTask.data.id,
      payload: {
        type: formType,
        title: title.trim(),
        detail: detail.trim(),
        dueAt: zonedLocalToIso(dueDate, dueTime, timezone),
        priority,
        assignedToId: formAssignedToId || null,
        version: selectedTask.data.version
      }
    });
    setEditOpen(false);
  };

  const submitCancel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTask.data) return;
    await mutations.cancel.mutateAsync({
      id: selectedTask.data.id,
      version: selectedTask.data.version,
      reason: cancelReason.trim()
    });
    setCancelOpen(false);
    setCancelReason("");
  };

  if (!activeBranchId) return <EmptyState title="Selecciona una sucursal" description="La consulta CRM requiere una sucursal activa." />;
  if (tasks.isLoading) return <LoadingState message="Cargando tareas de gestión..." />;
  if (tasks.isError) return <ErrorState message={tasks.error.message} />;

  const totalPages = Math.max(1, Math.ceil((tasks.data?.total ?? 0) / 25));
  const task = selectedTask.data;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Tareas de gestión</h1>
          <p className="mt-0.5 text-sm font-medium capitalize text-slate-500">{formatDateLabel(selectedDate)}</p>
        </div>
        {canCreate ? (
          <Button onClick={() => { resetForm(); setCreateOpen(true); }} className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700">
            <Plus className="h-4 w-4" /> Nueva Tarea de Gestión
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col items-start gap-6 lg:flex-row">
        <div className={cn("w-full flex-1", task ? "hidden lg:block lg:w-[55%]" : "")}>
          <div className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200">
              <div className="flex border-b border-slate-200 bg-slate-50/80 px-4">
                <button onClick={() => changeTab("today")} className={cn("border-b-2 px-4 py-3.5 text-sm font-semibold", activeTab === "today" ? "border-blue-600 bg-white text-blue-700" : "border-transparent text-slate-600")}>
                  Tareas del día
                </button>
                <button onClick={() => changeTab("overdue")} className={cn("flex items-center gap-2 border-b-2 px-4 py-3.5 text-sm font-semibold", activeTab === "overdue" ? "border-red-600 bg-white text-red-700" : "border-transparent text-slate-600")}>
                  Tareas atrasadas
                  {(tasks.data?.overdueCount ?? 0) > 0 ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">{tasks.data?.overdueCount}</span> : null}
                </button>
              </div>

              {activeTab === "today" ? (
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
                  <Button variant="ghost" size="sm" onClick={() => changeDate(shiftDate(selectedDate, -1))}><ChevronLeft className="h-4 w-4" /> Anterior</Button>
                  <Input aria-label="Fecha de tareas" type="date" value={selectedDate} onChange={(event) => changeDate(event.target.value)} className="w-40" />
                  <Button variant="ghost" size="sm" onClick={() => changeDate(shiftDate(selectedDate, 1))}>Siguiente <ChevronRight className="h-4 w-4" /></Button>
                </div>
              ) : null}

              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="relative sm:col-span-2 xl:col-span-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input placeholder="Buscar por título, paciente o descripción..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="pl-9" />
                </div>
                <Select aria-label="Estado" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">Todos los estados</option>
                  <option value="PENDING">Pendientes</option>
                  <option value="COMPLETED">Completadas</option>
                  <option value="CANCELLED">Canceladas</option>
                </Select>
                <Select aria-label="Tipo" value={type} onChange={(event) => setType(event.target.value)}>
                  <option value="">Todos los tipos</option>
                  {TASK_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
                <Select aria-label="Responsable" value={assignedToId} onChange={(event) => setAssignedToId(event.target.value)} className="sm:col-span-2">
                  <option value="">Todos los responsables</option>
                  {(users.data ?? []).map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>)}
                </Select>
              </div>
            </div>

            <div className="flex-1 bg-slate-50/50">
              {!tasks.data?.items.length ? (
                <div className="py-16"><EmptyState title="No hay tareas de gestión" description="No se encontraron tareas para los filtros actuales." /></div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {tasks.data.items.map((item) => {
                    const overdue = item.status === "PENDING" && Boolean(item.dueDate) && new Date(item.dueDate as string) < new Date();
                    return (
                      <button key={item.id} onClick={() => setUrlState({ taskId: item.id })} className={cn("flex w-full gap-4 bg-white p-4 text-left hover:bg-slate-50", selectedTaskId === item.id && "bg-blue-50/60")}>
                        <div className="pt-1">
                          {item.status === "COMPLETED" ? <CheckCircle2 className="h-[18px] w-[18px] text-emerald-500" /> : item.status === "CANCELLED" ? <XCircle className="h-[18px] w-[18px] text-slate-400" /> : <div className={cn("h-4 w-4 rounded border-2", overdue ? "border-red-500 bg-red-50" : "border-slate-300")} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-start justify-between gap-2">
                            <span className={cn("truncate text-sm font-bold", item.status !== "PENDING" ? "text-slate-500 line-through" : "text-slate-800")}>{item.title}</span>
                            <Badge value={typeLabel(item.type)} tone={taskTone(item.type)} />
                          </div>
                          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-600"><UserRound size={12} /> {item.patient.firstName} {item.patient.lastName}</div>
                          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                            <span className={cn("flex items-center gap-1 font-medium", overdue && "text-red-600")}><Clock size={12} /> {item.dueDate ? new Intl.DateTimeFormat("es-MX", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(item.dueDate)) : "Sin fecha"}</span>
                            <span className="flex items-center gap-1"><MapPin size={12} /> {item.branch.name}</span>
                            <span>{fullName(item.assignedTo)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
              <span>{tasks.data?.total ?? 0} tareas</span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</Button>
                <span>{page} / {totalPages}</span>
                <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Siguiente</Button>
              </div>
            </div>
          </div>
        </div>

        {selectedTaskId ? (
          <div className="w-full shrink-0 lg:w-[45%]">
            {selectedTask.isLoading ? <LoadingState message="Cargando detalle..." /> : selectedTask.isError ? <ErrorState message={selectedTask.error.message} /> : task ? (
              <div className="sticky top-[90px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-start justify-between border-b border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setUrlState({ taskId: null })} className="rounded-md bg-slate-200/50 p-1.5 text-slate-500 lg:hidden"><ArrowLeft size={16} /></button>
                    <div>
                      <div className="mb-1.5 flex gap-2"><Badge value={typeLabel(task.type)} tone={taskTone(task.type)} /><Badge value={task.status === "PENDING" ? "Pendiente" : task.status === "COMPLETED" ? "Completada" : "Cancelada"} tone={task.status === "COMPLETED" ? "success" : task.status === "CANCELLED" ? "default" : "warning"} /></div>
                      <h2 className="text-lg font-bold text-slate-800">{task.title}</h2>
                    </div>
                  </div>
                  <button onClick={() => setUrlState({ taskId: null })} className="hidden rounded-md p-2 text-slate-400 hover:bg-slate-200/50 lg:block" title="Cerrar detalle"><XCircle size={18} /></button>
                </div>
                <div className="max-h-[calc(100vh-220px)] space-y-5 overflow-y-auto p-5">
                  <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100"><UserRound className="text-blue-600" size={20} /></div><div><p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Paciente</p><Link to={`/patients/${task.patientId}/profile/tasks`} className="text-sm font-bold text-blue-600 hover:underline">{task.patient.firstName} {task.patient.lastName}</Link></div></div>
                  <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-100 bg-slate-50/80 p-4 text-sm">
                    <div><p className="text-[10px] font-extrabold uppercase text-slate-400"><Calendar size={12} className="mr-1 inline" />Fecha límite</p><p className="font-semibold text-slate-700">{task.dueDate ? new Intl.DateTimeFormat("es-MX", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(task.dueDate)) : "Sin fecha"}</p></div>
                    <div><p className="text-[10px] font-extrabold uppercase text-slate-400"><MapPin size={12} className="mr-1 inline" />Sucursal</p><p className="font-semibold text-slate-700">{task.branch.name}</p></div>
                    <div><p className="text-[10px] font-extrabold uppercase text-slate-400">Responsable</p><p className="font-semibold text-slate-700">{fullName(task.assignedTo)}</p></div>
                    <div><p className="text-[10px] font-extrabold uppercase text-slate-400">Origen</p><p className="font-semibold text-slate-700">{task.origin === "AUTOMATIC" ? "Automática" : "Manual"}</p></div>
                  </div>
                  <div><p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Descripción</p><div className="whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50/50 p-4 text-sm text-slate-600">{task.detail}</div></div>
                  {task.cancellationReason ? <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">Motivo de cancelación: {task.cancellationReason}</div> : null}
                  <div><p className="mb-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Historial</p>{history.isLoading ? <p className="text-sm text-slate-500">Cargando...</p> : !history.data?.length ? <p className="text-sm text-slate-500">Sin eventos.</p> : <div className="space-y-2">{history.data.map((entry) => <div key={entry.id} className="border-l-2 border-slate-200 pl-3 text-xs text-slate-600"><strong>{entry.action}</strong> · {entry.actorUser ? fullName(entry.actorUser) : "Sistema"}<br />{new Intl.DateTimeFormat("es-MX", { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(entry.createdAt))}</div>)}</div>}</div>
                  <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    {task.status === "PENDING" && canComplete ? <Button disabled={mutations.complete.isPending} onClick={() => mutations.complete.mutate({ id: task.id, version: task.version })} className="bg-emerald-600 text-white hover:bg-emerald-700"><CheckCircle2 className="mr-2 h-4 w-4" />Completar</Button> : null}
                    {task.status === "COMPLETED" && canReopen ? <Button variant="secondary" disabled={mutations.reopen.isPending} onClick={() => mutations.reopen.mutate({ id: task.id, version: task.version })}>Reabrir tarea</Button> : null}
                    {task.status === "PENDING" && canUpdate ? <Button variant="secondary" onClick={() => openEdit(task)}>Editar</Button> : null}
                    {task.status === "PENDING" && canCancel ? <Button variant="secondary" onClick={() => setCancelOpen(true)} className="text-red-700">Cancelar</Button> : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <TaskFormModal open={createOpen} title="Nueva Tarea de Gestión" onClose={() => setCreateOpen(false)} onSubmit={submitCreate} pending={mutations.create.isPending} patients={patients.data ?? []} users={users.data ?? []} patientId={patientId} setPatientId={setPatientId} type={formType} setType={setFormType} taskTitle={title} setTaskTitle={setTitle} detail={detail} setDetail={setDetail} dueDate={dueDate} setDueDate={setDueDate} dueTime={dueTime} setDueTime={setDueTime} priority={priority} setPriority={setPriority} assignedToId={formAssignedToId} setAssignedToId={setFormAssignedToId} />
      <TaskFormModal open={editOpen} title="Editar tarea" onClose={() => setEditOpen(false)} onSubmit={submitEdit} pending={mutations.update.isPending} patients={patients.data ?? []} users={users.data ?? []} patientId={patientId} setPatientId={setPatientId} type={formType} setType={setFormType} taskTitle={title} setTaskTitle={setTitle} detail={detail} setDetail={setDetail} dueDate={dueDate} setDueDate={setDueDate} dueTime={dueTime} setDueTime={setDueTime} priority={priority} setPriority={setPriority} assignedToId={formAssignedToId} setAssignedToId={setFormAssignedToId} editing />
      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancelar tarea" size="md"><form onSubmit={submitCancel} className="space-y-4"><Textarea required maxLength={500} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Motivo de cancelación" /><div className="flex justify-end gap-2"><Button type="button" variant="secondary" onClick={() => setCancelOpen(false)}>Volver</Button><Button type="submit" disabled={!cancelReason.trim() || mutations.cancel.isPending} className="bg-red-600 text-white hover:bg-red-700">Confirmar cancelación</Button></div></form></Modal>
    </div>
  );
}

type FormModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  pending: boolean;
  patients: Array<{ id: string; firstName: string; lastName: string }>;
  users: Array<{ id: string; firstName: string; lastName: string }>;
  patientId: string;
  setPatientId: (value: string) => void;
  type: CrmTaskType;
  setType: (value: CrmTaskType) => void;
  taskTitle: string;
  setTaskTitle: (value: string) => void;
  detail: string;
  setDetail: (value: string) => void;
  dueDate: string;
  setDueDate: (value: string) => void;
  dueTime: string;
  setDueTime: (value: string) => void;
  priority: CrmTaskPriority;
  setPriority: (value: CrmTaskPriority) => void;
  assignedToId: string;
  setAssignedToId: (value: string) => void;
  editing?: boolean;
};

function TaskFormModal(props: FormModalProps) {
  return (
    <Modal open={props.open} onClose={props.onClose} title={props.title} size="md">
      <form onSubmit={props.onSubmit} className="space-y-4 py-2">
        <div><label className="mb-1.5 block text-xs font-bold uppercase text-slate-700">Paciente</label><Select required disabled={props.editing} value={props.patientId} onChange={(event) => props.setPatientId(event.target.value)}><option value="">Seleccionar paciente...</option>{props.patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.firstName} {patient.lastName}</option>)}</Select></div>
        <div className="grid grid-cols-2 gap-4"><div><label className="mb-1.5 block text-xs font-bold uppercase text-slate-700">Tipo</label><Select value={props.type} onChange={(event) => props.setType(event.target.value as CrmTaskType)}>{TASK_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select></div><div><label className="mb-1.5 block text-xs font-bold uppercase text-slate-700">Prioridad</label><Select value={props.priority} onChange={(event) => props.setPriority(event.target.value as CrmTaskPriority)}><option value="LOW">Baja</option><option value="NORMAL">Normal</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></Select></div></div>
        <div><label className="mb-1.5 block text-xs font-bold uppercase text-slate-700">Título</label><Input required maxLength={160} value={props.taskTitle} onChange={(event) => props.setTaskTitle(event.target.value)} /></div>
        <div><label className="mb-1.5 block text-xs font-bold uppercase text-slate-700">Descripción</label><Textarea required maxLength={2000} value={props.detail} onChange={(event) => props.setDetail(event.target.value)} /></div>
        <div className="grid grid-cols-2 gap-4"><div><label className="mb-1.5 block text-xs font-bold uppercase text-slate-700">Fecha</label><Input required type="date" value={props.dueDate} onChange={(event) => props.setDueDate(event.target.value)} /></div><div><label className="mb-1.5 block text-xs font-bold uppercase text-slate-700">Hora</label><Input required type="time" value={props.dueTime} onChange={(event) => props.setDueTime(event.target.value)} /></div></div>
        <div><label className="mb-1.5 block text-xs font-bold uppercase text-slate-700">Responsable</label><Select value={props.assignedToId} onChange={(event) => props.setAssignedToId(event.target.value)}><option value="">Sin responsable</option>{props.users.map((user) => <option key={user.id} value={user.id}>{user.firstName} {user.lastName}</option>)}</Select></div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={props.onClose}>Cancelar</Button><Button type="submit" disabled={props.pending || !props.patientId || !props.taskTitle.trim() || !props.detail.trim()} className="bg-emerald-600 text-white hover:bg-emerald-700">{props.pending ? "Guardando..." : "Guardar tarea"}</Button></div>
      </form>
    </Modal>
  );
}
