import { marketingReportDefinitions } from "./email-marketing.catalog";

describe("email marketing report catalog", () => {
  const expectedParameters: Record<string, string[]> = {
    PATIENTS_TREATED_BY_PROFESSIONAL: ["professionalId"],
    PATIENTS_INACTIVE_MONTHS: ["months", "branchId", "professionalId", "includeCancelled", "cutoffDate"],
    PATIENTS_NEW_SINCE: ["dateFrom", "branchId"],
    PATIENTS_LAST_APPOINTMENT_MONTHS: ["months", "branchId", "professionalId"],
    BUDGETS_NOT_STARTED_MONTH: ["month", "branchId", "professionalId"],
    PATIENTS_BY_AGREEMENT: ["agreementId", "branchId"],
    BUDGETS_UNFINISHED_BETWEEN: ["dateFrom", "dateTo", "branchId", "professionalId"],
    BIRTHDAYS_THIS_MONTH: ["branchId"],
    BIRTHDAYS_TODAY: ["branchId"],
    ALL_PATIENTS: ["branchId"],
    DEBTOR_PATIENTS: ["branchId"],
    PATIENTS_DEBT_UNTIL_DATE: ["cutoffDate", "branchId"],
    PATIENTS_ATTENDED_TODAY: ["branchId", "professionalId"],
    PATIENTS_BY_TYPE: ["patientStatus", "branchId"]
  };

  it("declares the exact contextual parameters for every report", () => {
    expect(marketingReportDefinitions).toHaveLength(14);
    expect(new Set(marketingReportDefinitions.map((report) => report.code)).size).toBe(14);

    for (const report of marketingReportDefinitions) {
      expect([
        ...report.requiredParameters.map((parameter) => parameter.key),
        ...report.optionalParameters.map((parameter) => parameter.key)
      ]).toEqual(expectedParameters[report.code]);
    }
  });

  it("publishes controlled choices for intervals and patient classification", () => {
    const inactive = marketingReportDefinitions.find((report) => report.code === "PATIENTS_INACTIVE_MONTHS");
    const patientType = marketingReportDefinitions.find((report) => report.code === "PATIENTS_BY_TYPE");

    expect(inactive?.requiredParameters[0]?.options?.map((option) => option.value)).toEqual([
      1, 2, 3, 6, 9, 12, 18, 24
    ]);
    expect(patientType?.requiredParameters[0]?.options?.map((option) => option.value)).toEqual([
      "NEW",
      "ACTIVE",
      "IN_TREATMENT",
      "INACTIVE",
      "DEBTOR",
      "COMPLETED"
    ]);
  });

  it("uses the registered-email-only policy for patients treated by a professional", () => {
    const treated = marketingReportDefinitions.find(
      (report) => report.code === "PATIENTS_TREATED_BY_PROFESSIONAL"
    );

    expect(treated).toEqual(
      expect.objectContaining({
        eligibilityPolicy: "REGISTERED_EMAIL_ONLY",
        supportedScopes: ["ORGANIZATION"]
      })
    );
  });
});
