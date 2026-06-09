import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HelpTooltip } from "./help-tooltip";

function rect(values: Partial<DOMRect>): DOMRect {
  return {
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: values.left ?? 0,
    y: values.top ?? 0,
    toJSON: () => ({}),
    ...values
  } as DOMRect;
}

function mockRects({
  tooltip,
  trigger
}: {
  tooltip: Partial<DOMRect>;
  trigger: Partial<DOMRect>;
}) {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function getBoundingClientRect(this: HTMLElement) {
    if (this.getAttribute("role") === "tooltip") return rect(tooltip);
    return rect(trigger);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("HelpTooltip", () => {
  it("renders hover content in a body portal", async () => {
    mockRects({
      tooltip: { height: 48, width: 180 },
      trigger: { bottom: 140, height: 20, left: 80, right: 100, top: 120, width: 20 }
    });

    const { container } = render(<HelpTooltip content="Detalle operativo" />);
    const trigger = screen.getByRole("button", { name: "Ayuda del sistema" });

    fireEvent.mouseEnter(trigger);

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("Detalle operativo");
    expect(document.body).toContainElement(tooltip);
    expect(container).not.toContainElement(tooltip);
    expect(tooltip).toHaveStyle({ visibility: "visible" });
  });

  it("opens on focus and closes on Escape", async () => {
    mockRects({
      tooltip: { height: 48, width: 180 },
      trigger: { bottom: 80, height: 20, left: 80, right: 100, top: 60, width: 20 }
    });

    render(<HelpTooltip content="Ayuda con teclado" />);

    fireEvent.focus(screen.getByRole("button", { name: "Ayuda del sistema" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Ayuda con teclado");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("falls back from the preferred side and clamps to the viewport", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 200 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 120 });
    mockRects({
      tooltip: { height: 48, width: 120 },
      trigger: { bottom: 26, height: 12, left: 180, right: 192, top: 14, width: 12 }
    });

    render(
      <HelpTooltip content="Accion lateral" position="right">
        <button type="button">Accion</button>
      </HelpTooltip>
    );

    fireEvent.mouseEnter(screen.getByRole("button", { name: "Accion" }));

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveStyle({ left: "50px", top: "12px" });
  });
});
