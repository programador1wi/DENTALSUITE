import { sanitizePlainText, sanitizeRichTextHtml } from "./sanitize-rich-text.util";

describe("sanitize rich text", () => {
  it("keeps allowlisted formatting and normalizes safe links", () => {
    const sanitized = sanitizeRichTextHtml(
      '<h2>Indicaciones</h2><p><strong>Control</strong></p><a href="https://example.com">Abrir</a>'
    );

    expect(sanitized).toContain("<h2>Indicaciones</h2>");
    expect(sanitized).toContain("<strong>Control</strong>");
    expect(sanitized).toContain('target="_blank"');
    expect(sanitized).toContain('rel="noopener noreferrer"');
  });

  it("removes executable tags, handlers, styles and active URL schemes", () => {
    const sanitized = sanitizeRichTextHtml(
      '<svg onload="steal()"></svg><script>alert(1)</script><p style="background:url(javascript:x)" onclick="x()">Texto</p><a href="jav&#x61;script:alert(1)">link</a>'
    );

    expect(sanitized).not.toMatch(/svg|script|onload|onclick|style=|javascript:/i);
    expect(sanitized).toContain("Texto");
    expect(sanitized).toContain("link");
  });

  it("converts plain-text fields without preserving markup or control characters", () => {
    expect(sanitizePlainText(" <b>Paciente</b>\u0000 ")).toBe("Paciente");
  });
});
