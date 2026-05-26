import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SimpleCrudPage } from "@/components/forms/simple-crud-page";
import { useProcedureCategories, useProcedureMutations, useProcedures } from "../hooks/use-procedures";

function asNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function ProceduresSettingsPage() {
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryActive, setCategoryActive] = useState("");
  const [procedureSearch, setProcedureSearch] = useState("");
  const [procedureActive, setProcedureActive] = useState("");

  const categories = useProcedureCategories(categorySearch || undefined, categoryActive || undefined);
  const procedures = useProcedures(procedureSearch || undefined, procedureActive || undefined);
  const mutations = useProcedureMutations();

  return (
    <div className="space-y-8">
      <SimpleCrudPage
        title="Categorias de procedimientos"
        description="Clasificacion del catalogo clinico"
        helpText="Clasificación general del catálogo de prestaciones clínicas (ej. Odontopediatría, Endodoncia, Cirugía). Permite agrupar los tratamientos para reportes financieros y configurar el orden visual de los módulos."
        rows={categories.data}
        loading={categories.isLoading}
        error={categories.error?.message}
        search={categorySearch}
        setSearch={setCategorySearch}
        active={categoryActive}
        setActive={setCategoryActive}
        fields={[
          { key: "name", label: "Nombre", type: "text" },
          { key: "description", label: "Descripcion", type: "textarea" },
          { key: "sortOrder", label: "Orden", type: "number" }
        ]}
        columns={[
          { key: "name", title: "Nombre" },
          { key: "sortOrder", title: "Orden" },
          { key: "description", title: "Descripcion" },
          {
            key: "isActive",
            title: "Estado",
            render: (row) => <Badge value={row.isActive ? "ACTIVO" : "INACTIVO"} tone={row.isActive ? "success" : "warning"} />
          }
        ]}
        actions={{
          create: async (payload) => {
            const record = payload as Record<string, unknown>;
            return mutations.createCategory.mutateAsync({
              ...(record as object),
              sortOrder: asNumber(record.sortOrder, 0)
            } as never);
          },
          update: async (id, payload) => {
            const record = payload as Record<string, unknown>;
            return mutations.updateCategory.mutateAsync({
              id,
              payload: {
                ...(record as object),
                sortOrder: asNumber(record.sortOrder, 0)
              }
            });
          },
          deactivate: async (id) => mutations.deactivateCategory.mutateAsync(id),
          mapToForm: (row) => ({
            name: row.name,
            description: row.description ?? "",
            sortOrder: row.sortOrder
          }),
          getId: (row) => row.id
        }}
      />

      <SimpleCrudPage
        title="Procedimientos"
        description="Catalogo de procedimientos y reglas clinicas"
        helpText="Catálogo maestro de prestaciones dentales. Permite configurar códigos internos, duraciones de cita sugeridas y reglas críticas del odontograma: si el tratamiento requiere especificar un diente individual, una cara/superficie dental (ej. oclusal, mesial) o si involucra trabajos con laboratorios dentales externos."
        rows={procedures.data}
        loading={procedures.isLoading}
        error={procedures.error?.message}
        search={procedureSearch}
        setSearch={setProcedureSearch}
        active={procedureActive}
        setActive={setProcedureActive}
        fields={[
          { key: "categoryId", label: "Category ID", type: "text" },
          { key: "code", label: "Codigo", type: "text" },
          { key: "name", label: "Nombre", type: "text" },
          { key: "description", label: "Descripcion", type: "textarea" },
          { key: "defaultDuration", label: "Duracion (min)", type: "number" },
          { key: "requiresTooth", label: "Requiere diente", type: "checkbox" },
          { key: "requiresSurface", label: "Requiere superficie", type: "checkbox" },
          { key: "requiresLab", label: "Requiere laboratorio", type: "checkbox" }
        ]}
        columns={[
          { key: "code", title: "Codigo" },
          { key: "name", title: "Nombre" },
          { key: "category", title: "Categoria", render: (row) => row.category.name },
          { key: "defaultDuration", title: "Duracion" },
          {
            key: "isActive",
            title: "Estado",
            render: (row) => <Badge value={row.isActive ? "ACTIVO" : "INACTIVO"} tone={row.isActive ? "success" : "warning"} />
          }
        ]}
        actions={{
          create: async (payload) => {
            const record = payload as Record<string, unknown>;
            return mutations.createProcedure.mutateAsync({
              ...(record as object),
              defaultDuration: asNumber(record.defaultDuration, 30),
              requiresTooth: Boolean(record.requiresTooth),
              requiresSurface: Boolean(record.requiresSurface),
              requiresLab: Boolean(record.requiresLab)
            } as never);
          },
          update: async (id, payload) => {
            const record = payload as Record<string, unknown>;
            return mutations.updateProcedure.mutateAsync({
              id,
              payload: {
                ...(record as object),
                defaultDuration: asNumber(record.defaultDuration, 30),
                requiresTooth: Boolean(record.requiresTooth),
                requiresSurface: Boolean(record.requiresSurface),
                requiresLab: Boolean(record.requiresLab)
              }
            });
          },
          deactivate: async (id) => mutations.deactivateProcedure.mutateAsync(id),
          mapToForm: (row) => ({
            categoryId: row.categoryId,
            code: row.code,
            name: row.name,
            description: row.description ?? "",
            defaultDuration: row.defaultDuration,
            requiresTooth: row.requiresTooth,
            requiresSurface: row.requiresSurface,
            requiresLab: row.requiresLab
          }),
          getId: (row) => row.id
        }}
      />
    </div>
  );
}
