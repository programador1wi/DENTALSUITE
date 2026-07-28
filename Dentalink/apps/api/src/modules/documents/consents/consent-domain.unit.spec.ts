import { BadRequestException } from "@nestjs/common";
import {
  assertDocumentHash,
  contentHash,
  extractManualFieldDefinitions,
  renderConsentHtml,
  requiredSignerTypes,
  validateConsentTemplate,
  validateManualValues,
  type RequiredSigners
} from "./consent-domain";

const SIGNERS: RequiredSigners = {
  patient: { enabled: true, required: true },
  professional: { enabled: true, required: true, mode: "TREATMENT_PROFESSIONAL" },
  representative: { enabled: false, required: false, replacesPatient: false }
};

describe("consent domain", () => {
  it("rejects duplicate manual keys and unknown variables", () => {
    const editor = {
      type: "doc",
      content: [
        token("FREE_TEXT", "diagnosis", "Diagnóstico"),
        token("FREE_TEXT", "diagnosis", "Diagnóstico repetido"),
        token("VARIABLE", "patient.private_property", "Variable no autorizada")
      ]
    };

    const result = validateConsentTemplate(editor, SIGNERS);

    expect(result.errors).toEqual(
      expect.arrayContaining([
        'La clave de campo "diagnosis" está repetida.',
        'La variable "patient.private_property" no existe en el catálogo autorizado.'
      ])
    );
  });

  it("renders only the allow-listed document structure and escapes values", () => {
    const editor = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Paciente: ", marks: [{ type: "bold" }] },
            token("VARIABLE", "patient.full_name", "Paciente")
          ]
        }
      ]
    };

    const html = renderConsentHtml(editor, { "patient.full_name": '<img src=x onerror="alert(1)">' });

    expect(html).toContain("<strong>Paciente: </strong>");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).not.toContain("<img");
  });

  it("extracts and validates manual fields on the backend", () => {
    const editor = {
      type: "doc",
      content: [
        token("FREE_TEXT", "allergy_note", "Alergias", {
          required: true,
          minLength: 5,
          maxLength: 20
        })
      ]
    };

    expect(extractManualFieldDefinitions(editor)).toEqual([
      expect.objectContaining({ key: "allergy_note", required: true })
    ]);
    expect(validateManualValues(editor, { allergy_note: "" })).toContain('El campo "Alergias" es obligatorio.');
    expect(validateManualValues(editor, { allergy_note: "abc" })).toContain(
      'El campo "Alergias" debe tener al menos 5 caracteres.'
    );
    expect(validateManualValues(editor, { allergy_note: "Sin alergias" })).toEqual([]);
  });

  it("produces a stable SHA-256 hash independent of object key order", () => {
    const first = contentHash({ templateVersionId: "v1", values: { b: 2, a: 1 } });
    const second = contentHash({ values: { a: 1, b: 2 }, templateVersionId: "v1" });

    expect(first).toHaveLength(64);
    expect(first).toBe(second);
  });

  it("requires the representative instead of the patient when configured", () => {
    const signers: RequiredSigners = {
      ...SIGNERS,
      representative: { enabled: true, required: true, replacesPatient: true }
    };

    expect(requiredSignerTypes(signers)).toEqual(["PROFESSIONAL", "REPRESENTATIVE"]);
  });

  it("rejects a signature submitted for a different document hash", () => {
    expect(() => assertDocumentHash("a".repeat(64), "b".repeat(64))).toThrow(BadRequestException);
  });
});

function token(kind: string, key: string, label: string, config: Record<string, unknown> = {}) {
  return {
    type: "consentToken",
    attrs: {
      kind,
      key,
      label,
      config: JSON.stringify(config)
    }
  };
}
