import { validateEnvironment } from "./environment.validation";

const strongEnvironment = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://database.internal/dentalink",
  REDIS_URL: "redis://redis.internal:6379",
  CORS_ORIGINS: "https://app.dental.example",
  JWT_ACCESS_SECRET: "access-key-abcdefghijklmnopqrstuvwxyz-123456",
  JWT_REFRESH_SECRET: "refresh-key-abcdefghijklmnopqrstuvwxyz-654321",
  METRICS_BEARER_TOKEN: "metrics-key-abcdefghijklmnopqrstuvwxyz-1234",
  CONSENT_STORAGE_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  REPORT_STORAGE_ENCRYPTION_KEY: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
  STORAGE_BACKUP_ENCRYPTION_KEY: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  CLINICAL_STORAGE_ENCRYPTION_KEY: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
  OBJECT_STORAGE_PROVIDER: "s3",
  S3_ENDPOINT: "https://storage.dental.example",
  S3_BUCKET: "dentalink-clinical",
  S3_ACCESS_KEY_ID: "production-access-key",
  S3_SECRET_ACCESS_KEY: "s3-key-abcdefghijklmnopqrstuvwxyz-9876543210",
  MALWARE_SCANNER_PROVIDER: "clamav",
  CLAMAV_HOST: "clamav.internal",
  AUTH_INCLUDE_REFRESH_TOKEN_IN_RESPONSE: "false"
};

describe("validateEnvironment", () => {
  it("keeps local development compatible with the documented defaults", () => {
    expect(
      validateEnvironment({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://localhost/dentalink",
        JWT_ACCESS_SECRET: "change-me-access-secret",
        JWT_REFRESH_SECRET: "change-me-refresh-secret"
      })
    ).toBeDefined();
  });

  it("accepts a hardened production configuration", () => {
    expect(validateEnvironment({ ...strongEnvironment })).toMatchObject(strongEnvironment);
  });

  it("rejects enabled email without complete SMTP settings", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://localhost/dentalink",
        JWT_ACCESS_SECRET: "change-me-access-secret",
        JWT_REFRESH_SECRET: "change-me-refresh-secret",
        MAIL_ENABLED: "true"
      })
    ).toThrow("MAIL_ENABLED requires");
  });

  it("rejects an appointment reminder worker without email delivery", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://localhost/dentalink",
        JWT_ACCESS_SECRET: "change-me-access-secret",
        JWT_REFRESH_SECRET: "change-me-refresh-secret",
        APPOINTMENT_REMINDER_WORKER_ENABLED: "true",
        MAIL_ENABLED: "false"
      })
    ).toThrow("APPOINTMENT_REMINDER_WORKER_ENABLED requires MAIL_ENABLED=true");
  });

  it("rejects a survey worker without email delivery", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://localhost/dentalink",
        JWT_ACCESS_SECRET: "change-me-access-secret",
        JWT_REFRESH_SECRET: "change-me-refresh-secret",
        SURVEY_WORKER_ENABLED: "true",
        MAIL_ENABLED: "false"
      })
    ).toThrow("SURVEY_WORKER_ENABLED requires MAIL_ENABLED=true");
  });

  it("requires a fixed organization for each booking bot credential", () => {
    expect(() =>
      validateEnvironment({
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://localhost/dentalink",
        JWT_ACCESS_SECRET: "change-me-access-secret",
        JWT_REFRESH_SECRET: "change-me-refresh-secret",
        BOOKING_BOT_API_KEY: "configured-bot-secret"
      })
    ).toThrow("BOOKING_BOT_API_KEY and BOOKING_BOT_ORGANIZATION_ID must be configured together");
  });

  it("rejects unsafe appointment reminder polling and cooldown intervals", () => {
    const localEnvironment = {
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://localhost/dentalink",
      JWT_ACCESS_SECRET: "change-me-access-secret",
      JWT_REFRESH_SECRET: "change-me-refresh-secret"
    };

    expect(() =>
      validateEnvironment({ ...localEnvironment, APPOINTMENT_REMINDER_WORKER_INTERVAL_MS: "1000" })
    ).toThrow("APPOINTMENT_REMINDER_WORKER_INTERVAL_MS");
    expect(() =>
      validateEnvironment({ ...localEnvironment, APPOINTMENT_REMINDER_PROVIDER_COOLDOWN_MS: "invalid" })
    ).toThrow("APPOINTMENT_REMINDER_PROVIDER_COOLDOWN_MS");
  });

  it.each([
    ["weak JWT access secret", { JWT_ACCESS_SECRET: "change-me-access-secret" }],
    ["refresh token in JSON", { AUTH_INCLUDE_REFRESH_TOKEN_IN_RESPONSE: "true" }],
    ["localhost CORS", { CORS_ORIGINS: "http://localhost:3000" }],
    ["invalid consent encryption key", { CONSENT_STORAGE_ENCRYPTION_KEY: "too-short" }],
    ["local clinical storage", { OBJECT_STORAGE_PROVIDER: "local" }],
    ["disabled malware scanner", { MALWARE_SCANNER_PROVIDER: "development" }],
    ["localhost S3", { S3_ENDPOINT: "http://localhost:9000" }],
    ["placeholder S3 secret", { S3_SECRET_ACCESS_KEY: "replace-with-a-production-secret-value" }],
    ["invalid ClamAV port", { CLAMAV_PORT: "70000" }],
    ["missing metrics token", { METRICS_BEARER_TOKEN: "" }]
  ])("rejects %s in production", (_label, override) => {
    expect(() => validateEnvironment({ ...strongEnvironment, ...override })).toThrow();
  });
});
