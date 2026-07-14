import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Archive, Building2, ChevronDown, Edit, Eye, Plus, RotateCcw, Search, Store, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { useUpdateBranch } from "@/features/settings/branches/hooks/use-branches";
import type { Branch, BranchPayload } from "@/features/settings/branches/services/branches.service";
import {
  useArchiveBrand,
  useCreateBrand,
  useCreateHealthCenterBranch,
  useHealthCenter,
  useRestoreBrand,
  useUpdateBrand
} from "../hooks/use-health-center";
import type { BrandPayload, HealthCenterBrand } from "../services/health-center.service";

type BrandFormState = {
  name: string;
  legalName: string;
  shortName: string;
  slug: string;
  description: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  domain: string;
  publicDomain: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  phone: string;
  website: string;
  privacyNoticeUrl: string;
  isDefault: boolean;
};

type BranchFormState = {
  brandId: string;
  code: string;
  name: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
  address: string;
  exteriorNumber: string;
  interiorNumber: string;
  neighborhood: string;
  postalCode: string;
  country: string;
  state: string;
  city: string;
  municipality: string;
  references: string;
  timezone: string;
  countryCode: string;
  phone: string;
  secondaryPhone: string;
  email: string;
  replyToEmail: string;
  website: string;
  showInEmails: boolean;
  showInDocuments: boolean;
  showInOnlineScheduling: boolean;
  allowOnlineAppointments: boolean;
  allowNotifications: boolean;
};

const emptyBrandForm: BrandFormState = {
  name: "",
  legalName: "",
  shortName: "",
  slug: "",
  description: "",
  logoUrl: "",
  primaryColor: "#0f766e",
  secondaryColor: "#0f172a",
  accentColor: "",
  domain: "",
  publicDomain: "",
  senderName: "",
  senderEmail: "",
  replyToEmail: "",
  phone: "",
  website: "",
  privacyNoticeUrl: "",
  isDefault: false
};

const emptyBranchForm: BranchFormState = {
  brandId: "",
  code: "",
  name: "",
  description: "",
  status: "ACTIVE",
  address: "",
  exteriorNumber: "",
  interiorNumber: "",
  neighborhood: "",
  postalCode: "",
  country: "MX",
  state: "",
  city: "",
  municipality: "",
  references: "",
  timezone: "America/Mexico_City",
  countryCode: "+52",
  phone: "",
  secondaryPhone: "",
  email: "",
  replyToEmail: "",
  website: "",
  showInEmails: true,
  showInDocuments: true,
  showInOnlineScheduling: true,
  allowOnlineAppointments: true,
  allowNotifications: true
};

