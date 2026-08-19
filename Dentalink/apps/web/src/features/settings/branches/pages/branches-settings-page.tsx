import { useMemo, useState } from "react";
import { Plus, Building2, Edit, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import {
  useBranches,
  useCreateBranch,
  useUpdateBranch,
  normalizeName
} from "../hooks/use-branches";
import type { Branch, BranchPayload } from "../services/branches.service";

type BranchFormData = {
  code: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  country: string;
  timezone: string;
  agendaSlotMinutes: string;
  agendaStartHour: string;
  agendaEndHour: string;
  status: "ACTIVE" | "INACTIVE";
};

const DEFAULT_FORM: BranchFormData = {
  code: "",
  name: "",
  phone: "",
  email: "",
  city: "",
  state: "",
  country: "MX",
  timezone: "America/Mexico_City",
  agendaSlotMinutes: "30",
  agendaStartHour: "10",
  agendaEndHour: "19",
  status: "ACTIVE"
};

export function BranchesSettingsPage() {
  const branches = useBranches();
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();

  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("Plataforma NORTE");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState<BranchFormData>(DEFAULT_FORM);

  const filteredBranches = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return branches.data ?? [];
    return (branches.data ?? []).filter(
      (b) =>
        b.name.toLowerCase().includes(term) ||
        b.code.toLowerCase().includes(term) ||
        (b.city ?? "").toLowerCase().includes(term)
    );
  }, [branches.data, searchTerm]);

  const groupedBranches = useMemo(() => {
    const groups: Record<string, { active: Branch[]; inactive: Branch[] }> = {
      "Plataforma NORTE": { active: [], inactive: [] },
      "Plataforma SUR": { active: [], inactive: [] },
      "Plataforma DJWARNER": { active: [], inactive: [] },
      "Otras sucursales": { active: [], inactive: [] }
    };

    filteredBranches.forEach((branch) => {
      const zoneCode = branch.zone?.code?.toUpperCase();
      const norm = normalizeName(branch.name);
      
      let targetGroup = "Otras sucursales";
      if (zoneCode === "NORTE") {
        targetGroup = "Plataforma NORTE";
      } else if (zoneCode === "SUR") {
        targetGroup = "Plataforma SUR";
      } else if (zoneCode === "DJWARNER" || norm.includes("jwarner")) {
        targetGroup = "Plataforma DJWARNER";
      }

      if (branch.status === "ACTIVE") {
        groups[targetGroup].active.push(branch);
      } else {
        groups[targetGroup].inactive.push(branch);
      }
    });

    return groups;
  }, [filteredBranches]);

  const handleOpenCreate = () => {
    setEditingBranch(null);
    setFormData(DEFAULT_FORM);
    setModalOpen(true);
  };

  const handleOpenEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setFormData({
      code: branch.code,
      name: branch.name,
      phone: branch.phone ?? "",
      email: branch.email ?? "",
      city: branch.city ?? "",
      state: branch.state ?? "",
      country: "MX",
      timezone: "America/Mexico_City",
      agendaSlotMinutes: String(branch.agendaSlotMinutes ?? 30),
      agendaStartHour: String(branch.agendaStartHour ?? 10),
      agendaEndHour: String(branch.agendaEndHour ?? 19),
      status: branch.status
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      agendaSlotMinutes: formData.agendaSlotMinutes ? Number(formData.agendaSlotMinutes) : undefined,
      agendaStartHour: formData.agendaStartHour ? Number(formData.agendaStartHour) : undefined,
      agendaEndHour: formData.agendaEndHour ? Number(formData.agendaEndHour) : undefined
    };

    if (editingBranch) {
      await updateBranch.mutateAsync({ id: editingBranch.id, payload: payload as Partial<BranchPayload> & { status: "ACTIVE" | "INACTIVE" } });
    } else {
      await createBranch.mutateAsync(payload as BranchPayload);
    }
    setModalOpen(false);
  };

  if (branches.isLoading) return <LoadingState message="Cargando sucursales..." />;
  if (branches.isError) return <ErrorState message={branches.error?.message} />;

  const activeLists = groupedBranches[activeTab] || { active: [], inactive: [] };
  const hasActive = activeLists.active.length > 0;
  const hasInactive = activeLists.inactive.length > 0;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header de la Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
            <Building2 className="h-6 w-6 text-blue-600" />
            Configuración de Sucursales
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Administra las clínicas operativas, configuraciones de agenda y sus respectivas zonas.
          </p>
        </div>
        <Button onClick={handleOpenCreate} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all">
          <Plus className="h-4 w-4" />
          Nueva Sucursal
        </Button>
      </div>

      {/* Buscador */}
      <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
          <Input
            type="text"
            placeholder="Buscar sucursal por nombre, código o ciudad..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-white border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Selector de Pestañas (Zonas) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <Tabs
          items={[
            { key: "Plataforma NORTE", label: "PLATAFORMA NORTE" },
            { key: "Plataforma SUR", label: "PLATAFORMA SUR" },
            { key: "Plataforma DJWARNER", label: "PLATAFORMA DJWARNER" },
            { key: "Otras sucursales", label: "OTRAS SUCURSALES" }
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />
        <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
          {activeLists.active.length} activas {hasInactive ? `· ${activeLists.inactive.length} inactivas` : ""}
        </span>
      </div>

      {/* Contenedor de la Tabla */}
      <div className="min-h-[300px]">
        {hasActive || hasInactive ? (
          <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-xs">
            <Table>
              <TableHead>
                <TableRow className="border-b border-slate-200/80 bg-slate-50/70 hover:bg-slate-50/70">
                  <TableHeader className="w-[120px] py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Código</TableHeader>
                  <TableHeader className="py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Nombre</TableHeader>
                  <TableHeader className="py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Ciudad</TableHeader>
                  <TableHeader className="py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Horario Agenda</TableHeader>
                  <TableHeader className="py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Intervalo</TableHeader>
                  <TableHeader className="w-[120px] py-3 font-bold text-slate-600 text-[11px] uppercase tracking-wider">Estado</TableHeader>
                  <TableHeader className="w-[110px] py-3 text-right font-bold text-slate-600 text-[11px] uppercase tracking-wider">Acciones</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Sucursales Activas */}
                {activeLists.active.map((branch) => (
                  <TableRow key={branch.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                    <TableCell className="py-3.5">
                      <span className="text-[11px] font-semibold font-mono tracking-wide text-slate-600 bg-slate-100 px-2 py-0.5 rounded uppercase">
                        {branch.code}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 font-bold text-slate-900 text-sm">
                      {branch.name}
                    </TableCell>
                    <TableCell className="py-3.5 text-xs text-slate-600">{branch.city || "—"}</TableCell>
                    <TableCell className="py-3.5 text-xs text-slate-600">
                      {formatHour(branch.agendaStartHour ?? 10)} - {formatHour(branch.agendaEndHour ?? 19)}
                    </TableCell>
                    <TableCell className="py-3.5 text-xs font-mono text-slate-600">
                      {branch.agendaSlotMinutes ?? 30} min
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Badge value="Activa" tone="success" />
                    </TableCell>
                    <TableCell className="py-3.5 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 px-2.5 text-xs font-medium border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-400 shadow-2xs gap-1.5 transition-all"
                        onClick={() => handleOpenEdit(branch)}
                        title="Editar sucursal"
                      >
                        <Edit className="h-3.5 w-3.5 text-slate-500" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {/* Fila divisoria si existen ambas */}
                {hasActive && hasInactive && (
                  <TableRow>
                    <TableCell colSpan={7} className="bg-slate-50/80 py-2 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest pointer-events-none border-y border-slate-200/60">
                      Sucursales Fuera de Servicio
                    </TableCell>
                  </TableRow>
                )}

                {/* Sucursales Inactivas */}
                {activeLists.inactive.map((branch) => (
                  <TableRow key={branch.id} className="bg-slate-50/30 opacity-70 hover:opacity-90 border-b border-slate-100 last:border-0">
                    <TableCell className="py-3.5">
                      <span className="text-[11px] font-semibold font-mono tracking-wide text-slate-400 bg-slate-100 px-2 py-0.5 rounded uppercase">
                        {branch.code}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 font-bold text-slate-400 line-through text-sm">
                      {branch.name}
                    </TableCell>
                    <TableCell className="py-3.5 text-xs text-slate-400">{branch.city || "—"}</TableCell>
                    <TableCell className="py-3.5 text-xs text-slate-400">
                      {formatHour(branch.agendaStartHour ?? 10)} - {formatHour(branch.agendaEndHour ?? 19)}
                    </TableCell>
                    <TableCell className="py-3.5 text-xs font-mono text-slate-400">
                      {branch.agendaSlotMinutes ?? 30} min
                    </TableCell>
                    <TableCell className="py-3.5">
                      <Badge value="Inactiva" tone="danger" />
                    </TableCell>
                    <TableCell className="py-3.5 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 px-2.5 text-xs font-medium border border-slate-200 text-slate-500 bg-white hover:bg-slate-50 shadow-2xs gap-1.5 transition-all"
                        onClick={() => handleOpenEdit(branch)}
                        title="Editar sucursal"
                      >
                        <Edit className="h-3.5 w-3.5 text-slate-400" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-100 text-slate-400 min-h-[300px]">
            <Building2 className="h-10 w-10 text-slate-300 mb-2" />
            <p className="text-sm">No se encontraron sucursales en esta zona.</p>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBranch ? "Editar Sucursal" : "Nueva Sucursal"}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-600">Código *</label>
              <Input
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="Ej. SUC-01"
                disabled={Boolean(editingBranch)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-600">Nombre *</label>
              <Input
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej. Clínica Centro"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-600">Ciudad</label>
              <Input
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-600">Estado</label>
              <Input
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-600">Teléfono</label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-600">Correo</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6">
            <h4 className="font-semibold text-slate-800 mb-4">Configuración de Agenda</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600">Intervalo</label>
                <Select
                  value={formData.agendaSlotMinutes}
                  onChange={(e) => setFormData({ ...formData, agendaSlotMinutes: e.target.value })}
                >
                  <option value="10">10 minutos</option>
                  <option value="20">20 minutos</option>
                  <option value="30">30 minutos</option>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600">Hora inicio</label>
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={formData.agendaStartHour}
                  onChange={(e) => setFormData({ ...formData, agendaStartHour: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-600">Hora fin</label>
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={formData.agendaEndHour}
                  onChange={(e) => setFormData({ ...formData, agendaEndHour: e.target.value })}
                />
              </div>
            </div>
          </div>

          {editingBranch && (
            <div className="border-t border-slate-100 pt-6">
               <div className="space-y-1.5 md:w-1/3">
                <label className="text-sm font-medium text-slate-600">Estado Operativo</label>
                <Select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as "ACTIVE" | "INACTIVE" })}
                >
                  <option value="ACTIVE">Activa</option>
                  <option value="INACTIVE">Inactiva</option>
                </Select>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-4">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createBranch.isPending || updateBranch.isPending}>
              {createBranch.isPending || updateBranch.isPending ? "Guardando..." : "Guardar Sucursal"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}
