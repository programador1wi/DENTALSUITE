import { BadRequestException } from "@nestjs/common";
import { createHash } from "node:crypto";

export type ConsentEditorNode = {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown> | null;
  marks?: Array<{ type?: string }>;
  content?: ConsentEditorNode[];
};

export type RequiredSigners = {
  patient: { enabled: boolean; required: boolean };
  professional: {
    enabled: boolean;
    required: boolean;
    mode: "TREATMENT_PROFESSIONAL" | "MANUAL" | "ANY_AUTHORIZED";
  };
  representative: {
    enabled: boolean;
    required: boolean;
    replacesPatient: boolean;
  };
};

export type ConsentVariableDefinition = {
  key: string;
  label: string;
  category: string;
  dataType: "text" | "date" | "number";
  sensitive: boolean;
  source: string;
  format?: string;
  fallback: string;
};

export const CONSENT_VARIABLES: ConsentVariableDefinition[] = [
  variable("patient.full_name", "Nombre completo del paciente", "Paciente", "text", false, "Patient", "Dato no disponible"),
  variable("patient.document_type", "Tipo de documento", "Paciente", "text", true, "Patient", "No registrado"),
  variable("patient.document_number", "Número de documento", "Paciente", "text", true, "Patient", "No registrado"),
  variable("patient.birth_date", "Fecha de nacimiento", "Paciente", "date", true, "Patient", "No registrada"),
  variable("patient.age", "Edad", "Paciente", "number", false, "Patient", "No disponible"),
  variable("patient.email", "Correo del paciente", "Paciente", "text", true, "Patient", "No registrado"),
  variable("patient.phone", "Teléfono del paciente", "Paciente", "text", true, "Patient", "No registrado"),
  variable("representative.full_name", "Nombre del representante", "Representante", "text", true, "ConsentInstance", "No registrado"),
  variable("representative.document_number", "Documento del representante", "Representante", "text", true, "ConsentInstance", "No registrado"),
  variable("representative.relationship", "Relación con el paciente", "Representante", "text", true, "ConsentInstance", "No registrada"),
  variable("professional.full_name", "Nombre del profesional", "Profesional", "text", false, "Professional", "No asignado"),
  variable("professional.license_number", "Cédula profesional", "Profesional", "text", true, "Professional", "No registrada"),
  variable("professional.specialty", "Especialidad", "Profesional", "text", false, "Professional", "No registrada"),
  variable("organization.name", "Nombre de la organización", "Clínica", "text", false, "Organization", "Clínica"),
  variable("branch.name", "Nombre de la sucursal", "Sucursal", "text", false, "Branch", "Sucursal"),
  variable("branch.address", "Dirección de la sucursal", "Sucursal", "text", false, "Branch", "No registrada"),
  variable("branch.phone", "Teléfono de la sucursal", "Sucursal", "text", false, "Branch", "No registrado"),
  variable("appointment.date", "Fecha de la cita", "Cita", "date", true, "Appointment", "No asignada"),
  variable("appointment.time", "Hora de la cita", "Cita", "date", true, "Appointment", "No asignada"),
  variable("treatment.name", "Nombre del tratamiento", "Tratamiento", "text", true, "TreatmentPlan", "No asignado"),
  variable("treatment.description", "Descripción del tratamiento", "Tratamiento", "text", true, "TreatmentPlan", "No registrada"),
  variable("treatment.estimated_cost", "Costo estimado", "Tratamiento", "number", true, "TreatmentPlan", "No disponible"),
  variable("system.current_date", "Fecha actual", "Sistema", "date", false, "System", "")
];

const VARIABLE_MAP = new Map(CONSENT_VARIABLES.map((entry) => [entry.key, entry]));
const ALLOWED_NODES = new Set([
  "doc",
  "paragraph",
  "heading",
  "text",
  "bulletList",
  "orderedList",
  "listItem",
  "horizontalRule",
  "hardBreak",
  "consentToken"
]);
const ALLOWED_MARKS = new Set(["bold", "italic", "strike"]);
const FIELD_KINDS = new Set(["PREFILLED_TEXT", "FREE_TEXT", "DATE", "DOCUMENT_ID", "REPRESENTATIVE"]);