export function HealthCenterPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [activeBrandId, setActiveBrandId] = useState<string>("");
  const [brandModal, setBrandModal] = useState<{ mode: "create" | "edit"; brand?: HealthCenterBrand } | null>(null);
  const [branchModal, setBranchModal] = useState<{ mode: "create" | "edit"; brandId?: string; branch?: Branch } | null>(null);
  const [viewBrandDetails, setViewBrandDetails] = useState<HealthCenterBrand | null>(null);
  const [viewBranchDetails, setViewBranchDetails] = useState<Branch | null>(null);

  const query = useHealthCenter({ search, status });
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();
  const archiveBrand = useArchiveBrand();
  const restoreBrand = useRestoreBrand();
  const createBranch = useCreateHealthCenterBranch();
  const updateBranch = useUpdateBranch();

  const brands = query.data?.brands ?? [];
  const totals = useMemo(
    () => ({
      brands: brands.length,
      branches: brands.reduce((sum, brand) => sum + brand.branchCount, 0),
      active: brands.filter((brand) => brand.status === "ACTIVE").length
    }),
    [brands]
  );

  useEffect(() => {
    if (brands.length > 0) {
      const alreadyActiveExists = brands.some((b) => b.id === activeBrandId);
      if (!alreadyActiveExists) {
        const defaultBrand = brands.find((b) => b.isDefault) ?? brands[0];
        setActiveBrandId(defaultBrand.id);
      }
    } else {
      setActiveBrandId("");
    }
  }, [brands, activeBrandId]);

  const onArchiveBrand = async (brand: HealthCenterBrand) => {
    if (!window.confirm(`¿Archivar ${brand.name}?`)) return;
    try {
      await archiveBrand.mutateAsync(brand.id);
      toast.success("Marca archivada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible archivar la marca.");
    }
  };

  const onRestoreBrand = async (brand: HealthCenterBrand) => {
    try {
      await restoreBrand.mutateAsync(brand.id);
      toast.success("Marca restaurada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible restaurar la marca.");
    }
  };

  const activeBrand = useMemo(() => brands.find((b) => b.id === activeBrandId), [brands, activeBrandId]);

  if (query.isLoading) return <LoadingState message="Cargando Mi centro de salud..." />;
  if (query.isError) return <ErrorState message={query.error.message} />;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5">
      <PageHeader
        title="Mi centro de salud"
        description="Administra las marcas, sucursales e identidad comercial de tu organización."
      />

      <div className="grid gap-3 md:grid-cols-3">
        <Metric icon={Store} label="Marcas" value={totals.brands} />
        <Metric icon={Building2} label="Sucursales visibles" value={totals.branches} />
        <Metric icon={UsersRound} label="Marcas activas" value={totals.active} />
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar marca, sucursal, ciudad, estado, código o dominio"
                className="pl-9"
              />
            </div>
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="ALL">Todas las marcas</option>
              <option value="ACTIVE">Marcas activas</option>
              <option value="ARCHIVED">Marcas archivadas</option>
            </Select>
          </div>
          {query.data?.permissions.canCreateBrand ? (
            <Button onClick={() => setBrandModal({ mode: "create" })}>
              <Plus size={16} />
              Nueva marca
            </Button>
          ) : null}
        </div>
      </Card>

      {brands.length ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2 overflow-x-auto">
            <Tabs
              items={brands.map((b) => ({ key: b.id, label: b.name }))}
              active={activeBrandId}
              onChange={setActiveBrandId}
            />
          </div>

          {activeBrand && (
            <Card className="p-0">
              {/* Brand Header */}
              <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between border-b border-[var(--border-default)]">
                <div className="flex items-center gap-3">
                  <BrandLogo brand={activeBrand} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[var(--text-lg)] font-bold text-[var(--text-primary)]">{activeBrand.name}</h2>
                      {activeBrand.isDefault ? <Badge value="Marca predeterminada" tone="brand" /> : null}
                      <Badge value={activeBrand.status === "ACTIVE" ? "Activa" : "Archivada"} tone={activeBrand.status === "ACTIVE" ? "success" : "warning"} />
                    </div>
                    <p className="mt-1 text-[var(--text-sm)] text-[var(--text-secondary)]">
                      {activeBrand.shortName || activeBrand.legalName || activeBrand.description || "Sin descripción comercial"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setViewBrandDetails(activeBrand)}>
                    <Eye size={15} />
                    Ver detalles
                  </Button>
                  {query.data?.permissions.canManage ? (
                    <Button variant="secondary" size="sm" onClick={() => setBrandModal({ mode: "edit", brand: activeBrand })}>
                      <Edit size={15} />
                      Editar
                    </Button>
                  ) : null}
                  {activeBrand.status === "ACTIVE" && !activeBrand.isDefault ? (
                    <Button variant="ghost" size="sm" onClick={() => void onArchiveBrand(activeBrand)}>
                      <Archive size={15} />
                    </Button>
                  ) : null}
                  {activeBrand.status === "ARCHIVED" ? (
                    <Button variant="ghost" size="sm" onClick={() => void onRestoreBrand(activeBrand)}>
                      <RotateCcw size={15} />
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Branch Table */}
              <BranchTable
                brand={activeBrand}
                canCreate={Boolean(query.data?.permissions.canCreateBranch)}
                canAssignBrand={Boolean(query.data?.permissions.canAssignBrand)}
                onCreate={() => setBranchModal({ mode: "create", brandId: activeBrand.id })}
                onEdit={(branch) => setBranchModal({ mode: "edit", branch, brandId: activeBrand.id })}
                onViewDetails={(branch) => setViewBranchDetails(branch)}
              />
            </Card>
          )}
        </div>
      ) : (
        <EmptyState title="No se encontraron marcas." description="Ajusta la búsqueda o crea la primera marca comercial." />
      )}

      {/* Detail Modals */}
      <BrandDetailsModal brand={viewBrandDetails} onClose={() => setViewBrandDetails(null)} />
      <BranchDetailsModal branch={viewBranchDetails} onClose={() => setViewBranchDetails(null)} />

      <BrandModal
        state={brandModal}
        onClose={() => setBrandModal(null)}
        onSubmit={async (payload) => {
          try {
            if (brandModal?.mode === "edit" && brandModal.brand) {
              await updateBrand.mutateAsync({ id: brandModal.brand.id, payload });
              toast.success("Marca actualizada.");
            } else {
              await createBrand.mutateAsync(payload);
              toast.success("Marca creada.");
            }
            setBrandModal(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "No fue posible guardar la marca.");
          }
        }}
        pending={createBrand.isPending || updateBrand.isPending}
      />

      <BranchModal
        state={branchModal}
        brands={brands}
        canAssignBrand={Boolean(query.data?.permissions.canAssignBrand)}
        onClose={() => setBranchModal(null)}
        onSubmit={async (brandId, payload) => {
          try {
            if (branchModal?.mode === "edit" && branchModal.branch) {
              await updateBranch.mutateAsync({ id: branchModal.branch.id, payload });
              toast.success("La sucursal fue actualizada correctamente.");
            } else {
              await createBranch.mutateAsync({ brandId, payload: payload as BranchPayload });
              toast.success("Sucursal creada.");
            }
            setBranchModal(null);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "No fue posible guardar los cambios.");
          }
        }}
        pending={createBranch.isPending || updateBranch.isPending}
      />
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-brand-light)] text-[var(--text-brand-strong)]">
        <Icon size={19} />
      </span>
      <span>
        <span className="block text-[var(--text-xl)] font-semibold text-[var(--text-primary)]">{value}</span>
        <span className="text-[var(--text-sm)] text-[var(--text-secondary)]">{label}</span>
      </span>
    </Card>
  );
}

