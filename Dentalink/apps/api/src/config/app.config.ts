import { ConfigService } from "@nestjs/config";

export const appConfig = (config: ConfigService) => ({
  name: "Dental ERP API",
  version: "1.0.0",
  env: config.get<string>("NODE_ENV") ?? "development",
  port: Number(config.get<string>("API_PORT") ?? 3001),
  allowedOrigins: (config.get<string>("CORS_ORIGINS") ?? "http://localhost:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
});
