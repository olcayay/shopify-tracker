import { describe, it, expect } from "vitest";
import {
  NOTIFICATION_TEMPLATE_VARIABLES,
  EMAIL_TEMPLATE_VARIABLES,
  renderTemplate,
  buildNotificationSampleData,
  buildEmailSampleData,
} from "../template-registry.js";
import { NOTIFICATION_TYPES } from "../notification-types.js";

// ---------------------------------------------------------------------------
// renderTemplate
// ---------------------------------------------------------------------------
describe("renderTemplate", () => {
  it("replaces simple variables", () => {
    const result = renderTemplate("Hello {{name}}", { name: "World" });
    expect(result).toBe("Hello World");
  });

  it("replaces multiple variables", () => {
    const result = renderTemplate("{{appName}} is at position {{position}}", {
      appName: "OrderFlow",
      position: 3,
    });
    expect(result).toBe("OrderFlow is at position 3");
  });

  it("leaves unknown variables as-is", () => {
    const result = renderTemplate("{{appName}} in {{unknown}}", {
      appName: "Test",
    });
    expect(result).toBe("Test in {{unknown}}");
  });

  it("handles null/undefined values by keeping placeholder", () => {
    const result = renderTemplate("{{appName}} at {{position}}", {
      appName: "Test",
      position: undefined,
    });
    expect(result).toBe("Test at {{position}}");
  });

  it("handles numeric values", () => {
    const result = renderTemplate("Position: {{position}}", { position: 5 });
    expect(result).toBe("Position: 5");
  });

  it("handles empty template", () => {
    expect(renderTemplate("", { name: "test" })).toBe("");
  });

  it("handles template with no variables", () => {
    expect(renderTemplate("Hello world", {})).toBe("Hello world");
  });
});

// ---------------------------------------------------------------------------
// NOTIFICATION_TEMPLATE_VARIABLES
// ---------------------------------------------------------------------------
describe("NOTIFICATION_TEMPLATE_VARIABLES", () => {
  it("covers all 26 notification types", () => {
    const types = Object.keys(NOTIFICATION_TEMPLATE_VARIABLES);
    expect(types.length).toBe(26);
  });

  it("matches NOTIFICATION_TYPES keys", () => {
    for (const type of Object.keys(NOTIFICATION_TYPES)) {
      expect(NOTIFICATION_TEMPLATE_VARIABLES[type as keyof typeof NOTIFICATION_TEMPLATE_VARIABLES]).toBeDefined();
    }
  });

  it("each type has at least one variable", () => {
    for (const [type, vars] of Object.entries(NOTIFICATION_TEMPLATE_VARIABLES)) {
      expect(vars.length).toBeGreaterThan(0);
    }
  });

  it("all variables have name, description, and example", () => {
    for (const [type, vars] of Object.entries(NOTIFICATION_TEMPLATE_VARIABLES)) {
      for (const v of vars) {
        expect(v.name).toBeTruthy();
        expect(v.description).toBeTruthy();
        expect(v.example).toBeTruthy();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// EMAIL_TEMPLATE_VARIABLES
// ---------------------------------------------------------------------------
describe("EMAIL_TEMPLATE_VARIABLES", () => {
  it("covers all 14 email types", () => {
    const types = Object.keys(EMAIL_TEMPLATE_VARIABLES);
    expect(types.length).toBe(14);
  });

  it("each type has at least one variable", () => {
    for (const [type, vars] of Object.entries(EMAIL_TEMPLATE_VARIABLES)) {
      expect(vars.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// buildNotificationSampleData
// ---------------------------------------------------------------------------
describe("buildNotificationSampleData", () => {
  it("returns sample data for a valid type", () => {
    const data = buildNotificationSampleData("ranking_top3_entry");
    expect(data.appName).toBe("OrderFlow Pro");
    expect(data.position).toBe("3");
  });

  it("returns data for all notification types", () => {
    for (const type of Object.keys(NOTIFICATION_TEMPLATE_VARIABLES)) {
      const data = buildNotificationSampleData(type as any);
      expect(Object.keys(data).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// buildEmailSampleData
// ---------------------------------------------------------------------------
describe("buildEmailSampleData", () => {
  it("returns sample data for a valid type", () => {
    const data = buildEmailSampleData("email_password_reset");
    expect(data.expiryHours).toBe("1");
  });

  it("returns data for all email types", () => {
    for (const type of Object.keys(EMAIL_TEMPLATE_VARIABLES)) {
      const data = buildEmailSampleData(type as any);
      expect(Object.keys(data).length).toBeGreaterThan(0);
    }
  });
});
