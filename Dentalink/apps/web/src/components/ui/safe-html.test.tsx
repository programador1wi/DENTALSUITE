import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { SafeHtml, SafeSvg, sanitizeHtml } from "./safe-html";

describe("SafeHtml and sanitizeHtml (XSS-01)", () => {
  it("strips malicious script tags", () => {
    const dirty = '<p>Hola</p><script>alert("XSS")</script>';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain("<script>");
    expect(clean).toContain("<p>Hola</p>");
  });

  it("strips onerror event handlers and javascript: URLs", () => {
    const dirty = '<a href="javascript:alert(1)" onclick="steal()" title="Link">Click</a><img src="x" onerror="alert(2)" />';
    const clean = sanitizeHtml(dirty);
    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("<img");
    expect(clean).toContain("Click");
  });

  it("renders safe HTML elements correctly", () => {
    const { container } = render(<SafeHtml html="<p><strong>Texto seguro</strong></p>" />);
    expect(container.querySelector("strong")?.textContent).toBe("Texto seguro");
  });

  it("removes SVG, MathML, style and encoded active links", () => {
    const dirty = [
      '<svg><a href="javascript:alert(1)"><text>svg</text></a></svg>',
      '<math><mi xlink:href="data:text/html,x">math</mi></math>',
      '<p style="background:url(javascript:alert(1))">Texto</p>',
      '<a href="jav&#x61;script:alert(1)">enlace</a>'
    ].join("");
    const clean = sanitizeHtml(dirty);

    expect(clean).not.toMatch(/svg|math|style=|javascript:|data:/i);
    expect(clean).toContain("Texto");
  });

  it("forces safe link isolation", () => {
    const clean = sanitizeHtml('<a href="https://example.com" target="_self">Abrir</a>');
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it("sanitizes locally loaded SVG markup before rendering", () => {
    const { container } = render(
      <SafeSvg markup={'<svg><path id="tooth" d="M0 0h1v1z"/><script>alert(1)</script><foreignObject><iframe src="https://evil.test" /></foreignObject></svg>'} />
    );

    expect(container.querySelector("path#tooth")).not.toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("foreignObject")).toBeNull();
    expect(container.querySelector("iframe")).toBeNull();
  });
});
