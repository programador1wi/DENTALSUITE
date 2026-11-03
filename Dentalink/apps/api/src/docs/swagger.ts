import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { INestApplication } from "@nestjs/common";
import { DeveloperApiModule } from "../modules/developer-api/developer-api.module";

export function setupSwagger(app: INestApplication, configService: ConfigService): void {
  // 1. Internal ERP Swagger
  const config = new DocumentBuilder()
    .setTitle("Dental ERP API")
    .setDescription("Backend base con NestJS, Prisma y PostgreSQL")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const docsPath = configService.get<string>("SWAGGER_PATH") ?? "api/docs";
  SwaggerModule.setup(docsPath, app, document);

  // 2. Isolated Developer Open API Swagger
  const developerConfig = new DocumentBuilder()
    .setTitle("Dental Platform - Open Developer API")
    .setDescription(
      "API M2M para integraciones externas. Flujo recomendado: generar una credencial en Dentalink, copiarla una sola vez, probar con Authorization: Bearer, observar cuota, rotar y finalmente revocar. Las escrituras requieren Idempotency-Key. Errores estables: API_CREDENTIAL_INVALID, API_SCOPE_FORBIDDEN, IP_NOT_ALLOWED, IDEMPOTENCY_CONFLICT y RATE_LIMIT_EXCEEDED."
    )
    .setVersion("1.0.0")
    .addBearerAuth({ type: "http", scheme: "bearer", bearerFormat: "dsk_live_...", description: "Metodo recomendado. Usa la variable DENTALINK_API_KEY." })
    .addApiKey({ type: "apiKey", name: "X-Api-Key", in: "header" }, "X-Api-Key")
    .build();

  const developerDocument = SwaggerModule.createDocument(app, developerConfig, {
    include: [DeveloperApiModule]
  });
  SwaggerModule.setup("api/docs/developer", app, developerDocument);
}
