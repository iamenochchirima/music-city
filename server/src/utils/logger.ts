type LogLevel = "info" | "warn" | "error";

const writeLog = (
  level: LogLevel,
  message: string,
  meta?: Record<string, unknown>,
) => {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? { meta } : {}),
  };

  const serialized = JSON.stringify(entry);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  console.log(serialized);
};

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    writeLog("info", message, meta);
  },

  warn(message: string, meta?: Record<string, unknown>) {
    writeLog("warn", message, meta);
  },

  error(message: string, meta?: Record<string, unknown>) {
    writeLog("error", message, meta);
  },
};
