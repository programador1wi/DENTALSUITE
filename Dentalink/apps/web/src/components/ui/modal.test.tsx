import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Modal } from "./modal";

afterEach(() => {
  cleanup();
  document.getElementById("root")?.remove();
});

function ModalHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Abrir detalle
      </button>
      <Modal open={open} title="Detalle de caja" mobilePresentation="sheet" footer={<button type="button">Guardar detalle</button>} onClose={() => setOpen(false)}>
        Contenido
      </Modal>
    </>
  );
}

describe("Modal", () => {
  it("moves focus before making the application inert and restores it on close", () => {
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
    render(<ModalHarness />, { container: root });

    const trigger = screen.getByRole("button", { name: "Abrir detalle" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Guardar detalle" })).toBeInTheDocument();
    expect(root.inert).toBe(true);
    expect(root).not.toHaveAttribute("aria-hidden");

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(root.inert).toBe(false);
    expect(trigger).toHaveFocus();
  });
});
