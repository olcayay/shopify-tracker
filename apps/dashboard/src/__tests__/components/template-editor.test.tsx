import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Mock TipTap
vi.mock("@tiptap/react", () => ({
  useEditor: () => ({
    getText: () => "test",
    commands: { setContent: vi.fn() },
  }),
  EditorContent: ({ editor }: any) => <div data-testid="editor-content">Editor</div>,
}));

vi.mock("@tiptap/starter-kit", () => ({
  default: { configure: () => ({}) },
}));

vi.mock("@tiptap/extension-placeholder", () => ({
  default: { configure: () => ({}) },
}));

import { VariablePicker, TemplatePreview } from "@/components/template-editor";

describe("VariablePicker", () => {
  const variables = [
    { name: "appName", description: "App name", example: "OrderFlow Pro" },
    { name: "position", description: "Position", example: "3" },
    { name: "keyword", description: "Keyword", example: "crm" },
  ];

  it("renders all variable chips", () => {
    render(<VariablePicker variables={variables} onInsert={vi.fn()} />);
    expect(screen.getByText("{{appName}}")).toBeInTheDocument();
    expect(screen.getByText("{{position}}")).toBeInTheDocument();
    expect(screen.getByText("{{keyword}}")).toBeInTheDocument();
  });

  it("calls onInsert with variable name when clicked", () => {
    const onInsert = vi.fn();
    render(<VariablePicker variables={variables} onInsert={onInsert} />);
    fireEvent.click(screen.getByText("{{appName}}"));
    expect(onInsert).toHaveBeenCalledWith("appName");
  });

  it("shows header text", () => {
    render(<VariablePicker variables={variables} onInsert={vi.fn()} />);
    expect(screen.getByText("Available Variables")).toBeInTheDocument();
  });
});

describe("TemplatePreview", () => {
  it("renders title and body", () => {
    render(<TemplatePreview title="Hello World" body="This is a test" />);
    expect(screen.getByText("Hello World")).toBeInTheDocument();
    expect(screen.getByText("This is a test")).toBeInTheDocument();
  });

  it("shows empty state for empty values", () => {
    render(<TemplatePreview title="" body="" />);
    expect(screen.getByText("(empty title)")).toBeInTheDocument();
    expect(screen.getByText("(empty body)")).toBeInTheDocument();
  });

  it("shows Preview header", () => {
    render(<TemplatePreview title="Test" body="Test" />);
    expect(screen.getByText("Preview")).toBeInTheDocument();
  });
});
