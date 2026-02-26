import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeywordTagBadge } from "@/components/keyword-tag-badge";

describe("KeywordTagBadge", () => {
  const defaultTag = {
    id: "tag-1",
    name: "SEO",
    color: "blue",
  };

  it("renders tag name", () => {
    render(<KeywordTagBadge tag={defaultTag} />);
    expect(screen.getByText("SEO")).toBeInTheDocument();
  });

  it("renders without remove button by default", () => {
    const { container } = render(<KeywordTagBadge tag={defaultTag} />);
    expect(container.querySelector("button")).toBeNull();
  });

  it("renders remove button when onRemove is provided", () => {
    render(<KeywordTagBadge tag={defaultTag} onRemove={vi.fn()} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("calls onRemove when X button is clicked", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(<KeywordTagBadge tag={defaultTag} onRemove={onRemove} />);

    await user.click(screen.getByRole("button"));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("stops event propagation on remove click", async () => {
    const parentClick = vi.fn();
    const onRemove = vi.fn();
    const user = userEvent.setup();

    render(
      <div onClick={parentClick}>
        <KeywordTagBadge tag={defaultTag} onRemove={onRemove} />
      </div>
    );

    await user.click(screen.getByRole("button"));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(parentClick).not.toHaveBeenCalled();
  });

  it("applies correct color classes for blue tag", () => {
    const { container } = render(<KeywordTagBadge tag={defaultTag} />);
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("blue");
  });

  it("applies correct color classes for red tag", () => {
    const { container } = render(
      <KeywordTagBadge tag={{ ...defaultTag, color: "red" }} />
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("red");
  });

  it("falls back to rose for unknown color", () => {
    const { container } = render(
      <KeywordTagBadge tag={{ ...defaultTag, color: "nonexistent" }} />
    );
    const badge = container.firstElementChild;
    expect(badge?.className).toContain("rose");
  });

  it("renders different tag names", () => {
    const tags = ["React", "Shopify", "E-commerce", "Marketing"];
    for (const name of tags) {
      const { unmount } = render(
        <KeywordTagBadge tag={{ ...defaultTag, name }} />
      );
      expect(screen.getByText(name)).toBeInTheDocument();
      unmount();
    }
  });
});
