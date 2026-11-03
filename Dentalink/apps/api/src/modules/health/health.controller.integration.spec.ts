import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { PrismaService } from "../../database/prisma.service";
import { HealthController } from "./health.controller";
import { RedisService } from "../redis/redis.service";

describe("HealthController (integration)", () => {
  let app: INestApplication;

  const prismaMock = {
    $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }])
  } as unknown as PrismaService;
  const redisMock = { ping: jest.fn().mockResolvedValue(true) } as unknown as RedisService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisMock }
      ]
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api/v1");
    await app.init();
  });

  it("separates process, database, Redis, and readiness checks", async () => {
    const live = await request(app.getHttpServer()).get("/api/v1/health/live").expect(200);
    const database = await request(app.getHttpServer()).get("/api/v1/health/database").expect(200);
    const redis = await request(app.getHttpServer()).get("/api/v1/health/redis").expect(200);
    const ready = await request(app.getHttpServer()).get("/api/v1/health/ready").expect(200);

    expect(live.body).toMatchObject({ process: "running" });
    expect(database.body).toMatchObject({ database: "connected" });
    expect(redis.body).toMatchObject({ redis: "connected" });
    expect(ready.body).toMatchObject({ database: "connected", redis: "connected" });
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/health returns healthy payload", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health").expect(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.database).toBe("connected");
    expect(typeof response.body.timestamp).toBe("string");
  });
});
