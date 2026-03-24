import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeywordTagManager } from "@/components/keyword-tag-manager";

const mockTags = [
  { id: "tag-1", name: "Priority", color: "red" },
  { id: "tag-2", name: "Review", color: "blue" },
];

const defaultProps = {
  keywordId: 1,
  currentTags: [mockTags[0]],
  allTags: mockTags,
  onAssign: vi.fn().mockResolvedValue(undefined),
  onUnassign: vi.fn().mockResolvedValue(undefined),
  onCreateTag: vi.fn().mockResolvedValue(undefined),
  onDeleteTag: vi.fn().mockResolvedValue(undefined),
  onUpdateTag: vi.fn().mockResolvedValue(undefined),
};

describe("KeywordTagManager", () => {
  it("renders the manage tags button", () => {
    render(<KeywordTagManager {...defaultProps} />);
    expect(screen.getByTitle("Manage tags")).toBeInTheDocument();
  });

  it("opens the tag dropdown when button is clicked", async () => {
    const user = userEvent.setup();
    render(<KeywordTagManager {...defaultProps} />);

    await user.click(screen.getByTitle("Manage tags"));

    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Review")).toBeInTheDocument();
  });

  it("shows checkmark for assigned tags", async () => {
    const user = userEvent.setup();
    const { container } = render(<KeywordTagManager {...defaultProps} />);

    await user.click(screen.getByTitle("Manage tags"));

    // The "Priority" tag (tag-1) is in currentTags, so it should show a checkmark
    // Check by looking for the Check icon (lucide svg with class containing "text-primary")
    const checkIcons = container.querySelectorAll(".text-primary");
    expect(checkIcons.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onAssign when clicking an unassigned tag", async () => {
    const user = userEvent.setup();
    const onAssign = vi.fn().mockResolvedValue(undefined);
    render(<KeywordTagManager {...defaultProps} onAssign={onAssign} />);

    await user.click(screen.getByTitle("Manage tags"));
    await user.click(screen.getByText("Review"));

    expect(onAssign).toHaveBeenCalledWith("tag-2");
  });

  it("calls onUnassign when clicking an assigned tag", async () => {
    const user = userEvent.setup();
    const onUnassign = vi.fn().mockResolvedValue(undefined);
    render(<KeywordTagManager {...defaultProps} onUnassign={onUnassign} />);

    await user.click(screen.getByTitle("Manage tags"));
    await user.click(screen.getByText("Priority"));

    expect(onUnassign).toHaveBeenCalledWith("tag-1");
  });

  it("shows 'Create new tag' option", async () => {
    const user = userEvent.setup();
    render(<KeywordTagManager {...defaultProps} />);

    await user.click(screen.getByTitle("Manage tags"));

    expect(screen.getByText("Create new tag")).toBeInTheDocument();
  });

  it("shows create tag form when 'Create new tag' is clicked", async () => {
    const user = userEvent.setup();
    render(<KeywordTagManager {...defaultProps} />);

    await user.click(screen.getByTitle("Manage tags"));
    await user.click(screen.getByText("Create new tag"));

    expect(screen.getByPlaceholderText("Tag name...")).toBeInTheDocument();
    expect(screen.getByText("Create")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onCreateTag when submitting the create form", async () => {
    const user = userEvent.setup();
    const onCreateTag = vi.fn().mockResolvedValue(undefined);
    render(
      <KeywordTagManager {...defaultProps} onCreateTag={onCreateTag} />
    );

    await user.click(screen.getByTitle("Manage tags"));
    await user.click(screen.getByText("Create new tag"));

    await user.type(screen.getByPlaceholderText("Tag name..."), "New Tag");
    await user.click(screen.getByText("Create"));

    expect(onCreateTag).toHaveBeenCalledWith("New Tag", "red");
  });
});
