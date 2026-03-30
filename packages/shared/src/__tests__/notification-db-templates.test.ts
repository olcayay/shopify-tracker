import { describe, it, expect } from "vitest";
import { buildNotificationContent } from "../notifications/templates.js";
import type { DbNotificationTemplate } from "../notifications/templates.js";

describe("buildNotificationContent with DB templates", () => {
  const eventData = {
    appName: "TestApp",
    appSlug: "test-app",
    platform: "shopify",
    position: 1,
    previousPosition: 5,
    change: 4,
    keyword: "crm tools",
    keywordSlug: "crm-tools",
    categoryName: "Business",
    categorySlug: "business",
  };

  it("uses code-based template when no DB template provided", () => {
    const content = buildNotificationContent("ranking_top3_entry", eventData);
    expect(content.title).toBeTruthy();
    expect(content.body).toBeTruthy();
    expect(content.priority).toBeTruthy();
  });

  it("uses code-based template when DB template is not customized", () => {
    const dbTemplate: DbNotificationTemplate = {
      titleTemplate: "Custom: {{appName}}",
      bodyTemplate: "Custom body",
      isCustomized: false,
    };
    const content = buildNotificationContent("ranking_top3_entry", eventData, dbTemplate);
    // Should use code-based template, not the DB one
    expect(content.title).not.toContain("Custom:");
  });

  it("uses DB template when isCustomized is true", () => {
    const dbTemplate: DbNotificationTemplate = {
      titleTemplate: "CUSTOM: {{appName}} is now #{{position}}!",
      bodyTemplate: "Was at {{previousPosition}}, now at {{position}}.",
      isCustomized: true,
    };
    const content = buildNotificationContent("ranking_top3_entry", eventData, dbTemplate);
    expect(content.title).toBe("CUSTOM: TestApp is now #1!");
    expect(content.body).toBe("Was at 5, now at 1.");
  });

  it("preserves url, icon, and priority from code-based template when using DB template", () => {
    const dbTemplate: DbNotificationTemplate = {
      titleTemplate: "Custom title",
      bodyTemplate: "Custom body",
      isCustomized: true,
    };
    const codeContent = buildNotificationContent("ranking_top3_entry", eventData);
    const dbContent = buildNotificationContent("ranking_top3_entry", eventData, dbTemplate);
    // url, icon, priority should come from code
    expect(dbContent.priority).toBe(codeContent.priority);
  });

  it("leaves unknown variables as-is in DB template", () => {
    const dbTemplate: DbNotificationTemplate = {
      titleTemplate: "{{appName}} - {{unknownVar}}",
      bodyTemplate: "Body",
      isCustomized: true,
    };
    const content = buildNotificationContent("ranking_top3_entry", eventData, dbTemplate);
    expect(content.title).toBe("TestApp - {{unknownVar}}");
  });

  it("uses DB template when null dbTemplate passed (falls back to code)", () => {
    const content = buildNotificationContent("ranking_top3_entry", eventData, null);
    expect(content.title).toBeTruthy();
  });
});