export function validateConsentTemplate(
  editorSchema: unknown,
  requiredSigners: RequiredSigners
): {
  errors: string[];
  warnings: string[];
  manifest: ConsentVariableDefinition[];
  fieldKeys: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const variables = new Set<string>();
  const fieldKeys = new Set<string>();
  let visibleText = "";

  const visit = (candidate: unknown) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      errors.push("La estructura del editor contiene un nodo inválido.");
      return;
    }
    const node = candidate as ConsentEditorNode;
    const type = node.type ?? "";
    if (!ALLOWED_NODES.has(type)) {
      errors.push(`El tipo de contenido "${type || "sin tipo"}" no está permitido.`);
      return;
    }
    if (type === "text") {
      visibleText += node.text ?? "";
      for (const mark of node.marks ?? []) {
        if (!mark.type || !ALLOWED_MARKS.has(mark.type)) {
          errors.push(`El formato "${mark.type || "desconocido"}" no está permitido.`);
        }
      }
    }
    if (type === "consentToken") {
      const kind = stringAttr(node, "kind");
      const key = stringAttr(node, "key");
      const label = stringAttr(node, "label");
      if (!label) errors.push("Existe un componente dinámico sin etiqueta.");
      if (kind === "VARIABLE") {
        if (!VARIABLE_MAP.has(key)) errors.push(`La variable "${key || "sin clave"}" no existe en el catálogo autorizado.`);
        else variables.add(key);
      } else if (FIELD_KINDS.has(kind)) {
        if (!key) errors.push("Existe un campo dinámico sin clave.");
        else if (fieldKeys.has(key)) errors.push(`La clave de campo "${key}" está repetida.`);
        else fieldKeys.add(key);
      } else {
        errors.push(`El componente dinámico "${kind || "sin tipo"}" no es compatible.`);
      }
      visibleText += label;
    }
    for (const child of node.content ?? []) visit(child);
  };

  visit(editorSchema);
  if (!visibleText.trim()) errors.push("El consentimiento debe incluir contenido visible.");
  const enabledSigners = [
    requiredSigners.patient.enabled,
    requiredSigners.professional.enabled,
    requiredSigners.representative.enabled
  ].filter(Boolean).length;
  if (enabledSigners === 0) errors.push("La plantilla debe incluir al menos un firmante.");
  if (requiredSigners.patient.required && !requiredSigners.patient.enabled) {
    errors.push("La firma del paciente no puede ser obligatoria si está deshabilitada.");
  }
  if (requiredSigners.professional.required && !requiredSigners.professional.enabled) {
    errors.push("La firma profesional no puede ser obligatoria si está deshabilitada.");
  }
  if (requiredSigners.representative.required && !requiredSigners.representative.enabled) {
    errors.push("La firma del representante no puede ser obligatoria si está deshabilitada.");
  }
  if (requiredSigners.representative.replacesPatient && !requiredSigners.representative.enabled) {
    errors.push("El representante solo puede sustituir al paciente cuando su firma está habilitada.");
  }
  if (variables.size === 0) warnings.push("La plantilla no utiliza variables automáticas.");

  return {
    errors: unique(errors),
    warnings: unique(warnings),
    manifest: [...variables].map((key) => VARIABLE_MAP.get(key)!).filter(Boolean),
    fieldKeys: [...fieldKeys]
  };
}

export function renderConsentHtml(
  editorSchema: unknown,
  values: Record<string, unknown>,
  options?: { preview?: boolean }
) {
  const renderNode = (candidate: unknown): string => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return "";
    const node = candidate as ConsentEditorNode;
    const children = (node.content ?? []).map(renderNode).join("");
    const alignment = ["left", "center", "right", "justify"].includes(stringAttr(node, "textAlign"))
      ? ` style="text-align:${stringAttr(node, "textAlign")}"`
      : "";
    switch (node.type) {
      case "doc":
        return children;
      case "paragraph":
        return `<p${alignment}>${children || "&nbsp;"}</p>`;
      case "heading": {
        const level = Math.min(3, Math.max(1, Number(node.attrs?.level) || 1));
        return `<h${level}${alignment}>${children}</h${level}>`;
      }
      case "bulletList":
        return `<ul>${children}</ul>`;
      case "orderedList":
        return `<ol>${children}</ol>`;
      case "listItem":
        return `<li>${children}</li>`;
      case "horizontalRule":
        return "<hr>";
      case "hardBreak":
        return "<br>";
      case "text": {
        let text = escapeHtml(node.text ?? "");
        for (const mark of node.marks ?? []) {
          if (mark.type === "bold") text = `<strong>${text}</strong>`;
          if (mark.type === "italic") text = `<em>${text}</em>`;
          if (mark.type === "strike") text = `<s>${text}</s>`;
        }
        return text;
      }
      case "consentToken": {
        const kind = stringAttr(node, "kind");
        const key = stringAttr(node, "key");
        const label = stringAttr(node, "label") || key;
        const config = parseConfig(node.attrs?.config);
        const fallback = stringValue(config.defaultValue) || VARIABLE_MAP.get(key)?.fallback || "Dato pendiente";
        const raw = values[key];
        const resolved = raw === null || raw === undefined || raw === "" ? fallback : formatValue(raw);
        const required = Boolean(config.required);
        const dataAttrs = options?.preview
          ? ` data-consent-token="${escapeHtml(kind)}" data-key="${escapeHtml(key)}"`
          : "";
        return `<span class="consent-field"${dataAttrs}><span class="consent-field__label">${escapeHtml(label)}${required ? " *" : ""}</span><span class="consent-field__value">${escapeHtml(resolved)}</span></span>`;
      }
      default:
        return "";
    }
  };
  return renderNode(editorSchema);
}

