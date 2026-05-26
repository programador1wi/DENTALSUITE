const requiredEnv = ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const;

export function validateEnvironment(config: Record<string, string | undefined>): Record<string, string> {
  const missing = requiredEnv.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return config as Record<string, string>;
}
