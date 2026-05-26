import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SimpleCrudPage } from "@/components/forms/simple-crud-page";
import { useDocumentsMutations, useConsentTemplates } from "@/features/documents/hooks/use-documents";

export function ConsentTemplatesSettingsPage() {
  const [search, setSearch] = useState("");
  const [active, setActive] = useState("");
  const templates = useConsentTemplates(search || undefined, active || undefined);
  const mutations = useDocumentsMutations();

  return (
    <SimpleCrudPage
      title="Plantillas de consentimiento"
      description="Gestion de formatos firmables por procedimiento."
      helpText="Formatos y textos legales de Consentimiento Informado que el paciente debe firmar de forma física o digital antes de la realización de procedimientos invasivos o cirugías específicas."
      rows={templates.data}
      loading={templates.isLoading}
      error={templates.error?.message}
      search={search}
      setSearch={setSearch}
      active={active}
      setActive={setActive}
      fields={[
        { key: "name", label: "Nombre", type: "text" },
        { key: "content", label: "Contenido", type: "textarea" },
        { key: "procedureId", label: "Procedure ID (opcional)", type: "text" }
      ]}
      columns={[
        { key: "name", title: "Nombre" },
        { key: "procedureId", title: "Procedure ID", render: (row) => row.procedureId || "-" },
        {
          key: "isActive",
          title: "Estado",
          render: (row) => <Badge value={row.isActive ? "ACTIVA" : "INACTIVA"} tone={row.isActive ? "success" : "warning"} />
        }
      ]}
      actions={{
        create: async (payload) =>
          mutations.createConsentTemplate.mutateAsync({
            name: String(payload.name || ""),
            content: String(payload.content || ""),
            procedureId: payload.procedureId ? String(payload.procedureId) : undefined
          }),
        update: async (id, payload) =>
          mutations.updateConsentTemplate.mutateAsync({
            id,
            payload: {
              name: payload.name ? String(payload.name) : undefined,
              content: payload.content ? String(payload.content) : undefined,
              procedureId: payload.procedureId ? String(payload.procedureId) : null
            }
          }),
        deactivate: async (id) => mutations.deactivateConsentTemplate.mutateAsync(id),
        mapToForm: (row) => ({
          name: row.name,
          content: row.content,
          procedureId: row.procedureId ?? ""
        }),
        getId: (row) => row.id
      }}
    />
  );
}
