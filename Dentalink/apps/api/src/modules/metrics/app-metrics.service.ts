import { Injectable } from "@nestjs/common";

const LATENCY_BUCKETS_MS = [100, 250, 500, 800, 1_000, 2_500, 5_000] as const;
const MAX_HTTP_SERIES = 2_000;

type HttpMetric = {
  count: number;
  durationMsSum: number;
  buckets: number[];
};

@Injectable()
export class AppMetricsService {
  private readonly startedAt = Date.now();
  private readonly http = new Map<string, HttpMetric>();
  private readonly appointmentReminders = new Map<string, number>();
  private appointmentReminderBacklog = 0;
  private appointmentReminderOldestSeconds = 0;
  private appointmentReminderCircuit = "closed";

  recordAppointmentReminder(stage: string, result: string) {
    const key = JSON.stringify([stage, result]);
    this.appointmentReminders.set(key, (this.appointmentReminders.get(key) ?? 0) + 1);
  }

  setAppointmentReminderBacklog(count: number, oldestSeconds: number) {
    this.appointmentReminderBacklog = count;
    this.appointmentReminderOldestSeconds = oldestSeconds;
  }

  setAppointmentReminderCircuit(status: "closed" | "open" | "redis_unavailable") {
    this.appointmentReminderCircuit = status;
  }

  recordHttpRequest(method: string, endpoint: string, statusCode: number, durationMs: number) {
    let normalizedEndpoint = this.normalizeEndpoint(endpoint);
    let key = JSON.stringify([method.toUpperCase(), normalizedEndpoint, statusCode]);
    if (!this.http.has(key) && this.http.size >= MAX_HTTP_SERIES) {
      normalizedEndpoint = "/__cardinality_overflow__";
      key = JSON.stringify([method.toUpperCase(), normalizedEndpoint, statusCode]);
    }
    const metric = this.http.get(key) ?? {
      count: 0,
      durationMsSum: 0,
      buckets: LATENCY_BUCKETS_MS.map(() => 0)
    };
    metric.count += 1;
    metric.durationMsSum += durationMs;
    LATENCY_BUCKETS_MS.forEach((bucket, index) => {
      if (durationMs <= bucket) metric.buckets[index] += 1;
    });
    this.http.set(key, metric);
  }

  renderPrometheus() {
    const lines = [
      "# HELP dentalink_process_uptime_seconds Process uptime in seconds.",
      "# TYPE dentalink_process_uptime_seconds gauge",
      `dentalink_process_uptime_seconds ${Math.floor((Date.now() - this.startedAt) / 1000)}`,
      "# HELP dentalink_http_requests_total HTTP requests completed.",
      "# TYPE dentalink_http_requests_total counter",
      "# HELP dentalink_http_request_duration_ms HTTP request duration in milliseconds.",
      "# TYPE dentalink_http_request_duration_ms histogram",
      "# HELP dentalink_http_5xx_total HTTP responses with status 500 or greater.",
      "# TYPE dentalink_http_5xx_total counter",
      "# HELP dentalink_appointment_reminders_total Appointment reminder outcomes by stage and result.",
      "# TYPE dentalink_appointment_reminders_total counter",
      "# HELP dentalink_appointment_reminder_backlog Pending and retryable appointment reminder jobs.",
      "# TYPE dentalink_appointment_reminder_backlog gauge",
      "# HELP dentalink_appointment_reminder_oldest_seconds Age of the oldest pending reminder job.",
      "# TYPE dentalink_appointment_reminder_oldest_seconds gauge",
      "# HELP dentalink_appointment_reminder_smtp_circuit SMTP circuit state (one-hot).",
      "# TYPE dentalink_appointment_reminder_smtp_circuit gauge"
    ];

    let total5xx = 0;
    for (const [key, metric] of this.http.entries()) {
      const [method, endpoint, statusCode] = JSON.parse(key) as [string, string, number];
      const labels = `method="${method}",endpoint="${endpoint}",status="${statusCode}"`;
      lines.push(`dentalink_http_requests_total{${labels}} ${metric.count}`);
      LATENCY_BUCKETS_MS.forEach((bucket, index) => {
        lines.push(
          `dentalink_http_request_duration_ms_bucket{${labels},le="${bucket}"} ${metric.buckets[index]}`
        );
      });
      lines.push(`dentalink_http_request_duration_ms_bucket{${labels},le="+Inf"} ${metric.count}`);
      lines.push(`dentalink_http_request_duration_ms_sum{${labels}} ${metric.durationMsSum}`);
      lines.push(`dentalink_http_request_duration_ms_count{${labels}} ${metric.count}`);
      if (statusCode >= 500) total5xx += metric.count;
    }
    lines.push(`dentalink_http_5xx_total ${total5xx}`);
    for (const [key, count] of this.appointmentReminders.entries()) {
      const [stage, result] = JSON.parse(key) as [string, string];
      lines.push(`dentalink_appointment_reminders_total{stage="${stage}",result="${result}"} ${count}`);
    }
    lines.push(`dentalink_appointment_reminder_backlog ${this.appointmentReminderBacklog}`);
    lines.push(`dentalink_appointment_reminder_oldest_seconds ${this.appointmentReminderOldestSeconds}`);
    for (const state of ["closed", "open", "redis_unavailable"]) {
      lines.push(
        `dentalink_appointment_reminder_smtp_circuit{state="${state}"} ${state === this.appointmentReminderCircuit ? 1 : 0}`
      );
    }
    return `${lines.join("\n")}\n`;
  }

  private normalizeEndpoint(endpoint: string) {
    return endpoint
      .split("?")[0]
      .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, ":id")
      .replace(/\b(?:c[a-z0-9]{20,}|\d{3,})\b/gi, ":id")
      .replace(/["\\\n\r]/g, "_");
  }
}