export function extractManualFieldDefinitions(editorSchema: unknown) {
  const fields: Array<{
    key: string;
    kind: string;
    label: string;
    required: boolean;
    config: Record<string, unknown>;
  }> = [];
  const visit = (candidate: unknown) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return;
    const node = candidate as ConsentEditorNode;
    if (node.type === "consentToken") {
      const kind = stringAttr(node, "kind");
      if (FIELD_KINDS.has(kind)) {
        const config = parseConfig(node.attrs?.config);
        fields.push({
          key: stringAttr(node, "key"),
          kind,
          label: stringAttr(node, "label"),
          required: Boolean(config.required),
          config
        });
      }
    }
    for (const child of node.content ?? []) visit(child);
  };
  visit(editorSchema);
  return fields;
}

export function validateManualValues(
  editorSchema: unknown,
  values: Record<string, unknown>
): string[] {
  const errors: string[] = [];
  for (const field of extractManualFieldDefinitions(editorSchema)) {
    const value = stringValue(values[field.key]);
    const minLength = numberValue(field.config.minLength);
    const maxLength = numberValue(field.config.maxLength);
    if (field.required && !value.trim()) errors.push(`El campo "${field.label}" es obligatorio.`);
    if (minLength !== null && value && value.length < minLength) {
      errors.push(`El campo "${field.label}" debe tener al menos ${minLength} caracteres.`);
    }
    if (maxLength !== null && value.length > maxLength) {
      errors.push(`El campo "${field.label}" no puede superar ${maxLength} caracteres.`);
    }
  }
  return errors;
}

export function requiredSignerTypes(config: RequiredSigners) {
  const result: string[] = [];
  if (config.patient.enabled && config.patient.required && !config.representative.replacesPatient) result.push("PATIENT");
  if (config.professional.enabled && config.professional.required) result.push("PROFESSIONAL");
  if (config.representative.enabled && config.representative.required) result.push("REPRESENTATIVE");
  return result;
}

export function enabledSignerTypes(config: RequiredSigners) {
  const result: string[] = [];
  if (config.patient.enabled) result.push("PATIENT");
  if (config.professional.enabled) result.push("PROFESSIONAL");
  if (config.representative.enabled) result.push("REPRESENTATIVE");
  return result;
}

export function parseRequiredSigners(value: unknown): RequiredSigners {
  const input = (value && typeof value === "object" ? value : {}) as Partial<RequiredSigners>;
  return {
    patient: {
      enabled: Boolean(input.patient?.enabled),
      required: Boolean(input.patient?.required)
    },
    professional: {
      enabled: Boolean(input.professional?.enabled),
      required: Boolean(input.professional?.required),
      mode: ["TREATMENT_PROFESSIONAL", "MANUAL", "ANY_AUTHORIZED"].includes(input.professional?.mode ?? "")
        ? input.professional!.mode
        : "ANY_AUTHORIZED"
    },
    representative: {
      enabled: Boolean(input.representative?.enabled),
      required: Boolean(input.representative?.required),
      replacesPatient: Boolean(input.representative?.replacesPatient)
    }
  };
}

export function contentHash(payload: unknown) {
  return createHash("sha256").update(stableStringify(payload), "utf8").digest("hex");
}

export function assertDocumentHash(actual: string, received: string) {
  if (!received || actual !== received) {
    throw new BadRequestException("El documento cambió. Actualiza la vista previa antes de firmar.");
  }
}

export function htmlToPlainText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|h[1-3]|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function variable(
  key: string,
  label: string,
  category: string,
  dataType: ConsentVariableDefinition["dataType"],
  sensitive: boolean,
  source: string,
  fallback: string
): ConsentVariableDefinition {
  return { key, label, category, dataType, sensitive, source, fallback };
}

function stringAttr(node: ConsentEditorNode, key: string) {
  const value = node.attrs?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function parseConfig(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}

function formatValue(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function stringValue(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function numberValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function unique(values: string[]) {
  return [...new Set(values)];
}
