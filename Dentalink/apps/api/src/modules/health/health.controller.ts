import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { PrismaService } from "../../database/prisma.service";
import { RedisService } from "../redis/redis.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService
  ) {}

  @Public()
  @Get("live")
  live() {
    return { status: "ok", timestamp: new Date().toISOString(), process: "running" };
  }

  @Public()
  @Get()
  async check() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", timestamp: new Date().toISOString(), database: "connected" };
  }

  @Public()
  @Get("database")
  async database() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", timestamp: new Date().toISOString(), database: "connected" };
  }

  @Public()
  @Get("redis")
  async redisCheck() {
    if (!(await this.redis.ping())) {
      throw new ServiceUnavailableException("Redis unavailable");
    }
    return { status: "ok", timestamp: new Date().toISOString(), redis: "connected" };
  }

  @Public()
  @Get("ready")
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    if (!(await this.redis.ping())) {
      throw new ServiceUnavailableException("Redis unavailable");
    }
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      database: "connected",
      redis: "connected"
    };
  }
}
