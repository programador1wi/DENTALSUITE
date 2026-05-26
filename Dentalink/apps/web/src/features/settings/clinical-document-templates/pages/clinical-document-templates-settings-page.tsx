import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SimpleCrudPage } from "@/components/forms/simple-crud-page";
import {
  useClinicalDocumentTemplatesSettings,
  useCreateClinicalDocumentTemplateSettings,
  useDeactivateClinicalDocumentTemplateSettings,
  useUpdateClinicalDocumentTemplateSettings
} from "../hooks/use-clinical-document-templates";

export function ClinicalDocumentTemplatesSettingsPage() {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const templates = useClinicalDocumentTemplatesSettings(search || undefined, active || undefined);
  const createTemplate = useCreateClinicalDocumentTemplateSettings();
  const updateTemplate = useUpdateClinicalDocumentTemplateSettings();
  const deactivateTemplate = useDeactivateClinicalDocumentTemplateSettings();

  return (
    <SimpleCrudPage
      title="Documentos clinicos"
      description="Plantillas para documentos del expediente del paciente."
      helpText="Crea plantillas administrativas para usarlas despues desde Ficha clinica > Documentos clinicos."
      rows={templates.data}
      loading={templates.isLoading}
      error={templates.error?.message}
      search={search}
      setSearch={setSearch}
      active={active}
      setActive={setActive}
      fields={[
        { key: "name", label: "Nombre", type: "text", required: true },
        { key: "description", label: "Descripcion", type: "text" },
        { key: "content", label: "Contenido", type: "textarea", required: true }
      ]}
      columns={[
        { key: "name", title: "Nombre" },
        { key: "description", title: "Descripcion", render: (row) => row.description || "-" },
        {
          key: "isActive",
          title: "Estado",
          render: (row) => <Badge value={row.isActive ? "ACTIVO" : "INACTIVO"} tone={row.isActive ? "success" : "warning"} />
        }
      ]}
      actions={{
        create: async (payload) => createTemplate.mutateAsync(payload as never),
        update: async (id, payload) => updateTemplate.mutateAsync({ id, payload: payload as never }),
        deactivate: async (id) => deactivateTemplate.mutateAsync(id),
        mapToForm: (row) => ({ name: row.name, description: row.description ?? "", content: row.content }),
        getId: (row) => row.id
      }}
    />
  );
}
