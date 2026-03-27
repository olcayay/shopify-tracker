import { describe, it, expect } from "vitest";
import { PLATFORM_IDS } from "@appranks/shared";
import {
  PLATFORM_DISPLAY,
  PLATFORM_LABELS,
  PLATFORM_SHORT_LABELS,
  PLATFORM_COLORS,
  getPlatformLabel,
  getPlatformColor,
  getPlatformDisplay,
} from "../../lib/platform-display";

describe("platform-display", () => {
  it("PLATFORM_DISPLAY covers all platforms", () => {
    for (const id of PLATFORM_IDS) {
      expect(PLATFORM_DISPLAY[id]).toBeDefined();
      expect(PLATFORM_DISPLAY[id].label).toBeTruthy();
      expect(PLATFORM_DISPLAY[id].color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(PLATFORM_DISPLAY[id].gradient).toContain("from-");
      expect(PLATFORM_DISPLAY[id].borderTop).toContain("border-t-");
      expect(PLATFORM_DISPLAY[id].textAccent).toContain("text-");
    }
  });

  it("PLATFORM_LABELS has full labels for all platforms", () => {
    expect(Object.keys(PLATFORM_LABELS)).toHaveLength(PLATFORM_IDS.length);
    expect(PLATFORM_LABELS.google_workspace).toBe("Google Workspace");
    expect(PLATFORM_LABELS.hubspot).toBe("HubSpot");
  });

  it("PLATFORM_SHORT_LABELS has short labels", () => {
    expect(PLATFORM_SHORT_LABELS.google_workspace).toBe("Google WS");
  });

  it("PLATFORM_COLORS matches PLATFORM_DISPLAY.color", () => {
    for (const id of PLATFORM_IDS) {
      expect(PLATFORM_COLORS[id]).toBe(PLATFORM_DISPLAY[id].color);
    }
  });

  it("getPlatformLabel returns label for valid platform", () => {
    expect(getPlatformLabel("shopify")).toBe("Shopify");
    expect(getPlatformLabel("hubspot")).toBe("HubSpot");
  });

  it("getPlatformLabel returns raw string for unknown platform", () => {
    expect(getPlatformLabel("unknown")).toBe("unknown");
  });

  it("getPlatformColor returns color for valid platform", () => {
    expect(getPlatformColor("shopify")).toBe("#95BF47");
  });

  it("getPlatformColor returns fallback for unknown platform", () => {
    expect(getPlatformColor("unknown")).toBe("#888");
  });

  it("getPlatformDisplay returns info for valid, undefined for unknown", () => {
    expect(getPlatformDisplay("shopify")).toBeDefined();
    expect(getPlatformDisplay("unknown")).toBeUndefined();
  });
});
