import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Mock next-themes
const mockSetTheme = vi.fn();
let mockTheme = "system";
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: mockTheme, setTheme: mockSetTheme }),
}));

import { ThemeToggle } from "@/components/theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTheme = "system";
  });

  it("renders toggle button", () => {
    render(<ThemeToggle />);
    expect(screen.getByTitle("Toggle theme")).toBeInTheDocument();
  });

  it("opens dropdown on click", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByTitle("Toggle theme"));
    expect(screen.getByText("Light")).toBeInTheDocument();
    expect(screen.getByText("Dark")).toBeInTheDocument();
    expect(screen.getByText("System")).toBeInTheDocument();
  });

  it("calls setTheme when option clicked", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByTitle("Toggle theme"));
    fireEvent.click(screen.getByText("Dark"));
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("closes dropdown after selection", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByTitle("Toggle theme"));
    expect(screen.getByText("Light")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Light"));
    expect(screen.queryByText("Dark")).not.toBeInTheDocument();
  });

  it("highlights current theme in dropdown", () => {
    mockTheme = "dark";
    render(<ThemeToggle />);
    fireEvent.click(screen.getByTitle("Toggle theme"));
    const darkOption = screen.getByText("Dark").closest("button");
    expect(darkOption?.className).toContain("bg-accent");
  });
});
