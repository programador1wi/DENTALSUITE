import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClinicalDocumentBlockEditor } from "./clinical-document-block-editor";
import { emptyClinicalDocumentContent } from "./clinical-document-content";

describe("ClinicalDocumentBlockEditor", () => {
  it("adds editable blocks", () => {
    const onChange = vi.fn();
    render(<ClinicalDocumentBlockEditor value={emptyClinicalDocumentContent()} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Agregar titulo/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ blocks: [expect.objectContaining({ type: "title" })] }));
  });

  it("edits text block content", () => {
    const onChange = vi.fn();
    render(
      <ClinicalDocumentBlockEditor
        value={{ version: "clinical-doc-blocks/v1", blocks: [{ id: "text-1", type: "text", text: "Inicial" }] }}
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByLabelText("Texto del bloque"), { target: { value: "Actualizado" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ blocks: [expect.objectContaining({ text: "Actualizado" })] }));
  });
});
