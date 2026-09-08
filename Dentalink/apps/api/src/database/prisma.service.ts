import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const connectionString = config.getOrThrow<string>("DATABASE_URL");
    const pool = new Pool({
      connectionString,
      max: Number(config.get<string>("POSTGRES_POOL_MAX") ?? "10"),
      idleTimeoutMillis: Number(config.get<string>("POSTGRES_POOL_IDLE_TIMEOUT_MS") ?? "30000"),
      connectionTimeoutMillis: Number(config.get<string>("POSTGRES_POOL_CONNECTION_TIMEOUT_MS") ?? "5000")
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
  }
}
