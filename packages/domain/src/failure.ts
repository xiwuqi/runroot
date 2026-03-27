export interface FailureDetails {
  readonly code?: string;
  readonly message: string;
  readonly name: string;
  readonly retryable?: boolean;
  readonly stack?: string;
}

export function serializeError(
  error: unknown,
  retryable?: boolean,
): FailureDetails {
  if (error instanceof Error) {
    const code =
      typeof Reflect.get(error, "code") === "string"
        ? String(Reflect.get(error, "code"))
        : undefined;

    return {
      ...(code ? { code } : {}),
      message: error.message,
      name: error.name,
      ...(retryable === undefined ? {} : { retryable }),
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }

  return {
    message: String(error),
    name: "UnknownError",
    ...(retryable === undefined ? {} : { retryable }),
  };
}
