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

// Wrapper that wires useViewMode to ViewModeToggle (the typical usage pattern)
function ToggleWrapper({ storageKey, onChange }: { storageKey: string; onChange?: (mode: "list" | "grouped") => void }) {
  const { viewMode, changeViewMode } = useViewMode(storageKey, onChange);
  return <ViewModeToggle viewMode={viewMode} onChangeViewMode={changeViewMode} />;
}

describe("ViewModeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders List and By Platform buttons", () => {
    render(<ViewModeToggle viewMode="list" onChangeViewMode={() => {}} />);
    expect(screen.getByTitle("Flat list")).toBeInTheDocument();
    expect(screen.getByTitle("Group by platform")).toBeInTheDocument();
  });

  it("highlights list button when viewMode is list", () => {
    render(<ViewModeToggle viewMode="list" onChangeViewMode={() => {}} />);
    const listBtn = screen.getByTitle("Flat list");
    expect(listBtn.className).toContain("secondary");
  });

  it("highlights grouped button when viewMode is grouped", () => {
    render(<ViewModeToggle viewMode="grouped" onChangeViewMode={() => {}} />);
    const groupedBtn = screen.getByTitle("Group by platform");
    expect(groupedBtn.className).toContain("secondary");
  });

  it("calls onChangeViewMode when toggling", () => {
    const onChangeViewMode = vi.fn();
    render(<ViewModeToggle viewMode="list" onChangeViewMode={onChangeViewMode} />);
    fireEvent.click(screen.getByTitle("Group by platform"));
    expect(onChangeViewMode).toHaveBeenCalledWith("grouped");
  });

  it("integrates with useViewMode hook via ToggleWrapper", () => {
    render(<ToggleWrapper storageKey="test-view-mode" />);
    // Default is list
    const listBtn = screen.getByTitle("Flat list");
    expect(listBtn.className).toContain("secondary");
    // Click grouped
    fireEvent.click(screen.getByTitle("Group by platform"));
    expect(localStorage.getItem("test-view-mode")).toBe("grouped");
  });

  it("reads initial value from localStorage via ToggleWrapper", () => {
    localStorage.setItem("test-view-mode", "grouped");
    render(<ToggleWrapper storageKey="test-view-mode" />);
    const groupedBtn = screen.getByTitle("Group by platform");
    expect(groupedBtn.className).toContain("secondary");
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

  it("handles invalid localStorage value gracefully", () => {
    localStorage.setItem("hook-test", "invalid");
    render(<HookWrapper storageKey="hook-test" />);
    expect(screen.getByTestId("mode").textContent).toBe("list");
  });
});
