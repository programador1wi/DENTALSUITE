import { ChangeEvent, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { useOrganizationSettings, useUpdateOrganizationSettings } from "../hooks/use-organization";
import { useBrands, useCreateBrand, useUpdateBrand, useDeleteBrand } from "../hooks/use-brands";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Trash2, Pencil, Image as ImageIcon, Plus, Upload, ShieldCheck, FileSpreadsheet, Receipt, FileText, CheckCircle2 } from "lucide-react";
import type { BranchBrand } from "../services/brands.service";
import { cn } from "@/lib/utils/cn";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

function ImageUploader({ 
  value, 
  onChange, 
  onError,
  title = "Archivo de imagen (JPG, PNG, WebP)"
}: { 
  value: string | null; 
  onChange: (value: string | null) => void; 
  onError: (msg: string) => void;
  title?: string;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = (file: File) => {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      onError("El logotipo debe ser una imagen JPG, PNG o WebP.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onError("");
      onChange(String(reader.result ?? ""));
    };
    reader.onerror = () => onError("No se pudo leer el archivo seleccionado.");
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-slate-700 block">{title}</span>
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center transition-all cursor-pointer group min-h-[130px]",
          isDragging 
            ? "border-[#0879d5] bg-blue-50/60 scale-[0.99]" 
            : value 
              ? "border-slate-200 bg-slate-50/60 hover:border-slate-300" 
              : "border-slate-200 bg-white hover:border-[#0879d5] hover:bg-slate-50/50"
        )}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="absolute inset-0 z-10 opacity-0 cursor-pointer w-full h-full"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />

        {value ? (
          <div className="flex flex-col items-center gap-2">
            <div className="relative rounded-xl border border-slate-200 bg-white p-2 shadow-sm max-w-[220px] flex items-center justify-center">
              <img src={value} alt="Vista previa del logotipo" className="h-[64px] max-w-[200px] object-contain" />
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0879d5] group-hover:underline z-20">
              <Upload className="h-3.5 w-3.5" />
              <span>Haz clic o arrastra para cambiar imagen</span>
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 py-1">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-[#0879d5] group-hover:scale-110 transition-transform">
              <Upload className="h-5 w-5" />
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-slate-700">
                <span className="text-[#0879d5]">Seleccionar archivo</span> o arrastra la imagen aquí
              </p>
              <p className="text-[11px] text-slate-400 font-medium">Formatos permitidos: JPG, PNG o WebP</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BrandModal({ 
  brand, 
  open, 
  onClose 
}: { 
  brand: BranchBrand | null; 
  open: boolean; 
  onClose: () => void 
}) {
  const isEditing = !!brand;
  const [name, setName] = useState(brand?.name || "");
  const [draftLogo, setDraftLogo] = useState<string | null>(brand?.logoUrl || null);
  const [selectedBranches, setSelectedBranches] = useState<Set<string>>(new Set(brand?.branches.map(b => b.id) || []));
  const [error, setError] = useState("");
  const [activeZoneTab, setActiveZoneTab] = useState<string | null>(null);
  
  const branches = useBranches(undefined, "ACTIVE");
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();

  const toggleBranch = (id: string) => {
    const next = new Set(selectedBranches);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedBranches(next);
  };
  
  const groupedBranches = useMemo(() => {
    const groups: Record<string, typeof branches.data> = {};
    const ungrouped: typeof branches.data = [];

    branches.data?.forEach(b => {
      if (b.zone?.name) {
        if (!groups[b.zone.name]) groups[b.zone.name] = [];
        groups[b.zone.name]!.push(b);
      } else {
        ungrouped!.push(b);
      }
    });

    return { groups, ungrouped };
  }, [branches.data]);

  const visibleBranchIds = useMemo(() => {
    if (activeZoneTab === null) return branches.data?.map(b => b.id) || [];
    if (activeZoneTab === "OTRAS") return groupedBranches.ungrouped.map(b => b.id);
    return groupedBranches.groups[activeZoneTab]?.map(b => b.id) || [];
  }, [activeZoneTab, branches.data, groupedBranches]);

  const areAllVisibleSelected = visibleBranchIds.length > 0 && visibleBranchIds.every(id => selectedBranches.has(id));

  const handleSelectAll = () => {
    if (visibleBranchIds.length === 0) return;
    const next = new Set(selectedBranches);
    if (areAllVisibleSelected) {
      visibleBranchIds.forEach(id => next.delete(id));
    } else {
      visibleBranchIds.forEach(id => next.add(id));
    }
    setSelectedBranches(next);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError("El nombre de la marca es obligatorio");
      return;
    }
    
    const payload = {
      name: name.trim(),
      logoUrl: draftLogo || undefined,
      branchIds: Array.from(selectedBranches)
    };

    try {
      if (isEditing && brand) {
        await updateBrand.mutateAsync({ id: brand.id, payload });
      } else {
        await createBrand.mutateAsync(payload);
      }
      onClose();
    } catch (e: any) {
      setError(e.message || "Error al guardar la marca");
    }
  };

  const renderBranchLabel = (b: any) => (
    <label key={b.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer">
      <input 
        type="checkbox" 
        className="rounded border-slate-300 text-[#0879d5] focus:ring-[#0879d5]"
        checked={selectedBranches.has(b.id)}
        onChange={() => toggleBranch(b.id)}
      />
      <span className="text-sm text-slate-700">{b.name}</span>
    </label>
  );

  if (!open) return null;

  return (
    <Modal open={open} title={isEditing ? "Editar Marca / Zona" : "Nueva Marca / Zona"} onClose={onClose} size="xl">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700">Nombre de la Marca o Zona</label>
          <Input 
            className="mt-1" 
            placeholder="Ej. Zona Norte, Dental Premium..." 
            value={name} 
            onChange={e => setName(e.target.value)} 
          />
        </div>

        <div>
          <ImageUploader
            title="Logotipo específico (JPG, PNG, WebP)"
            value={draftLogo}
            onChange={(val) => {
              setError("");
              setDraftLogo(val);
            }}
            onError={setError}
          />
          {draftLogo && (
            <Button variant="ghost" size="sm" onClick={() => setDraftLogo(null)} className="mt-1 text-red-600 hover:text-red-700 hover:bg-red-50">
              Eliminar imagen
            </Button>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label className="text-sm font-medium text-slate-700 block">Sucursales asignadas a esta marca</label>
            <label className="flex items-center gap-2 cursor-pointer group hover:bg-blue-50 px-2 py-1 rounded transition-colors">
              <input 
                type="checkbox" 
                className="rounded border-slate-300 text-[#0879d5] focus:ring-[#0879d5]"
                checked={areAllVisibleSelected}
                onChange={handleSelectAll}
              />
              <span className="text-xs font-medium text-[#0879d5] group-hover:text-blue-700">
                {areAllVisibleSelected ? "Deseleccionar todas" : "Seleccionar todas"}
              </span>
            </label>
          </div>
          
          {Object.keys(groupedBranches.groups).length > 0 && (
            <div className="flex gap-2 border-b border-slate-200 mb-3 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveZoneTab(null)}
                className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeZoneTab === null 
                    ? 'border-[#0879d5] text-[#0879d5]' 
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                Todas
              </button>
              {Object.keys(groupedBranches.groups).map((zoneName) => (
                <button
                  key={zoneName}
                  type="button"
                  onClick={() => setActiveZoneTab(zoneName)}
                  className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeZoneTab === zoneName 
                      ? 'border-[#0879d5] text-[#0879d5]' 
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {zoneName}
                </button>
              ))}
              {groupedBranches.ungrouped && groupedBranches.ungrouped.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveZoneTab("OTRAS")}
                  className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                    activeZoneTab === "OTRAS" 
                      ? 'border-[#0879d5] text-[#0879d5]' 
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  Otras
                </button>
              )}
            </div>
          )}

          <div className="border border-slate-200 rounded-xl bg-white max-h-[250px] overflow-y-auto divide-y divide-slate-100">
            {activeZoneTab === null ? (
              // Renderear todas
              <>
                {Object.entries(groupedBranches.groups).map(([zoneName, zoneBranches]) => (
                  <div key={zoneName}>
                    <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-100">
                      {zoneName}
                    </div>
                    <div className="divide-y divide-slate-50">
                      {zoneBranches!.map(renderBranchLabel)}
                    </div>
                  </div>
                ))}
                {groupedBranches.ungrouped && groupedBranches.ungrouped.length > 0 && (
                  <div>
                    {Object.keys(groupedBranches.groups).length > 0 && (
                      <div className="bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider sticky top-0 border-b border-t border-slate-100">
                        Otras Sucursales
                      </div>
                    )}
                    <div className="divide-y divide-slate-50">
                      {groupedBranches.ungrouped.map(renderBranchLabel)}
                    </div>
                  </div>
                )}
              </>
            ) : activeZoneTab === "OTRAS" ? (
              <div className="divide-y divide-slate-50">
                {groupedBranches.ungrouped?.map(renderBranchLabel)}
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {groupedBranches.groups[activeZoneTab]?.map(renderBranchLabel)}
              </div>
            )}
            
            {!branches.data?.length && <p className="p-4 text-sm text-slate-500 text-center">No hay sucursales activas.</p>}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

        <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={createBrand.isPending || updateBrand.isPending}>
            {createBrand.isPending || updateBrand.isPending ? "Guardando..." : "Guardar Marca"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function OrganizationLogoSettingsPage() {
  const organization = useOrganizationSettings();
  const update = useUpdateOrganizationSettings();
  
  const brands = useBrands();
  const deleteBrand = useDeleteBrand();

  const [draftGlobalLogo, setDraftGlobalLogo] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState("");
  
  const [editingBrand, setEditingBrand] = useState<BranchBrand | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (organization.isLoading || brands.isLoading) return <LoadingState message="Cargando configuración de marcas..." />;
  if (organization.isError) return <ErrorState message={organization.error.message} />;

  const globalLogoUrl = draftGlobalLogo ?? organization.data?.logoUrl ?? "";

  const handleDeleteBrand = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar la marca ${name}? Las sucursales asignadas volverán a usar el logotipo global.`)) {
      await deleteBrand.mutateAsync(id);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Logotipos y Marcas"
        description="Administra la imagen institucional global y los logotipos específicos por zona o sucursal."
        helpText="Si una sucursal no tiene una marca específica asignada, usará automáticamente el Logotipo Global en todos sus documentos."
      />

      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-800">Logotipo Institucional (Global)</h3>
        <Card className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Image Uploader & Action Buttons */}
            <div className="lg:col-span-5 space-y-4">
              <ImageUploader
                title="Archivo de imagen (JPG, PNG, WebP)"
                value={globalLogoUrl}
                onChange={(val) => {
                  setGlobalError("");
                  setDraftGlobalLogo(val ?? "");
                }}
                onError={setGlobalError}
              />

              {globalError ? <p className="text-sm text-red-600 font-medium">{globalError}</p> : null}

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  onClick={() => update.mutate({ logoUrl: globalLogoUrl })}
                  disabled={update.isPending || globalLogoUrl === (organization.data?.logoUrl ?? "")}
                >
                  {update.isPending ? "Guardando..." : "Guardar logotipo global"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDraftGlobalLogo("");
                    update.mutate({ logoUrl: "" });
                  }}
                  disabled={update.isPending || !globalLogoUrl}
                >
                  Eliminar logotipo
                </Button>
              </div>
            </div>

            {/* Right Column: Usage & Scope Information */}
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-4">
              <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm border-b border-slate-200 pb-3">
                <ShieldCheck className="h-5 w-5 text-[#0879d5]" />
                <span>Alcance y Uso del Logotipo Global</span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Este logotipo funciona como la imagen institucional predeterminada de tu clínica. Se incluirá automáticamente en los siguientes documentos:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-100 shadow-2xs">
                  <FileSpreadsheet className="h-4 w-4 text-[#0879d5] shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-semibold text-slate-800">Presupuestos</h5>
                    <p className="text-[11px] text-slate-500">Planes de tratamiento y cotizaciones</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-100 shadow-2xs">
                  <Receipt className="h-4 w-4 text-[#0879d5] shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-semibold text-slate-800">Facturación y Pagos</h5>
                    <p className="text-[11px] text-slate-500">Recibos y comprobantes fiscales</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-100 shadow-2xs">
                  <FileText className="h-4 w-4 text-[#0879d5] shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-semibold text-slate-800">Recetas y Fichas</h5>
                    <p className="text-[11px] text-slate-500">Documentación e historial clínico</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-100 shadow-2xs">
                  <CheckCircle2 className="h-4 w-4 text-[#0879d5] shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-semibold text-slate-800">Sucursales Base</h5>
                    <p className="text-[11px] text-slate-500">Sucursales sin marca específica</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">Marcas y Zonas Específicas</h3>
          <Button onClick={() => { setEditingBrand(null); setIsModalOpen(true); }}>
            <Plus className="mr-1.5 h-4 w-4" />
            Crear Marca
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.data?.map(brand => (
            <Card key={brand.id} className="p-0 overflow-hidden flex flex-col">
              <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-center h-[120px]">
                {brand.logoUrl ? (
                  <img src={brand.logoUrl} alt={brand.name} className="h-full max-h-[80px] object-contain" />
                ) : (
                  <div className="text-center text-slate-400">
                    <ImageIcon className="h-8 w-8 mx-auto mb-1 opacity-50" />
                    <span className="text-xs">Sin logotipo</span>
                  </div>
                )}
              </div>
              <div className="p-4 flex-1">
                <h4 className="font-semibold text-slate-800">{brand.name}</h4>
                <p className="text-sm text-slate-500 mt-1">
                  {brand.branches.length} {brand.branches.length === 1 ? "sucursal asignada" : "sucursales asignadas"}
                </p>
                {brand.branches.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {brand.branches.slice(0, 5).map(b => (
                      <span key={b.id} className="inline-flex items-center rounded bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                        {b.name}
                      </span>
                    ))}
                    {brand.branches.length > 5 && (
                      <span 
                        className="inline-flex items-center rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-500/10 cursor-help"
                        title={brand.branches.slice(5).map(b => b.name).join(", ")}
                      >
                        + {brand.branches.length - 5} más
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-slate-100 bg-white flex justify-end gap-1">
                <Button variant="ghost" size="sm" onClick={() => { setEditingBrand(brand); setIsModalOpen(true); }}>
                  <Pencil className="h-4 w-4 text-slate-500" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteBrand(brand.id, brand.name)}>
                  <Trash2 className="h-4 w-4 text-red-500 hover:text-red-600" />
                </Button>
              </div>
            </Card>
          ))}
          {!brands.data?.length && (
            <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center">
              <ImageIcon className="mx-auto h-8 w-8 text-slate-400" />
              <h3 className="mt-2 text-sm font-semibold text-slate-900">Sin marcas adicionales</h3>
              <p className="mt-1 text-sm text-slate-500">Todas las sucursales están usando el logotipo global.</p>
            </div>
          )}
        </div>
      </section>

      {isModalOpen && (
        <BrandModal 
          brand={editingBrand} 
          open={isModalOpen} 
          onClose={() => { setIsModalOpen(false); setEditingBrand(null); }} 
        />
      )}
    </div>
  );
}
