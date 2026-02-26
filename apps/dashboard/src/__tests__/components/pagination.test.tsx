import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TablePagination } from "@/components/pagination";

describe("TablePagination", () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 5,
    totalItems: 50,
    pageSize: 10,
    onPageChange: vi.fn(),
  };

  it("renders nothing when totalPages is 1", () => {
    const { container } = render(
      <TablePagination {...defaultProps} totalPages={1} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when totalPages is 0", () => {
    const { container } = render(
      <TablePagination {...defaultProps} totalPages={0} totalItems={0} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows correct range text for first page", () => {
    render(<TablePagination {...defaultProps} />);
    expect(screen.getByText(/Showing 1/)).toBeInTheDocument();
    expect(screen.getByText(/of 50/)).toBeInTheDocument();
  });

  it("shows correct range text for middle page", () => {
    render(<TablePagination {...defaultProps} currentPage={3} />);
    expect(screen.getByText(/Showing 21/)).toBeInTheDocument();
  });

  it("shows correct range for last page with partial items", () => {
    render(
      <TablePagination
        {...defaultProps}
        currentPage={5}
        totalItems={47}
      />
    );
    expect(screen.getByText(/Showing 41/)).toBeInTheDocument();
    expect(screen.getByText(/of 47/)).toBeInTheDocument();
  });

  it("disables prev button on first page", () => {
    render(<TablePagination {...defaultProps} currentPage={1} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(<TablePagination {...defaultProps} currentPage={5} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[buttons.length - 1]).toBeDisabled();
  });

  it("enables both buttons on middle page", () => {
    render(<TablePagination {...defaultProps} currentPage={3} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).not.toBeDisabled();
    expect(buttons[buttons.length - 1]).not.toBeDisabled();
  });

  it("calls onPageChange with prev page", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <TablePagination
        {...defaultProps}
        currentPage={3}
        onPageChange={onPageChange}
      />
    );

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[0]); // prev button
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange with next page", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <TablePagination
        {...defaultProps}
        currentPage={3}
        onPageChange={onPageChange}
      />
    );

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]); // next button
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it("calls onPageChange when page number is clicked", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <TablePagination
        {...defaultProps}
        currentPage={1}
        totalPages={5}
        onPageChange={onPageChange}
      />
    );

    await user.click(screen.getByText("3"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("renders all pages when total <= 7", () => {
    render(
      <TablePagination
        {...defaultProps}
        totalPages={5}
        totalItems={50}
      />
    );
    for (let i = 1; i <= 5; i++) {
      expect(screen.getByText(String(i))).toBeInTheDocument();
    }
  });

  it("renders ellipsis for many pages", () => {
    render(
      <TablePagination
        {...defaultProps}
        currentPage={5}
        totalPages={20}
        totalItems={200}
      />
    );
    const ellipses = screen.getAllByText("...");
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
  });

  it("always shows first and last page", () => {
    render(
      <TablePagination
        {...defaultProps}
        currentPage={10}
        totalPages={20}
        totalItems={200}
      />
    );
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  it("shows current page and neighbors", () => {
    render(
      <TablePagination
        {...defaultProps}
        currentPage={10}
        totalPages={20}
        totalItems={200}
      />
    );
    expect(screen.getByText("9")).toBeInTheDocument();
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
  });
});
