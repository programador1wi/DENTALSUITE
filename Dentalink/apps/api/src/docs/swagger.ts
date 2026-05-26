import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import type { INestApplication } from "@nestjs/common";

export function setupSwagger(app: INestApplication, configService: ConfigService): void {
  const config = new DocumentBuilder()
    .setTitle("Dental ERP API")
    .setDescription("Backend base con NestJS, Prisma y PostgreSQL")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const docsPath = configService.get<string>("SWAGGER_PATH") ?? "api/docs";
  SwaggerModule.setup(docsPath, app, document);
}
