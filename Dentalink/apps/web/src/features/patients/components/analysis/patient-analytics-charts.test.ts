import { describe, expect, it } from "vitest";
import { resolvePatientAnalyticsGlobalDetailMetric } from "./patient-analytics-charts";

describe("patient analytics detail metric contract", () => {
  it.each([
    ["totalPatients", "patients"],
    ["averageAttendance", "attendance"],
    ["accumulatedDebt", "debt"],
    ["pendingBudgets", "pending-budgets"],
    ["confirmed", "confirmed"]
  ])("maps dashboard metric %s to API detail metric %s", (input, expected) => {
    expect(resolvePatientAnalyticsGlobalDetailMetric(input)).toBe(expected);
  });
});
