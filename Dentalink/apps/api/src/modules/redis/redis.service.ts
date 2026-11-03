import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private connectPromise: Promise<void> | null = null;

  constructor(config: ConfigService) {
    this.client = new Redis(config.get<string>("REDIS_URL") ?? "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false
    });

    this.client.on("error", () => {
      // Fail-safe: suppress unhandled error to allow graceful DB fallback
    });
  }

  getClient() {
    return this.client;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.client.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds = 600): Promise<void> {
    try {
      const raw = JSON.stringify(value);
      if (ttlSeconds > 0) {
        await this.client.set(key, raw, "EX", ttlSeconds);
      } else {
        await this.client.set(key, raw);
      }
    } catch {
      // Fail-safe
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch {
      // Fail-safe
    }
  }

  async delPattern(pattern: string): Promise<void> {
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = nextCursor;
        if (keys.length > 0) {
          await this.client.del(...keys);
        }
      } while (cursor !== "0");
    } catch {
      // Fail-safe
    }
  }

  async consumeRateLimit(
    key: string,
    windowMs: number
  ): Promise<{ count: number; ttlMs: number } | null> {
    const script = `
      local count = redis.call("INCR", KEYS[1])
      if count == 1 then
        redis.call("PEXPIRE", KEYS[1], ARGV[1])
      end
      local ttl = redis.call("PTTL", KEYS[1])
      return { count, ttl }
    `;

    try {
      await this.ensureReady();
      const result = (await this.client.eval(script, 1, key, String(windowMs))) as [number, number];
      return { count: Number(result[0]), ttlMs: Number(result[1]) };
    } catch {
      return null;
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.ensureReady();
      return (await this.client.ping()) === "PONG";
    } catch {
      return false;
    }
  }

  private async ensureReady() {
    if (this.client.status === "ready") return;
    if (!this.connectPromise) {
      const connection =
        this.client.status === "wait" || this.client.status === "end"
          ? this.client.connect()
          : new Promise<void>((resolve, reject) => {
              const cleanup = () => {
                this.client.off("ready", onReady);
                this.client.off("error", onError);
              };
              const onReady = () => {
                cleanup();
                resolve();
              };
              const onError = (error: Error) => {
                cleanup();
                reject(error);
              };
              this.client.once("ready", onReady);
              this.client.once("error", onError);
            });
      this.connectPromise = connection.finally(() => {
        this.connectPromise = null;
      });
    }
    await this.connectPromise;
  }

  async onModuleDestroy() {
    try {
      await this.client.quit();
    } catch {
      // Fail-safe
    }
  }
}
