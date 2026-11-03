import { describe, expect, it } from "vitest";
import { clinicalDocumentContentToPlainText, normalizeClinicalDocumentContent } from "./clinical-document-content";

describe("clinical document content", () => {
  it("converts legacy plain text into a structured text block", () => {
    const content = normalizeClinicalDocumentContent("Aviso de privacidad");
    expect(content.blocks).toEqual([{ id: "legacy-text", type: "text", text: "Aviso de privacidad" }]);
  });

  it("keeps row children and renders plain text for searches/previews", () => {
    const content = normalizeClinicalDocumentContent({
      blocks: [
        { id: "title", type: "title", text: "Consentimiento" },
        { id: "row", type: "row", children: [{ id: "left", type: "text", text: "Paciente" }, { id: "right", type: "text", text: "Firma" }] }
      ]
    });

    expect(content.blocks).toHaveLength(2);
    expect(clinicalDocumentContentToPlainText(content)).toContain("Consentimiento");
    expect(clinicalDocumentContentToPlainText(content)).toContain("Paciente Firma");
  });
});
