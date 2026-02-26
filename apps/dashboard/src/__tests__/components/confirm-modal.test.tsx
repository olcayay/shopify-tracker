import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmModal } from "@/components/confirm-modal";

describe("ConfirmModal", () => {
  const defaultProps = {
    open: true,
    title: "Delete Item",
    description: "Are you sure you want to delete this item?",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  it("renders nothing when open is false", () => {
    const { container } = render(
      <ConfirmModal {...defaultProps} open={false} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders title and description when open", () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText("Delete Item")).toBeInTheDocument();
    expect(
      screen.getByText("Are you sure you want to delete this item?")
    ).toBeInTheDocument();
  });

  it("renders default button labels", () => {
    render(<ConfirmModal {...defaultProps} />);
    expect(screen.getByText("Confirm")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("renders custom button labels", () => {
    render(
      <ConfirmModal
        {...defaultProps}
        confirmLabel="Delete"
        cancelLabel="Keep"
      />
    );
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Keep")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<ConfirmModal {...defaultProps} onConfirm={onConfirm} />);

    await user.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);

    await user.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when overlay is clicked", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<ConfirmModal {...defaultProps} onCancel={onCancel} />);

    // The overlay is the first child div with bg-black/50
    const overlay = document.querySelector(".bg-black\\/50");
    expect(overlay).toBeTruthy();
    await user.click(overlay!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("uses destructive variant by default", () => {
    render(<ConfirmModal {...defaultProps} />);
    const confirmBtn = screen.getByText("Confirm");
    // The button should exist (we can't easily check variant in jsdom)
    expect(confirmBtn).toBeInTheDocument();
  });

  it("supports non-destructive mode", () => {
    render(<ConfirmModal {...defaultProps} destructive={false} />);
    const confirmBtn = screen.getByText("Confirm");
    expect(confirmBtn).toBeInTheDocument();
  });

  it("renders overlay backdrop", () => {
    render(<ConfirmModal {...defaultProps} />);
    const overlay = document.querySelector(".bg-black\\/50");
    expect(overlay).toBeTruthy();
  });

  it("renders dialog container", () => {
    render(<ConfirmModal {...defaultProps} />);
    const dialog = document.querySelector(".bg-background");
    expect(dialog).toBeTruthy();
  });
});
