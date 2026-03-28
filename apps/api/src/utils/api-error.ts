/**
 * Standardized API error class for consistent error responses.
 *
 * Usage in route handlers:
 *   throw ApiError.notFound("App not found");
 *   throw ApiError.badRequest("Invalid slug format");
 *   throw ApiError.forbidden("Not authorized");
 *   throw new ApiError(422, "Unprocessable entity", "UNPROCESSABLE_ENTITY");
 *
 * The global error handler in index.ts catches ApiError instances and formats
 * them as: { error: { code: "NOT_FOUND", message: "App not found" } }
 */

const HTTP_STATUS_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
  500: "INTERNAL_SERVER_ERROR",
  502: "BAD_GATEWAY",
  503: "SERVICE_UNAVAILABLE",
};

function httpStatusToCode(statusCode: number): string {
  return HTTP_STATUS_CODES[statusCode] || "UNKNOWN_ERROR";
}

export class ApiError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code || httpStatusToCode(statusCode);
  }

  /** Format the error for the JSON response body */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
      },
    };
  }

  // --- Factory methods for common HTTP errors ---

  static badRequest(message = "Bad request", code?: string) {
    return new ApiError(400, message, code);
  }

  static unauthorized(message = "Unauthorized", code?: string) {
    return new ApiError(401, message, code);
  }

  static forbidden(message = "Forbidden", code?: string) {
    return new ApiError(403, message, code);
  }

  static notFound(message = "Not found", code?: string) {
    return new ApiError(404, message, code);
  }

  static conflict(message = "Conflict", code?: string) {
    return new ApiError(409, message, code);
  }

  static tooManyRequests(message = "Too many requests", code?: string) {
    return new ApiError(429, message, code);
  }

  static internal(message = "Internal server error", code?: string) {
    return new ApiError(500, message, code);
  }

  static badGateway(message = "Bad gateway", code?: string) {
    return new ApiError(502, message, code);
  }

  static serviceUnavailable(message = "Service unavailable", code?: string) {
    return new ApiError(503, message, code);
  }
}
