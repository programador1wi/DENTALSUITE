import { BadRequestException } from "@nestjs/common";
import { PhoneNormalizationService } from "./phone-normalization.service";

describe("PhoneNormalizationService", () => {
  const service = new PhoneNormalizationService();

  it("normalizes a Mexican phone to E.164", () => {
    const result = service.normalize("55 1234 5678", "MX");

    expect(result.normalizedValue).toBe("+525512345678");
    expect(result.countryCode).toBe("MX");
    expect(result.nationalNumber).toBe("5512345678");
    expect(result.warnings).toContain("COUNTRY_INFERRED");
  });

  it("preserves an explicit international number", () => {
    const result = service.normalize("+1 202-555-0123", "MX");

    expect(result.normalizedValue).toBe("+12025550123");
    expect(result.countryCode).toBe("US");
    expect(result.warnings).toEqual([]);
  });

  it("rejects invalid phone numbers", () => {
    expect(() => service.normalize("123", "MX")).toThrow(BadRequestException);
  });
});
