import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ViewModeToggle, useViewMode } from "@/components/view-mode-toggle";

// Simple test wrapper to expose hook state
function HookWrapper({ storageKey, onChange }: { storageKey: string; onChange?: (mode: "list" | "grouped") => void }) {
  const { viewMode, changeViewMode } = useViewMode(storageKey, onChange);
  return (
    <div>
      <span data-testid="mode">{viewMode}</span>
      <button data-testid="set-list" onClick={() => changeViewMode("list")}>List</button>
      <button data-testid="set-grouped" onClick={() => changeViewMode("grouped")}>Grouped</button>
    </div>
  );
}

describe("ViewModeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders List and By Platform buttons", () => {
    render(<ViewModeToggle storageKey="test-view-mode" />);
    expect(screen.getByTitle("Flat list")).toBeInTheDocument();
    expect(screen.getByTitle("Group by platform")).toBeInTheDocument();
  });

  it("defaults to list mode when no localStorage value", () => {
    render(<ViewModeToggle storageKey="test-view-mode" />);
    const listBtn = screen.getByTitle("Flat list");
    // secondary variant means it's active
    expect(listBtn.className).toContain("secondary");
  });

  it("reads initial value from localStorage", () => {
    localStorage.setItem("test-view-mode", "grouped");
    render(<ViewModeToggle storageKey="test-view-mode" />);
    const groupedBtn = screen.getByTitle("Group by platform");
    expect(groupedBtn.className).toContain("secondary");
  });

  it("writes to localStorage on toggle", () => {
    render(<ViewModeToggle storageKey="test-view-mode" />);
    fireEvent.click(screen.getByTitle("Group by platform"));
    expect(localStorage.getItem("test-view-mode")).toBe("grouped");
  });

  it("calls onChange callback when mode changes", () => {
    const onChange = vi.fn();
    render(<ViewModeToggle storageKey="test-view-mode" onChange={onChange} />);
    fireEvent.click(screen.getByTitle("Group by platform"));
    expect(onChange).toHaveBeenCalledWith("grouped");
  });

  it("handles invalid localStorage value gracefully", () => {
    localStorage.setItem("test-view-mode", "invalid");
    render(<ViewModeToggle storageKey="test-view-mode" />);
    const listBtn = screen.getByTitle("Flat list");
    expect(listBtn.className).toContain("secondary");
  });
});

describe("useViewMode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to list when no stored value", () => {
    render(<HookWrapper storageKey="hook-test" />);
    expect(screen.getByTestId("mode").textContent).toBe("list");
  });

  it("reads stored value", () => {
    localStorage.setItem("hook-test", "grouped");
    render(<HookWrapper storageKey="hook-test" />);
    expect(screen.getByTestId("mode").textContent).toBe("grouped");
  });

  it("persists change to localStorage", () => {
    render(<HookWrapper storageKey="hook-test" />);
    fireEvent.click(screen.getByTestId("set-grouped"));
    expect(localStorage.getItem("hook-test")).toBe("grouped");
    expect(screen.getByTestId("mode").textContent).toBe("grouped");
  });

  it("isolates per-page preferences", () => {
    localStorage.setItem("apps-view-mode", "grouped");
    localStorage.setItem("keywords-view-mode", "list");
    const { unmount } = render(<HookWrapper storageKey="apps-view-mode" />);
    expect(screen.getByTestId("mode").textContent).toBe("grouped");
    unmount();
    render(<HookWrapper storageKey="keywords-view-mode" />);
    expect(screen.getByTestId("mode").textContent).toBe("list");
  });

  it("calls onChange callback", () => {
    const onChange = vi.fn();
    render(<HookWrapper storageKey="hook-test" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("set-grouped"));
    expect(onChange).toHaveBeenCalledWith("grouped");
  });
});
