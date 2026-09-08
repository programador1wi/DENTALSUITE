import { Injectable, LoggerService } from "@nestjs/common";

type Level = "log" | "error" | "warn" | "debug" | "verbose";
type LogMetadata = Record<string, unknown>;

@Injectable()
export class AppLogger implements LoggerService {
  log(message: unknown, context?: string) {
    this.write("log", message, context);
  }

  error(message: unknown, trace?: unknown, context?: string) {
    this.write("error", message, context, trace);
  }

  warn(message: unknown, context?: string) {
    this.write("warn", message, context);
  }

  debug(message: unknown, context?: string) {
    this.write("debug", message, context);
  }

  verbose(message: unknown, context?: string) {
    this.write("verbose", message, context);
  }

  logEvent(message: string, context: string, metadata: LogMetadata) {
    this.write("log", message, context, undefined, metadata);
  }

  errorEvent(message: string, context: string, metadata: LogMetadata, trace?: unknown) {
    this.write("error", message, context, trace, metadata);
  }

  private write(
    level: Level,
    message: unknown,
    context?: string,
    trace?: unknown,
    metadata: LogMetadata = {}
  ) {
    const stringMessage = this.extractString(message);
    const stringTrace = trace !== undefined && trace !== null ? this.extractString(trace) : undefined;

    const payload = {
      level,
      timestamp: new Date().toISOString(),
      context: context ?? "App",
      message: this.redactText(stringMessage),
      ...this.redactMetadata(metadata),
      ...(stringTrace ? { trace: this.redactText(stringTrace) } : {})
    };
    const line = JSON.stringify(payload);

    if (level === "error") {
      console.error(line);
      return;
    }
    if (level === "warn") {
      console.warn(line);
      return;
    }
    if (level === "debug") {
      console.debug(line);
      return;
    }
    console.log(line);
  }

  private extractString(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.stack || value.message;
    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  private redactMetadata(metadata: LogMetadata) {
    const sensitiveKeys = /(?:password|token|secret|authorization|cookie|clinical|csd|private.?key)/i;
    return Object.fromEntries(
      Object.entries(metadata).map(([key, value]) => {
        if (sensitiveKeys.test(key)) return [key, "[REDACTED]"];
        if (typeof value === "string") return [key, this.redactText(value)];
        return [key, value];
      })
    );
  }

  private redactText(value: string): string {
    if (typeof value !== "string") {
      value = this.extractString(value);
    }
    return value
      .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [REDACTED]")
      .replace(/\b(?:accessToken|refreshToken|password|secret)=([^\s&]+)/gi, (match) => {
        const key = match.slice(0, match.indexOf("="));
        return `${key}=[REDACTED]`;
      });
  }
}
