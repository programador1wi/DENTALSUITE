import { AppMetricsService } from "./app-metrics.service";

describe("AppMetricsService", () => {
  it("exports bounded endpoint labels, latency buckets, and 5xx totals", () => {
    const metrics = new AppMetricsService();
    metrics.recordHttpRequest(
      "GET",
      "/api/v1/patients/123456?accessToken=secret",
      200,
      240
    );
    metrics.recordHttpRequest("POST", "/api/v1/payments/cmk12345678901234567890", 500, 900);

    const output = metrics.renderPrometheus();

    expect(output).toContain('endpoint="/api/v1/patients/:id"');
    expect(output).toContain('le="250"} 1');
    expect(output).toContain("dentalink_http_5xx_total 1");
    expect(output).not.toContain("secret");
    expect(output).not.toContain("123456");
    expect(output).not.toContain("cmk12345678901234567890");
  });
});
