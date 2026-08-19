import { describe, expect, it } from "vitest";
import { formatPatientNumber, getPatientRouteId } from "./patient-id";

describe("formatPatientNumber", () => {
  it("formats integer numbers to 6 digits with leading zeros", () => {
    expect(formatPatientNumber(1)).toBe("000001");
    expect(formatPatientNumber(152)).toBe("000152");
    expect(formatPatientNumber(999999)).toBe("999999");
  });

  it("handles string representations of numbers", () => {
    expect(formatPatientNumber("152")).toBe("000152");
    expect(formatPatientNumber("  42  ")).toBe("000042");
  });

  it("returns fallback ID when patientNumber is null or undefined", () => {
    expect(formatPatientNumber(null, "fallback-id")).toBe("fallback-id");
    expect(formatPatientNumber(undefined, "fallback-id")).toBe("fallback-id");
    expect(formatPatientNumber(undefined)).toBe("");
  });
});

describe("getPatientRouteId", () => {
  it("prefers formatted patientNumber when present", () => {
    expect(getPatientRouteId({ id: "cmre5akn10001awuss4hm8rg4", patientNumber: 152 })).toBe("000152");
  });

  it("falls back to id when patientNumber is missing", () => {
    expect(getPatientRouteId({ id: "cmre5akn10001awuss4hm8rg4", patientNumber: null })).toBe("cmre5akn10001awuss4hm8rg4");
    expect(getPatientRouteId({ id: "cmre5akn10001awuss4hm8rg4" })).toBe("cmre5akn10001awuss4hm8rg4");
  });

  it("handles null or undefined patient gracefully", () => {
    expect(getPatientRouteId(null)).toBe("");
    expect(getPatientRouteId(undefined)).toBe("");
  });
});
