import { FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs } from "@/components/ui/tabs";
import { usePriceLists } from "@/features/settings/price-lists/hooks/use-price-lists";
import { AgreementsDebtsPage } from "./agreements-debts-page";
import {
  useAgreements,
  useAssignAgreementPatients,
  useCreateAgreement,
  useDeactivateAgreement,
  useUpdateAgreement
} from "../hooks/use-admin-workflows";
import type { Agreement } from "../services/admin-workflows.service";

type AgreementForm = {
  id?: string;
  name: string;
  description: string;
  priceListId: string;
  discountPercent: string;
  appliesToLabs: boolean;
  appliesToOtherCategories: boolean;
  payrollDiscount: boolean;
  isPublic: boolean;
};

const emptyForm: AgreementForm = {
  name: "",
  description: "",
  priceListId: "",
  discountPercent: "0",
  appliesToLabs: false,
  appliesToOtherCategories: false,
  payrollDiscount: false,
  isPublic: true
};

export function AgreementsSettingsPage() {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const [form, setForm] = useState<AgreementForm>(emptyForm);
  const [assignAgreementId, setAssignAgreementId] = useState("");
  const [patientIds, setPatientIds] = useState("");
  const [activeTab, setActiveTab] = useState("list");
  const agreements = useAgreements(search || undefined, active || undefined);
  const priceLists = usePriceLists(undefined, "true");
  const createAgreement = useCreateAgreement();
  const updateAgreement = useUpdateAgreement();
  const deactivateAgreement = useDeactivateAgreement();
  const assignPatients = useAssignAgreementPatients();

  const submitAgreement = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      priceListId: form.priceListId || undefined,
      discountPercent: Number(form.discountPercent || 0),
      appliesToLabs: form.appliesToLabs,
      appliesToOtherCategories: form.appliesToOtherCategories,
      payrollDiscount: form.payrollDiscount,
      isPublic: form.isPublic
    };
    if (form.id) await updateAgreement.mutateAsync({ id: form.id, payload });
    else await createAgreement.mutateAsync(payload);
    setForm(emptyForm);
  };

  const editAgreement = (agreement: Agreement) => {
    setForm({
      id: agreement.id,
      name: agreement.name,
      description: agreement.description ?? "",
      priceListId: agreement.priceListId ?? "",
      discountPercent: agreement.discountPercent,
      appliesToLabs: agreement.appliesToLabs,
      appliesToOtherCategories: agreement.appliesToOtherCategories,
      payrollDiscount: agreement.payrollDiscount,
      isPublic: agreement.isPublic
    });
  };

  const submitAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ids = patientIds
      .split(/[\s,]+/)
      .map((patientId) => patientId.trim())
      .filter(Boolean);
    if (!assignAgreementId || !ids.length) return;
    await assignPatients.mutateAsync({ id: assignAgreementId, patientIds: ids });
    setPatientIds("");
  };

  if (agreements.isLoading) return <LoadingState message="Cargando convenios..." />;
  if (agreements.isError) return <ErrorState message={agreements.error.message} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Convenios"
        description="Convenios con arancel, descuento y asignacion de pacientes."
        helpText="Un convenio vincula pacientes con un listado de precios o un descuento administrativo para presupuestos y cobros."
      />

      <Card className="space-y-4">
        <Tabs 
          items={[
            { key: "list", label: "Listar" },
            { key: "debts", label: "$ Reporte deudas" }
          ]}
          active={activeTab}
          onChange={setActiveTab}
        />

        {activeTab === "list" && (
          <div className="grid gap-3 md:grid-cols-3">
            <Input placeholder="Buscar convenio" value={search} onChange={(event) => setSearch(event.target.value)} />
            <Select value={active} onChange={(event) => setActive(event.target.value)}>
              <option value="">Todos los estados</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </Select>
          </div>
        )}
      </Card>

      {activeTab === "list" ? (
        <div className="space-y-4">

      <Card>
        <h3 className="mb-3 text-base font-semibold text-slate-900">{form.id ? "Editar convenio" : "Nuevo convenio"}</h3>
        <form className="grid gap-3 lg:grid-cols-2" onSubmit={submitAgreement}>
          <label className="text-sm text-slate-700">
            Nombre
            <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
          </label>
          <label className="text-sm text-slate-700">
            Listado de precios
            <Select
              value={form.priceListId}
              onChange={(event) => setForm((current) => ({ ...current, priceListId: event.target.value }))}
            >
              <option value="">Usar descuento sin listado</option>
              {priceLists.data?.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm text-slate-700">
            Descuento general (%)
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={form.discountPercent}
              onChange={(event) => setForm((current) => ({ ...current, discountPercent: event.target.value }))}
            />
          </label>
          <label className="text-sm text-slate-700 lg:row-span-2">
            Descripcion
            <Textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </label>
          <div className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.appliesToLabs}
                onChange={(event) => setForm((current) => ({ ...current, appliesToLabs: event.target.checked }))}
              />
              Aplica a laboratorio
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.appliesToOtherCategories}
                onChange={(event) => setForm((current) => ({ ...current, appliesToOtherCategories: event.target.checked }))}
              />
              Aplica a categorias extra
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.payrollDiscount}
                onChange={(event) => setForm((current) => ({ ...current, payrollDiscount: event.target.checked }))}
              />
              Considerar en nomina
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(event) => setForm((current) => ({ ...current, isPublic: event.target.checked }))}
              />
              Visible para pacientes
            </label>
          </div>
          <div className="flex gap-2 lg:col-span-2">
            <Button type="submit" disabled={createAgreement.isPending || updateAgreement.isPending}>
              {form.id ? "Actualizar" : "Crear convenio"}
            </Button>
            {form.id ? (
              <Button type="button" variant="secondary" onClick={() => setForm(emptyForm)}>
                Cancelar edicion
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      <Card>
        <h3 className="mb-3 text-base font-semibold text-slate-900">Asignar pacientes</h3>
        <form className="grid gap-3 md:grid-cols-[minmax(220px,320px)_1fr_auto]" onSubmit={submitAssignment}>
          <Select value={assignAgreementId} onChange={(event) => setAssignAgreementId(event.target.value)}>
            <option value="">Selecciona convenio</option>
            {agreements.data?.filter((agreement) => agreement.isActive).map((agreement) => (
              <option key={agreement.id} value={agreement.id}>
                {agreement.name}
              </option>
            ))}
          </Select>
          <Input
            placeholder="IDs de pacientes separados por coma o espacio"
            value={patientIds}
            onChange={(event) => setPatientIds(event.target.value)}
          />
          <Button type="submit" disabled={assignPatients.isPending}>
            Asignar
          </Button>
        </form>
      </Card>

      <DataTable
        rows={agreements.data ?? []}
        empty={<EmptyState title="Sin convenios" description="Crea el primer convenio para asociar aranceles a pacientes." />}
        columns={[
          { key: "name", title: "Convenio" },
          { key: "priceList", title: "Listado", render: (row) => row.priceList?.name ?? "Descuento directo" },
          { key: "discountPercent", title: "Descuento", render: (row) => `${Number(row.discountPercent).toFixed(2)}%` },
          { key: "_count", title: "Pacientes", render: (row) => String(row._count.patients) },
          {
            key: "isActive",
            title: "Estado",
            render: (row) => <Badge value={row.isActive ? "ACTIVO" : "INACTIVO"} tone={row.isActive ? "success" : "warning"} />
          },
          {
            key: "id",
            title: "Acciones",
            render: (row) => (
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => editAgreement(row)}>
                  Editar
                </Button>
                <Button variant="danger" onClick={() => deactivateAgreement.mutate(row.id)} disabled={!row.isActive}>
                  Desactivar
                </Button>
              </div>
            )
          }
        ]}
      />
      </div>
      ) : (
        <AgreementsDebtsPage />
      )}
  </div>
  );
}
