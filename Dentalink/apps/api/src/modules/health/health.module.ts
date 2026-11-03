import { Module } from "@nestjs/common";
import { PrismaModule } from "../../database/prisma.module";
import { HealthController } from "./health.controller";
import { RedisModule } from "../redis/redis.module";

@Module({ imports: [PrismaModule, RedisModule], controllers: [HealthController] })
export class HealthModule {}
