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
      <KeywordWordGroupFilter wordGroups={[]} activeWord={null} onSelect={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders all word groups with counts", () => {
    render(
      <KeywordWordGroupFilter wordGroups={wordGroups} activeWord={null} onSelect={vi.fn()} />
    );
    expect(screen.getByText("chatbot")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("ai")).toBeInTheDocument();
    expect(screen.getByText("helpdesk")).toBeInTheDocument();
    expect(screen.getAllByText("2")).toHaveLength(2);
  });

  it("renders 'Common words:' label", () => {
    render(
      <KeywordWordGroupFilter wordGroups={wordGroups} activeWord={null} onSelect={vi.fn()} />
    );
    expect(screen.getByText("Common words:")).toBeInTheDocument();
  });

  it("calls onSelect with word when clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <KeywordWordGroupFilter wordGroups={wordGroups} activeWord={null} onSelect={onSelect} />
    );
    await user.click(screen.getByText("chatbot"));
    expect(onSelect).toHaveBeenCalledWith("chatbot");
  });

  it("calls onSelect with null when active word is clicked (toggle off)", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <KeywordWordGroupFilter wordGroups={wordGroups} activeWord="chatbot" onSelect={onSelect} />
    );
    await user.click(screen.getByText("chatbot"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("does not show Clear button when no word is active", () => {
    render(
      <KeywordWordGroupFilter wordGroups={wordGroups} activeWord={null} onSelect={vi.fn()} />
    );
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
  });

  it("shows Clear button when a word is active", () => {
    render(
      <KeywordWordGroupFilter wordGroups={wordGroups} activeWord="chatbot" onSelect={vi.fn()} />
    );
    expect(screen.getByText("Clear")).toBeInTheDocument();
  });

  it("Clear button calls onSelect with null", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <KeywordWordGroupFilter wordGroups={wordGroups} activeWord="chatbot" onSelect={onSelect} />
    );
    await user.click(screen.getByText("Clear"));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
