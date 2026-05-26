import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { appConfig } from "./config/app.config";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { AuditTrailInterceptor } from "./common/interceptors/audit-trail.interceptor";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { AppValidationPipe } from "./common/pipes/app-validation.pipe";
import { SanitizationPipe } from "./common/pipes/sanitization.pipe";
import { RateLimitMiddleware } from "./common/middleware/rate-limit.middleware";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { AppLogger } from "./common/utils/app-logger.util";
import { setupSwagger } from "./docs/swagger";
import { AppModule } from "./app.module";
import { PrismaService } from "./database/prisma.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const logger = app.get(AppLogger);
  const conf = appConfig(config);

  app.useLogger(logger);

  const requestIdMiddleware = new RequestIdMiddleware();
  const rateLimitMiddleware = new RateLimitMiddleware();

  app.use(helmet());
  app.use((req: Request, res: Response, next: NextFunction) => requestIdMiddleware.use(req, res, next));
  app.use((req: Request, res: Response, next: NextFunction) => rateLimitMiddleware.use(req, res, next));

  app.setGlobalPrefix("api/v1");
  app.enableCors({
    origin: conf.allowedOrigins,
    credentials: true
  });
  app.useGlobalPipes(new SanitizationPipe());
  app.useGlobalPipes(new AppValidationPipe());
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.useGlobalInterceptors(new ResponseInterceptor(logger));
  app.useGlobalInterceptors(new AuditTrailInterceptor(app.get(PrismaService)));

  setupSwagger(app, config);

  await app.listen(conf.port);
  logger.log(`API listening on port ${conf.port}`, "Bootstrap");
}

bootstrap();
