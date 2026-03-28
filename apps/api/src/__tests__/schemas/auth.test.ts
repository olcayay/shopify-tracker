import { describe, it, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  updateProfileSchema,
} from "../../schemas/auth.js";

describe("registerSchema", () => {
  const valid = {
    email: "user@example.com",
    password: "StrongPass1",
    name: "Test User",
    accountName: "My Account",
  };

  it("accepts valid registration data", () => {
    expect(() => registerSchema.parse(valid)).not.toThrow();
  });

  it("accepts optional company field", () => {
    const result = registerSchema.parse({ ...valid, company: "ACME" });
    expect(result.company).toBe("ACME");
  });

  it("rejects missing email", () => {
    const { email, ...rest } = valid;
    expect(() => registerSchema.parse(rest)).toThrow();
  });

  it("rejects invalid email format", () => {
    expect(() => registerSchema.parse({ ...valid, email: "not-an-email" })).toThrow();
  });

  it("rejects password without uppercase", () => {
    expect(() => registerSchema.parse({ ...valid, password: "lowercase1" })).toThrow(/uppercase/);
  });

  it("rejects password without lowercase", () => {
    expect(() => registerSchema.parse({ ...valid, password: "UPPERCASE1" })).toThrow(/lowercase/);
  });

  it("rejects password without number", () => {
    expect(() => registerSchema.parse({ ...valid, password: "NoNumberHere" })).toThrow(/number/);
  });

  it("rejects password shorter than 8 chars", () => {
    expect(() => registerSchema.parse({ ...valid, password: "Ab1" })).toThrow(/8 char/);
  });

  it("rejects empty name", () => {
    expect(() => registerSchema.parse({ ...valid, name: "" })).toThrow();
  });

  it("rejects name over 100 chars", () => {
    expect(() => registerSchema.parse({ ...valid, name: "x".repeat(101) })).toThrow();
  });

  it("rejects empty accountName", () => {
    expect(() => registerSchema.parse({ ...valid, accountName: "" })).toThrow();
  });
});

describe("loginSchema", () => {
  it("accepts valid login data", () => {
    expect(() => loginSchema.parse({ email: "user@test.com", password: "pass" })).not.toThrow();
  });

  it("rejects missing email", () => {
    expect(() => loginSchema.parse({ password: "pass" })).toThrow();
  });

  it("rejects invalid email", () => {
    expect(() => loginSchema.parse({ email: "bad", password: "pass" })).toThrow();
  });

  it("rejects empty password", () => {
    expect(() => loginSchema.parse({ email: "user@test.com", password: "" })).toThrow();
  });
});

describe("refreshSchema", () => {
  it("accepts valid refresh token", () => {
    expect(() => refreshSchema.parse({ refreshToken: "abc123" })).not.toThrow();
  });

  it("rejects empty refresh token", () => {
    expect(() => refreshSchema.parse({ refreshToken: "" })).toThrow();
  });

  it("rejects missing refresh token", () => {
    expect(() => refreshSchema.parse({})).toThrow();
  });
});

describe("logoutSchema", () => {
  it("accepts valid logout data", () => {
    expect(() => logoutSchema.parse({ refreshToken: "abc123" })).not.toThrow();
  });

  it("rejects empty refresh token", () => {
    expect(() => logoutSchema.parse({ refreshToken: "" })).toThrow();
  });
});

describe("updateProfileSchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(() => updateProfileSchema.parse({})).not.toThrow();
  });

  it("accepts emailDigestEnabled toggle", () => {
    const result = updateProfileSchema.parse({ emailDigestEnabled: true });
    expect(result.emailDigestEnabled).toBe(true);
  });

  it("accepts name update", () => {
    const result = updateProfileSchema.parse({ name: "New Name" });
    expect(result.name).toBe("New Name");
  });

  it("accepts email update", () => {
    const result = updateProfileSchema.parse({ email: "new@test.com" });
    expect(result.email).toBe("new@test.com");
  });

  it("rejects invalid email", () => {
    expect(() => updateProfileSchema.parse({ email: "bad" })).toThrow();
  });

  it("requires currentPassword when newPassword is set", () => {
    expect(() =>
      updateProfileSchema.parse({ newPassword: "NewPass1!" })
    ).toThrow(/current password/i);
  });

  it("accepts password change with currentPassword", () => {
    expect(() =>
      updateProfileSchema.parse({
        currentPassword: "OldPass1!",
        newPassword: "NewPass1!",
      })
    ).not.toThrow();
  });

  it("rejects weak newPassword even with currentPassword", () => {
    expect(() =>
      updateProfileSchema.parse({
        currentPassword: "OldPass1!",
        newPassword: "weak",
      })
    ).toThrow();
  });
});