function BrandLogo({ brand }: { brand: HealthCenterBrand }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-subtle)]">
      {brand.logoUrl ? (
        <img src={brand.logoUrl} alt={brand.name} className="h-full w-full object-contain" />
      ) : (
        <span className="text-[var(--text-sm)] font-bold" style={{ color: brand.primaryColor }}>
          {brand.name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function BranchTable({
  brand,
  canCreate,
  canAssignBrand,
  onCreate,
  onEdit,
  onViewDetails
}: {
  brand: HealthCenterBrand;
  canCreate: boolean;
  canAssignBrand: boolean;
  onCreate: () => void;
  onEdit: (branch: Branch) => void;
  onViewDetails: (branch: Branch) => void;
}) {
  return (
    <div className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[var(--text-sm)] font-semibold text-[var(--text-primary)]">Sucursales de {brand.name}</p>
        {canCreate ? (
          <Button size="sm" onClick={onCreate}>
            <Plus size={15} />
            Nueva sucursal
          </Button>
        ) : null}
      </div>
      {brand.branches.length ? (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Sucursal</TableHeader>
              <TableHeader>Ubicación</TableHeader>
              <TableHeader>Teléfono</TableHeader>
              <TableHeader>Estado</TableHeader>
              <TableHeader className="text-right">Acciones</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {brand.branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className="font-semibold text-[var(--text-primary)]">
                  <div>{branch.name}</div>
                  <div className="text-xs font-normal text-[var(--text-secondary)]">Código: {branch.code}</div>
                </TableCell>
                <TableCell>{[branch.city, branch.state].filter(Boolean).join(", ") || "-"}</TableCell>
                <TableCell>{branch.phone || "-"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge value={branch.status === "ACTIVE" ? "Activa" : "Inactiva"} tone={branch.status === "ACTIVE" ? "success" : "danger"} />
                    <Badge value={branch.allowOnlineAppointments ? "Online" : "Sin Online"} tone={branch.allowOnlineAppointments ? "success" : "warning"} />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button variant="secondary" size="sm" onClick={() => onViewDetails(branch)}>
                      <Eye size={14} />
                      Ver detalles
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => onEdit(branch)}>
                      <Edit size={14} />
                      Editar
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <EmptyState
          title="Esta marca todavía no tiene sucursales."
          description={canAssignBrand ? `Puedes crear una sucursal nueva o mover una existente a ${brand.name}.` : "Solo verás sucursales autorizadas."}
        />
      )}
    </div>
  );
}

function BrandDetailsModal({ brand, onClose }: { brand: HealthCenterBrand | null; onClose: () => void }) {
  if (!brand) return null;

  return (
    <Modal open={Boolean(brand)} onClose={onClose} title="Detalles de la marca" size="2xl">
      <div className="space-y-6 py-2">
        <div className="flex items-center gap-4 border-b border-[var(--border-default)] pb-4">
          <BrandLogo brand={brand} />
          <div>
            <h3 className="text-lg font-bold text-[var(--text-primary)]">{brand.name}</h3>
            {brand.isDefault && <Badge value="Marca Predeterminada" tone="brand" />}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <DetailField label="Razón social" value={brand.legalName} />
          <DetailField label="Nombre corto" value={brand.shortName} />
          <DetailField label="Identificador comercial (Slug)" value={brand.slug} />
          <DetailField label="Estado" value={brand.status === "ACTIVE" ? "Activa" : "Archivada"} />
          <DetailField label="Sitio web" value={brand.website} />
          <DetailField label="Teléfono" value={brand.phone} />
          <DetailField label="Dominio principal" value={brand.domain} />
          <DetailField label="Dominio público" value={brand.publicDomain} />
          <DetailField label="Nombre del remitente" value={brand.senderName} />
          <DetailField label="Email remitente" value={brand.senderEmail} />
          <DetailField label="Email de respuesta (Reply-To)" value={brand.replyToEmail} />
          <DetailField label="Aviso de privacidad URL" value={brand.privacyNoticeUrl} />
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] p-3">
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Colores de marca</h4>
          <div className="mt-2 flex gap-4">
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 rounded border border-[var(--border-default)]" style={{ backgroundColor: brand.primaryColor }} />
              <span className="text-sm font-medium">Primario ({brand.primaryColor})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 rounded border border-[var(--border-default)]" style={{ backgroundColor: brand.secondaryColor }} />
              <span className="text-sm font-medium">Secundario ({brand.secondaryColor})</span>
            </div>
            {brand.accentColor && (
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded border border-[var(--border-default)]" style={{ backgroundColor: brand.accentColor }} />
                <span className="text-sm font-medium">Acento ({brand.accentColor})</span>
              </div>
            )}
          </div>
        </div>

        {brand.description && (
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Descripción</h4>
            <p className="mt-1 text-sm text-[var(--text-primary)]">{brand.description}</p>
          </div>
        )}

        <div className="flex justify-end border-t border-[var(--border-default)] pt-4">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </Modal>
  );
}

function BranchDetailsModal({ branch, onClose }: { branch: Branch | null; onClose: () => void }) {
  if (!branch) return null;

  return (
    <Modal open={Boolean(branch)} onClose={onClose} title="Detalles de la sucursal" size="2xl">
      <div className="space-y-6 py-2">
        <div className="border-b border-[var(--border-default)] pb-4">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">{branch.name}</h3>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">Código interno: {branch.code}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <DetailField label="Estado" value={branch.status === "ACTIVE" ? "Activa" : "Inactiva"} />
          <DetailField label="Zona horaria" value={branch.timezone} />
          <DetailField label="Teléfono principal" value={branch.phone} />
          <DetailField label="Teléfono secundario" value={branch.secondaryPhone} />
          <DetailField label="Email" value={branch.email} />
          <DetailField label="Email de respuesta (Reply-To)" value={branch.replyToEmail} />
          <DetailField label="Sitio web" value={branch.website} />
        </div>

        <div>
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Dirección</h4>
          <div className="mt-1 text-sm text-[var(--text-primary)] space-y-1">
            <p><strong>Calle:</strong> {branch.address || "-"}</p>
            <div className="grid grid-cols-2 gap-2">
              <p><strong>Num. Exterior:</strong> {branch.exteriorNumber || "-"}</p>
              <p><strong>Num. Interior:</strong> {branch.interiorNumber || "-"}</p>
            </div>
            <p><strong>Colonia:</strong> {branch.neighborhood || "-"}</p>
            <p><strong>Código Postal:</strong> {branch.postalCode || "-"}</p>
            <p><strong>Ubicación:</strong> {[branch.city, branch.municipality, branch.state, branch.country].filter(Boolean).join(", ") || "-"}</p>
            {branch.references && <p><strong>Referencias:</strong> {branch.references}</p>}
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--border-default)] p-3">
          <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase mb-2">Configuración y Opciones</h4>
          <div className="grid gap-2 sm:grid-cols-2 text-sm">
            <OptionItem label="Mostrar en correos" enabled={Boolean(branch.showInEmails)} />
            <OptionItem label="Mostrar en documentos" enabled={Boolean(branch.showInDocuments)} />
            <OptionItem label="Mostrar en agenda online" enabled={Boolean(branch.showInOnlineScheduling)} />
            <OptionItem label="Permitir citas online" enabled={Boolean(branch.allowOnlineAppointments)} />
            <OptionItem label="Permitir notificaciones" enabled={Boolean(branch.allowNotifications)} />
          </div>
        </div>

        {branch.description && (
          <div>
            <h4 className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Descripción</h4>
            <p className="mt-1 text-sm text-[var(--text-primary)]">{branch.description}</p>
          </div>
        )}

        <div className="flex justify-end border-t border-[var(--border-default)] pt-4">
          <Button variant="secondary" onClick={onClose}>Cerrar</Button>
        </div>
      </div>
    </Modal>
  );
}

function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <span className="block text-xs font-semibold text-[var(--text-secondary)] uppercase">{label}</span>
      <span className="mt-0.5 block text-sm font-medium text-[var(--text-primary)] truncate">{value || "-"}</span>
    </div>
  );
}

