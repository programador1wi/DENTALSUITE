import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConsentTemplateEditor } from "./consent-template-editor";

describe("ConsentTemplateEditor", () => {
  beforeEach(() => {
    const emptyRects = () => ({
      length: 0,
      item: () => null,
      [Symbol.iterator]: function* iterator() {}
    }) as DOMRectList;
    Range.prototype.getClientRects = emptyRects;
    Range.prototype.getBoundingClientRect = () => new DOMRect();
  });

  it("inserts manual fields as atomic structured nodes", async () => {
    const onChange = vi.fn();
    render(
      <ConsentTemplateEditor
        value={{ type: "doc", content: [{ type: "paragraph" }] }}
        onChange={onChange}
        variables={[]}
      />
    );

    fireEvent.click(await screen.findByRole("button", { name: "Texto libre" }));
    fireEvent.change(screen.getByLabelText("Clave interna"), { target: { value: "diagnostico_previo" } });
    fireEvent.change(screen.getByLabelText("Etiqueta visible"), { target: { value: "Diagnóstico previo" } });
    fireEvent.click(screen.getByRole("button", { name: "Insertar campo" }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const editorJson = onChange.mock.calls.at(-1)?.[0];
    expect(JSON.stringify(editorJson)).toContain('"type":"consentToken"');
    expect(JSON.stringify(editorJson)).toContain('"key":"diagnostico_previo"');
    expect(JSON.stringify(editorJson)).toContain('"kind":"FREE_TEXT"');
  });

  it("inserts only catalogued variables", async () => {
    const onChange = vi.fn();
    render(
      <ConsentTemplateEditor
        value={{ type: "doc", content: [{ type: "paragraph" }] }}
        onChange={onChange}
        variables={[
          {
            key: "patient.full_name",
            label: "Nombre completo del paciente",
            category: "Paciente",
            dataType: "text",
            sensitive: false,
            source: "Patient",
            fallback: "Dato no disponible"
          }
        ]}
      />
    );

    fireEvent.change(await screen.findByLabelText("Variable dinámica"), {
      target: { value: "patient.full_name" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Insertar" }));

    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(JSON.stringify(onChange.mock.calls.at(-1)?.[0])).toContain('"key":"patient.full_name"');
    expect(JSON.stringify(onChange.mock.calls.at(-1)?.[0])).toContain('"kind":"VARIABLE"');
  });
});
