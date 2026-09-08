const requiredEnv = ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const;
const productionRequiredEnv = [
  "REDIS_URL",
  "CORS_ORIGINS",
  "METRICS_BEARER_TOKEN",
  "CONSENT_STORAGE_ENCRYPTION_KEY",
  "REPORT_STORAGE_ENCRYPTION_KEY",
  "STORAGE_BACKUP_ENCRYPTION_KEY",
  "CLINICAL_STORAGE_ENCRYPTION_KEY",
  "OBJECT_STORAGE_PROVIDER",
  "S3_ENDPOINT",
  "S3_BUCKET",
  "S3_ACCESS_KEY_ID",
  "S3_SECRET_ACCESS_KEY",
  "MALWARE_SCANNER_PROVIDER",
  "CLAMAV_HOST"
] as const;

const unsafeSecretFragments = ["change-me", "replace-with", "example", "password", "secret"];

function assertStrongSecret(config: Record<string, string | undefined>, key: string) {
  const value = config[key]?.trim() ?? "";
  const normalized = value.toLowerCase();
  if (value.length < 32 || unsafeSecretFragments.some((fragment) => normalized.includes(fragment))) {
    throw new Error(`${key} must be at least 32 characters and must not use a placeholder in production`);
  }
}

function isThirtyTwoByteKey(value: string) {
  if (/^[a-f0-9]{64}$/i.test(value)) return true;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  try {
    return Buffer.from(value, "base64").length === 32;
  } catch {
    return false;
  }
}

export function validateEnvironment(config: Record<string, string | undefined>): Record<string, string> {
  const missing = requiredEnv.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  const mailEnabled = (config.MAIL_ENABLED ?? "false").toLowerCase() === "true";
  const reminderWorkerEnabled =
    (config.APPOINTMENT_REMINDER_WORKER_ENABLED ?? "false").toLowerCase() === "true";
  const surveyWorkerEnabled = (config.SURVEY_WORKER_ENABLED ?? "false").toLowerCase() === "true";

  if (mailEnabled) {
    const missingMail = ["MAIL_HOST", "MAIL_USER", "MAIL_PASSWORD", "MAIL_FROM_ADDRESS"].filter(
      (key) => !config[key]?.trim()
    );
    if (missingMail.length > 0) {
      throw new Error(`MAIL_ENABLED requires: ${missingMail.join(", ")}`);
    }
  }

  if (reminderWorkerEnabled && !mailEnabled) {
    throw new Error("APPOINTMENT_REMINDER_WORKER_ENABLED requires MAIL_ENABLED=true");
  }
  if (surveyWorkerEnabled && !mailEnabled) {
    throw new Error("SURVEY_WORKER_ENABLED requires MAIL_ENABLED=true");
  }
  if (Boolean(config.BOOKING_BOT_API_KEY?.trim()) !== Boolean(config.BOOKING_BOT_ORGANIZATION_ID?.trim())) {
    throw new Error("BOOKING_BOT_API_KEY and BOOKING_BOT_ORGANIZATION_ID must be configured together");
  }

  for (const [key, minimum] of [
    ["APPOINTMENT_REMINDER_WORKER_INTERVAL_MS", 5_000],
    ["APPOINTMENT_REMINDER_PROVIDER_COOLDOWN_MS", 60_000],
    ["APPOINTMENT_REMINDER_LEASE_MS", 15_000],
    ["SURVEY_WORKER_INTERVAL_MS", 2_000],
    ["SURVEY_WORKER_LEASE_MS", 15_000]
  ] as const) {
    if (config[key] !== undefined) {
      const value = Number(config[key]);
      if (!Number.isFinite(value) || value < minimum) {
        throw new Error(`${key} must be a number greater than or equal to ${minimum}`);
      }
    }
  }

  for (const [key, minimum, maximum] of [
    ["POSTGRES_POOL_MAX", 1, 100],
    ["POSTGRES_POOL_IDLE_TIMEOUT_MS", 1_000, 600_000],
    ["POSTGRES_POOL_CONNECTION_TIMEOUT_MS", 500, 120_000]
  ] as const) {
    if (config[key] !== undefined) {
      const value = Number(config[key]);
      if (!Number.isInteger(value) || value < minimum || value > maximum) {
        throw new Error(`${key} must be an integer between ${minimum} and ${maximum}`);
      }
    }
  }

  if (config.NODE_ENV === "production") {
    const missingProduction = productionRequiredEnv.filter((key) => !config[key]?.trim());
    if (missingProduction.length > 0) {
      throw new Error(`Missing required production environment variables: ${missingProduction.join(", ")}`);
    }

    assertStrongSecret(config, "JWT_ACCESS_SECRET");
    assertStrongSecret(config, "JWT_REFRESH_SECRET");
    assertStrongSecret(config, "METRICS_BEARER_TOKEN");
    assertStrongSecret(config, "S3_SECRET_ACCESS_KEY");

    if (config.JWT_ACCESS_SECRET === config.JWT_REFRESH_SECRET) {
      throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different in production");
    }

    if ((config.AUTH_INCLUDE_REFRESH_TOKEN_IN_RESPONSE ?? "false").toLowerCase() === "true") {
      throw new Error("AUTH_INCLUDE_REFRESH_TOKEN_IN_RESPONSE must be false in production");
    }

    if (config.OBJECT_STORAGE_PROVIDER !== "s3") {
      throw new Error("OBJECT_STORAGE_PROVIDER must be s3 in production");
    }
    if (config.MALWARE_SCANNER_PROVIDER !== "clamav") {
      throw new Error("MALWARE_SCANNER_PROVIDER must be clamav in production");
    }
    const clamAvPort = Number(config.CLAMAV_PORT ?? "3310");
    if (!Number.isInteger(clamAvPort) || clamAvPort < 1 || clamAvPort > 65_535) {
      throw new Error("CLAMAV_PORT must be a valid TCP port in production");
    }
    if (!/^https:\/\//i.test(config.S3_ENDPOINT ?? "") || /localhost|127\.0\.0\.1|\[::1\]/i.test(config.S3_ENDPOINT ?? "")) {
      throw new Error("S3_ENDPOINT must be an explicit HTTPS endpoint in production");
    }

    const origins = (config.CORS_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (
      origins.length === 0 ||
      origins.some(
        (origin) =>
          origin === "*" ||
          !origin.startsWith("https://") ||
          /localhost|127\.0\.0\.1|\[::1\]/i.test(origin)
      )
    ) {
      throw new Error("CORS_ORIGINS must contain only explicit HTTPS origins in production");
    }

    for (const key of [
      "CONSENT_STORAGE_ENCRYPTION_KEY",
      "REPORT_STORAGE_ENCRYPTION_KEY",
      "STORAGE_BACKUP_ENCRYPTION_KEY",
      "CLINICAL_STORAGE_ENCRYPTION_KEY"
    ] as const) {
      if (!isThirtyTwoByteKey(config[key] ?? "")) {
        throw new Error(`${key} must contain exactly 32 bytes encoded as hexadecimal or base64`);
      }
    }
  }

  return config as Record<string, string>;
}
