import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeywordWordGroupFilter } from "@/components/keyword-word-group-filter";

describe("KeywordWordGroupFilter", () => {
  const wordGroups = [
    { word: "chatbot", count: 3 },
    { word: "ai", count: 2 },
    { word: "helpdesk", count: 2 },
  ];

  it("renders nothing when wordGroups is empty", () => {
    const { container } = render(
      <KeywordWordGroupFilter wordGroups={[]} activeWords={new Set()} onToggle={vi.fn()} onClear={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders all word groups with counts", () => {
    render(
      <KeywordWordGroupFilter wordGroups={wordGroups} activeWords={new Set()} onToggle={vi.fn()} onClear={vi.fn()} />
    );
    expect(screen.getByText("chatbot")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("ai")).toBeInTheDocument();
    expect(screen.getByText("helpdesk")).toBeInTheDocument();
    expect(screen.getAllByText("2")).toHaveLength(2);
  });

  it("renders 'Common words:' label", () => {
    render(
      <KeywordWordGroupFilter wordGroups={wordGroups} activeWords={new Set()} onToggle={vi.fn()} onClear={vi.fn()} />
    );
    expect(screen.getByText("Common words:")).toBeInTheDocument();
  });

  it("calls onToggle with word when clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <KeywordWordGroupFilter wordGroups={wordGroups} activeWords={new Set()} onToggle={onToggle} onClear={vi.fn()} />
    );
    await user.click(screen.getByText("chatbot"));
    expect(onToggle).toHaveBeenCalledWith("chatbot");
  });

  it("calls onToggle with word when active word is clicked (toggle off)", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <KeywordWordGroupFilter wordGroups={wordGroups} activeWords={new Set(["chatbot"])} onToggle={onToggle} onClear={vi.fn()} />
    );
    await user.click(screen.getByText("chatbot"));
    expect(onToggle).toHaveBeenCalledWith("chatbot");
  });

  it("supports multiple active words simultaneously", () => {
    render(
      <KeywordWordGroupFilter
        wordGroups={wordGroups}
        activeWords={new Set(["chatbot", "ai"])}
        onToggle={vi.fn()}
        onClear={vi.fn()}
      />
    );
    // Both should have active styling (bg-muted class)
    const chatbotBtn = screen.getByText("chatbot").closest("button")!;
    const aiBtn = screen.getByText("ai").closest("button")!;
    const helpdeskBtn = screen.getByText("helpdesk").closest("button")!;
    expect(chatbotBtn.className).toContain("bg-muted");
    expect(aiBtn.className).toContain("bg-muted");
    expect(helpdeskBtn.className).toContain("border-dashed");
  });

  it("does not show Clear button when no words are active", () => {
    render(
      <KeywordWordGroupFilter wordGroups={wordGroups} activeWords={new Set()} onToggle={vi.fn()} onClear={vi.fn()} />
    );
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
  });

  it("shows Clear button when any word is active", () => {
    render(
      <KeywordWordGroupFilter wordGroups={wordGroups} activeWords={new Set(["chatbot"])} onToggle={vi.fn()} onClear={vi.fn()} />
    );
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("shows Clear button when multiple words are active", () => {
    render(
      <KeywordWordGroupFilter wordGroups={wordGroups} activeWords={new Set(["chatbot", "ai"])} onToggle={vi.fn()} onClear={vi.fn()} />
    );
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("Clear button calls onClear", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(
      <KeywordWordGroupFilter wordGroups={wordGroups} activeWords={new Set(["chatbot"])} onToggle={vi.fn()} onClear={onClear} />
    );
    await user.click(screen.getByText("Clear"));
    expect(onClear).toHaveBeenCalled();
  });
});
