import { describe, it, expect } from "vitest";
import { ApiError } from "../../utils/api-error.js";

describe("ApiError", () => {
  it("creates an error with statusCode, message, and auto-derived code", () => {
    const err = new ApiError(404, "App not found");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.name).toBe("ApiError");
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe("App not found");
    expect(err.code).toBe("NOT_FOUND");
  });

  it("allows overriding the code", () => {
    const err = new ApiError(400, "Invalid slug", "INVALID_SLUG");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe("INVALID_SLUG");
    expect(err.message).toBe("Invalid slug");
  });

  it("defaults to UNKNOWN_ERROR for unmapped status codes", () => {
    const err = new ApiError(418, "I'm a teapot");
    expect(err.code).toBe("UNKNOWN_ERROR");
  });

  describe("toJSON", () => {
    it("returns the standardized error response shape", () => {
      const err = new ApiError(403, "Not authorized");
      expect(err.toJSON()).toEqual({
        error: {
          code: "FORBIDDEN",
          message: "Not authorized",
        },
      });
    });

    it("includes requestId when provided", () => {
      const err = new ApiError(404, "Not found");
      expect(err.toJSON("req-abc-123")).toEqual({
        error: {
          code: "NOT_FOUND",
          message: "Not found",
          requestId: "req-abc-123",
        },
      });
    });

    it("omits requestId when not provided", () => {
      const err = new ApiError(500, "Server error");
      const json = err.toJSON();
      expect(json.error).not.toHaveProperty("requestId");
    });
  });

  describe("factory methods", () => {
    it("badRequest creates a 400 error", () => {
      const err = ApiError.badRequest("Invalid input");
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("BAD_REQUEST");
      expect(err.message).toBe("Invalid input");
    });

    it("badRequest uses default message", () => {
      const err = ApiError.badRequest();
      expect(err.message).toBe("Bad request");
    });

    it("unauthorized creates a 401 error", () => {
      const err = ApiError.unauthorized("Token expired");
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe("UNAUTHORIZED");
      expect(err.message).toBe("Token expired");
    });

    it("forbidden creates a 403 error", () => {
      const err = ApiError.forbidden("Access denied");
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe("FORBIDDEN");
    });

    it("notFound creates a 404 error", () => {
      const err = ApiError.notFound("App not found");
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe("NOT_FOUND");
    });

    it("conflict creates a 409 error", () => {
      const err = ApiError.conflict("Already exists");
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe("CONFLICT");
    });

    it("tooManyRequests creates a 429 error", () => {
      const err = ApiError.tooManyRequests("Slow down");
      expect(err.statusCode).toBe(429);
      expect(err.code).toBe("TOO_MANY_REQUESTS");
    });

    it("internal creates a 500 error", () => {
      const err = ApiError.internal("Something broke");
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe("INTERNAL_SERVER_ERROR");
    });

    it("badGateway creates a 502 error", () => {
      const err = ApiError.badGateway("Upstream failed");
      expect(err.statusCode).toBe(502);
      expect(err.code).toBe("BAD_GATEWAY");
    });

    it("serviceUnavailable creates a 503 error", () => {
      const err = ApiError.serviceUnavailable("Down for maintenance");
      expect(err.statusCode).toBe(503);
      expect(err.code).toBe("SERVICE_UNAVAILABLE");
    });

    it("factory methods accept custom code override", () => {
      const err = ApiError.badRequest("Invalid email format", "INVALID_EMAIL");
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe("INVALID_EMAIL");
    });
  });

  describe("status code mapping", () => {
    const mappings: [number, string][] = [
      [400, "BAD_REQUEST"],
      [401, "UNAUTHORIZED"],
      [403, "FORBIDDEN"],
      [404, "NOT_FOUND"],
      [409, "CONFLICT"],
      [422, "UNPROCESSABLE_ENTITY"],
      [429, "TOO_MANY_REQUESTS"],
      [500, "INTERNAL_SERVER_ERROR"],
      [502, "BAD_GATEWAY"],
      [503, "SERVICE_UNAVAILABLE"],
    ];

    it.each(mappings)("maps status %d to code %s", (status, expectedCode) => {
      const err = new ApiError(status, "test");
      expect(err.code).toBe(expectedCode);
    });
  });
});
