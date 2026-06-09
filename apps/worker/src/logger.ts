type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

function serializeError(error: unknown) {
  if (!(error instanceof Error)) {
    return error == null ? undefined : { message: String(error) };
  }
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

function writeLog(level: LogLevel, payload: LogFields) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    ...payload,
  });

  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function createLogger(baseFields: LogFields = {}) {
  return {
    info(event: string, message: string, fields: LogFields = {}) {
      writeLog("info", { ...baseFields, event, message, ...fields });
    },
    warn(event: string, message: string, fields: LogFields = {}) {
      writeLog("warn", { ...baseFields, event, message, ...fields });
    },
    error(
      event: string,
      message: string,
      fields: LogFields = {},
      error?: unknown,
    ) {
      writeLog("error", {
        ...baseFields,
        event,
        message,
        ...fields,
        error: serializeError(error),
      });
    },
  };
}
