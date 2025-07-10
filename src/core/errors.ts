export type FinderErrorCode =
  | "not_found"
  | "exists"
  | "permission"
  | "unsupported"
  | "aborted"
  | "unknown";

export class FinderError extends Error {
  readonly code: FinderErrorCode;
  readonly path: string | undefined;

  constructor(
    code: FinderErrorCode,
    message: string,
    options: { path?: string; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "FinderError";
    this.code = code;
    this.path = options.path;
  }

  static is(error: unknown, code?: FinderErrorCode): error is FinderError {
    return error instanceof FinderError && (code === undefined || error.code === code);
  }
}

const DOM_EXCEPTION_CODES: Record<string, FinderErrorCode> = {
  AbortError: "aborted",
  NotFoundError: "not_found",
  NotAllowedError: "permission",
  SecurityError: "permission",
  TypeMismatchError: "not_found",
  InvalidModificationError: "exists",
  NoModificationAllowedError: "permission",
  // AWS SDK / S3
  NotFound: "not_found",
  NoSuchKey: "not_found",
  NoSuchBucket: "not_found",
  AccessDenied: "permission",
  Forbidden: "permission",
};

/** Normalize any thrown value into a `FinderError`. */
export function toFinderError(error: unknown, path?: string): FinderError {
  if (error instanceof FinderError) {
    return error;
  }
  if (isErrorLike(error)) {
    const code = DOM_EXCEPTION_CODES[error.name] ?? "unknown";
    return new FinderError(code, error.message, { path, cause: error });
  }
  return new FinderError("unknown", String(error), { path, cause: error });
}

export function throwIfAborted(signal?: AbortSignal, path?: string): void {
  if (signal?.aborted) {
    throw new FinderError("aborted", "Operation aborted", { path });
  }
}

/** `instanceof Error` fails across realms (jsdom DOMException), so duck-type. */
function isErrorLike(value: unknown): value is { name: string; message: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string" &&
    typeof (value as { message?: unknown }).message === "string"
  );
}
