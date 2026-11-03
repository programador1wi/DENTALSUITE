import { sanitizeString, sanitizeUnknown } from "./sanitize.util";

describe("sanitize util", () => {
  it("sanitizes html and control chars in string", () => {
    expect(sanitizeString(" <b>hello</b>\u0000 ")).toBe("hello");
  });

  it("sanitizes nested payload recursively", () => {
    const payload = {
      name: "<script>alert(1)</script>Maria",
      nested: [{ note: " ok\u0007 " }]
    };

    expect(sanitizeUnknown(payload)).toEqual({
      name: "Maria",
      nested: [{ note: "ok" }]
    });
  });
});
