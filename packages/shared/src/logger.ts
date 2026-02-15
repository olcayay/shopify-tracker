export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogContext {
  [key: string]: unknown;
}

export class Logger {
  private context: LogContext;
  private minLevel: LogLevel;

  constructor(context: LogContext = {}, minLevel?: LogLevel) {
    this.context = context;
    this.minLevel = minLevel ?? ((process.env.LOG_LEVEL as LogLevel) || "info");
  }

  child(extra: LogContext): Logger {
    return new Logger({ ...this.context, ...extra }, this.minLevel);
  }

  debug(msg: string, extra?: LogContext) {
    this.log("debug", msg, extra);
  }

  info(msg: string, extra?: LogContext) {
    this.log("info", msg, extra);
  }

  warn(msg: string, extra?: LogContext) {
    this.log("warn", msg, extra);
  }

  error(msg: string, extra?: LogContext) {
    this.log("error", msg, extra);
  }

  private log(level: LogLevel, msg: string, extra?: LogContext) {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[this.minLevel]) return;

    const entry = {
      level,
      time: new Date().toISOString(),
      msg,
      ...this.context,
      ...extra,
    };

    const line = JSON.stringify(entry);
    if (level === "error") {
      process.stderr.write(line + "\n");
    } else {
      process.stdout.write(line + "\n");
    }
  }
}

export function createLogger(module: string, extra?: LogContext): Logger {
  return new Logger({ module, ...extra });
}