function OptionItem({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${enabled ? "bg-emerald-500" : "bg-slate-300"}`} />
      <span>{label}: <strong>{enabled ? "Sí" : "No"}</strong></span>
    </div>
  );
}

function BrandModal({
  state,
  onClose,
  onSubmit,
  pending
}: {
  state: { mode: "create" | "edit"; brand?: HealthCenterBrand } | null;
  onClose: () => void;
  onSubmit: (payload: BrandPayload) => Promise<void>;
  pending: boolean;
}) {
  const initial = state?.brand ? brandToForm(state.brand) : emptyBrandForm;
  const [form, setForm] = useState(initial);

  useEffect(() => setForm(initial), [state?.brand?.id, state?.mode]);

  if (!state) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const error = validateBrand(form);
    if (error) {
      toast.error(error);
      return;
    }
    await onSubmit(cleanBrandPayload(form));
  };

  return (
    <Modal open={Boolean(state)} onClose={onClose} title={state.mode === "edit" ? "Editar marca" : "Nueva marca"} size="2xl">
      <form onSubmit={submit} className="space-y-5">
        <section className="grid gap-3 md:grid-cols-2">
          <Field label="Nombre comercial *">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </Field>
          <Field label="Identificador">
            <Input value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} placeholder="dental-plus" />
          </Field>
          <Field label="Razón social">
            <Input value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} />
          </Field>
          <Field label="Nombre corto">
            <Input value={form.shortName} onChange={(event) => setForm({ ...form, shortName: event.target.value })} />
          </Field>
          <Field label="Descripción">
            <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
          <Field label="Teléfono principal">
            <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </Field>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <Field label="Logo URL">
            <Input value={form.logoUrl} onChange={(event) => setForm({ ...form, logoUrl: event.target.value })} />
          </Field>
          <Field label="Color principal">
            <ColorInput value={form.primaryColor} onChange={(value) => setForm({ ...form, primaryColor: value })} />
          </Field>
          <Field label="Color secundario">
            <ColorInput value={form.secondaryColor} onChange={(value) => setForm({ ...form, secondaryColor: value })} />
          </Field>
        </section>

        <section className="grid gap-3 md:grid-cols-2">
          <Field label="Dominio">
            <Input value={form.domain} onChange={(event) => setForm({ ...form, domain: event.target.value })} placeholder="dentalplus.mx" />
          </Field>
          <Field label="Dominio público">
            <Input value={form.publicDomain} onChange={(event) => setForm({ ...form, publicDomain: event.target.value })} />
          </Field>
          <Field label="Remitente">
            <Input value={form.senderName} onChange={(event) => setForm({ ...form, senderName: event.target.value })} />
          </Field>
          <Field label="Sender email">
            <Input type="email" value={form.senderEmail} onChange={(event) => setForm({ ...form, senderEmail: event.target.value })} />
          </Field>
          <Field label="Reply-To">
            <Input type="email" value={form.replyToEmail} onChange={(event) => setForm({ ...form, replyToEmail: event.target.value })} />
          </Field>
          <Field label="Sitio web">
            <Input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
          </Field>
        </section>

        <label className="flex items-center gap-2 text-[var(--text-sm)] text-[var(--text-primary)]">
          <input type="checkbox" checked={form.isDefault} onChange={(event) => setForm({ ...form, isDefault: event.target.checked })} />
          Establecer como marca predeterminada
        </label>

        <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Guardar marca"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function BranchModal({
  state,
  brands,
  canAssignBrand,
  onClose,
  onSubmit,
  pending
}: {
  state: { mode: "create" | "edit"; brandId?: string; branch?: Branch } | null;
  brands: HealthCenterBrand[];
  canAssignBrand: boolean;
  onClose: () => void;
  onSubmit: (brandId: string, payload: Partial<BranchPayload> & { status?: "ACTIVE" | "INACTIVE" }) => Promise<void>;
  pending: boolean;
}) {
  const initial = state?.branch ? branchToForm(state.branch) : { ...emptyBranchForm, brandId: state?.brandId ?? "" };
  const [form, setForm] = useState(initial);

  useEffect(() => setForm(initial), [state?.branch?.id, state?.brandId, state?.mode]);

  if (!state) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const error = validateBranch(form);
    if (error) {
      toast.error(error);
      return;
    }
    await onSubmit(form.brandId, cleanBranchPayload(form, state.mode === "edit"));
  };

  return (
    <Modal open={Boolean(state)} onClose={onClose} title={state.mode === "edit" ? "Editar sucursal" : "Nueva sucursal"} size="2xl">
      <form onSubmit={submit} className="space-y-5">
        <section className="grid gap-3 md:grid-cols-2">
          <Field label="Marca *">
            <Select
              value={form.brandId}
              disabled={!canAssignBrand && state.mode === "edit"}
              onChange={(event) => setForm({ ...form, brandId: event.target.value })}
              required
            >
              <option value="">Selecciona marca</option>
              {brands
                .filter((brand) => brand.status === "ACTIVE" || brand.id === form.brandId)
                .map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Nombre de sucursal *">
            <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
          </Field>
          <Field label="Código interno *">
            <Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} required disabled={state.mode === "edit"} />
          </Field>
          <Field label="Estado">
            <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as "ACTIVE" | "INACTIVE" })}>
              <option value="ACTIVE">Activa</option>
              <option value="INACTIVE">Inactiva</option>
            </Select>
          </Field>
          <Field label="Descripción">
            <Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </Field>
          <Field label="Zona horaria">
            <Input value={form.timezone} onChange={(event) => setForm({ ...form, timezone: event.target.value })} />
          </Field>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <Field label="Dirección">
            <Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          </Field>
          <Field label="Número exterior">
            <Input value={form.exteriorNumber} onChange={(event) => setForm({ ...form, exteriorNumber: event.target.value })} />
          </Field>
          <Field label="Número interior">
            <Input value={form.interiorNumber} onChange={(event) => setForm({ ...form, interiorNumber: event.target.value })} />
          </Field>
          <Field label="Colonia">
            <Input value={form.neighborhood} onChange={(event) => setForm({ ...form, neighborhood: event.target.value })} />
          </Field>
          <Field label="Código postal">
            <Input value={form.postalCode} onChange={(event) => setForm({ ...form, postalCode: event.target.value })} />
          </Field>
          <Field label="País">
            <Input value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
          </Field>
          <Field label="Estado">
            <Input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} />
          </Field>
          <Field label="Ciudad">
            <Input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
          </Field>
          <Field label="Municipio">
            <Input value={form.municipality} onChange={(event) => setForm({ ...form, municipality: event.target.value })} />
          </Field>
        </section>

        <section className="grid gap-3 md:grid-cols-3">
          <Field label="Código de país">
            <Select value={form.countryCode} onChange={(event) => setForm({ ...form, countryCode: event.target.value })}>
              <option value="+52">México +52</option>
              <option value="+1">Estados Unidos +1</option>
              <option value="+34">España +34</option>
            </Select>
          </Field>
          <Field label="Teléfono principal">
            <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="10 dígitos" />
          </Field>
          <Field label="Teléfono secundario">
            <Input value={form.secondaryPhone} onChange={(event) => setForm({ ...form, secondaryPhone: event.target.value })} />
          </Field>
          <Field label="Correo de contacto">
            <Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </Field>
          <Field label="Reply-To">
            <Input type="email" value={form.replyToEmail} onChange={(event) => setForm({ ...form, replyToEmail: event.target.value })} />
          </Field>
          <Field label="Sitio web">
            <Input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} />
          </Field>
        </section>

        <section className="grid gap-2 md:grid-cols-2">
          <Toggle label="Usar datos en correos" checked={form.showInEmails} onChange={(value) => setForm({ ...form, showInEmails: value })} />
          <Toggle label="Usar datos en documentos" checked={form.showInDocuments} onChange={(value) => setForm({ ...form, showInDocuments: value })} />
          <Toggle label="Mostrar en agenda online" checked={form.showInOnlineScheduling} onChange={(value) => setForm({ ...form, showInOnlineScheduling: value })} />
          <Toggle label="Permitir citas online" checked={form.allowOnlineAppointments} onChange={(value) => setForm({ ...form, allowOnlineAppointments: value })} />
          <Toggle label="Permitir notificaciones" checked={form.allowNotifications} onChange={(value) => setForm({ ...form, allowNotifications: value })} />
        </section>

        <div className="flex justify-end gap-2 border-t border-[var(--border-default)] pt-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-[var(--text-sm)] font-medium text-[var(--text-primary)]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border-default)] px-3 py-2 text-[var(--text-sm)] text-[var(--text-primary)]">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex gap-2">
      <input type="color" value={value || "#0f766e"} onChange={(event) => onChange(event.target.value)} className="h-[38px] w-12 rounded border border-[var(--border-default)]" />
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function brandToForm(brand: HealthCenterBrand): BrandFormState {
  return {
    name: brand.name ?? "",
    legalName: brand.legalName ?? "",
    shortName: brand.shortName ?? "",
    slug: brand.slug ?? "",
    description: brand.description ?? "",
    logoUrl: brand.logoUrl ?? "",
    primaryColor: brand.primaryColor ?? "#0f766e",
    secondaryColor: brand.secondaryColor ?? "#0f172a",
    accentColor: brand.accentColor ?? "",
    domain: brand.domain ?? "",
    publicDomain: brand.publicDomain ?? "",
    senderName: brand.senderName ?? "",
    senderEmail: brand.senderEmail ?? "",
    replyToEmail: brand.replyToEmail ?? "",
    phone: brand.phone ?? "",
    website: brand.website ?? "",
    privacyNoticeUrl: brand.privacyNoticeUrl ?? "",
    isDefault: brand.isDefault
  };
}

function branchToForm(branch: Branch): BranchFormState {
  return {
    ...emptyBranchForm,
    brandId: branch.brandId ?? "",
    code: branch.code ?? "",
    name: branch.name ?? "",
    description: branch.description ?? "",
    status: branch.status,
    address: branch.address ?? "",
    exteriorNumber: branch.exteriorNumber ?? "",
    interiorNumber: branch.interiorNumber ?? "",
    neighborhood: branch.neighborhood ?? "",
    postalCode: branch.postalCode ?? "",
    country: branch.country ?? "MX",
    state: branch.state ?? "",
    city: branch.city ?? "",
    municipality: branch.municipality ?? "",
    references: branch.references ?? "",
    timezone: branch.timezone ?? "America/Mexico_City",
    countryCode: branch.countryCode ?? "+52",
    phone: branch.phone ?? "",
    secondaryPhone: branch.secondaryPhone ?? "",
    email: branch.email ?? "",
    replyToEmail: branch.replyToEmail ?? "",
    website: branch.website ?? "",
    showInEmails: branch.showInEmails ?? true,
    showInDocuments: branch.showInDocuments ?? true,
    showInOnlineScheduling: branch.showInOnlineScheduling ?? true,
    allowOnlineAppointments: branch.allowOnlineAppointments ?? true,
    allowNotifications: branch.allowNotifications ?? true
  };
}

function cleanBrandPayload(form: BrandFormState): BrandPayload {
  return {
    ...form,
    slug: form.slug || undefined,
    legalName: form.legalName || undefined,
    shortName: form.shortName || undefined,
    description: form.description || undefined,
    logoUrl: form.logoUrl || undefined,
    accentColor: form.accentColor || undefined,
    domain: form.domain || undefined,
    publicDomain: form.publicDomain || undefined,
    senderName: form.senderName || undefined,
    senderEmail: form.senderEmail || undefined,
    replyToEmail: form.replyToEmail || undefined,
    phone: form.phone || undefined,
    website: form.website || undefined,
    privacyNoticeUrl: form.privacyNoticeUrl || undefined
  };
}

function cleanBranchPayload(form: BranchFormState, editing: boolean): Partial<BranchPayload> & { status?: "ACTIVE" | "INACTIVE" } {
  const normalizedPhone = normalizePhone(form.countryCode, form.phone);
  return {
    ...(editing ? {} : { code: form.code }),
    name: form.name,
    brandId: form.brandId,
    description: form.description || undefined,
    status: form.status,
    address: form.address || undefined,
    exteriorNumber: form.exteriorNumber || undefined,
    interiorNumber: form.interiorNumber || undefined,
    neighborhood: form.neighborhood || undefined,
    postalCode: form.postalCode || undefined,
    country: form.country || "MX",
    state: form.state || undefined,
    city: form.city || undefined,
    municipality: form.municipality || undefined,
    references: form.references || undefined,
    timezone: form.timezone || "America/Mexico_City",
    countryCode: form.countryCode,
    phone: normalizedPhone || undefined,
    secondaryPhone: form.secondaryPhone || undefined,
    email: form.email || undefined,
    replyToEmail: form.replyToEmail || undefined,
    website: form.website || undefined,
    showInEmails: form.showInEmails,
    showInDocuments: form.showInDocuments,
    showInOnlineScheduling: form.showInOnlineScheduling,
    allowOnlineAppointments: form.allowOnlineAppointments,
    allowNotifications: form.allowNotifications
  };
}

function validateBrand(form: BrandFormState) {
  if (!form.name.trim()) return "El nombre de la marca es obligatorio.";
  const colorRegex = /^#[0-9a-f]{6}$/i;
  if (!colorRegex.test(form.primaryColor) || !colorRegex.test(form.secondaryColor)) return "Los colores deben estar en formato hexadecimal.";
  if (form.slug && !/^[a-z0-9-]+$/i.test(form.slug)) return "El identificador solo puede usar letras, números y guiones.";
  if (form.domain && !isValidDomain(form.domain)) return "El dominio no tiene un formato válido.";
  if (form.publicDomain && !isValidDomain(form.publicDomain)) return "El dominio público no tiene un formato válido.";
  return "";
}

function validateBranch(form: BranchFormState) {
  if (!form.brandId) return "Selecciona una marca.";
  if (!form.name.trim()) return "El nombre de sucursal es obligatorio.";
  if (!form.code.trim()) return "El código de sucursal es obligatorio.";
  if (form.countryCode === "+52" && form.phone && digits(form.phone).length !== 10) {
    return "Ingresa un número mexicano válido de 10 dígitos.";
  }
  return "";
}

function isValidDomain(value: string) {
  return /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i.test(value.replace(/^https?:\/\//, "").replace(/\/.*$/, ""));
}

function normalizePhone(countryCode: string, phone: string) {
  const number = digits(phone);
  if (!number) return "";
  return `${countryCode}${number}`;
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}
