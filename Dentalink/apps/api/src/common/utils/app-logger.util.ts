import { Injectable, LoggerService } from "@nestjs/common";

type Level = "log" | "error" | "warn" | "debug" | "verbose";

@Injectable()
export class AppLogger implements LoggerService {
  log(message: string, context?: string) {
    this.write("log", message, context);
  }

  error(message: string, trace?: string, context?: string) {
    this.write("error", message, context, trace);
  }

  warn(message: string, context?: string) {
    this.write("warn", message, context);
  }

  debug(message: string, context?: string) {
    this.write("debug", message, context);
  }

  verbose(message: string, context?: string) {
    this.write("verbose", message, context);
  }

  private write(level: Level, message: string, context?: string, trace?: string) {
    const payload = {
      level,
      timestamp: new Date().toISOString(),
      context: context ?? "App",
      message,
      ...(trace ? { trace } : {})
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
}
