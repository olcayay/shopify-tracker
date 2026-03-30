import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

const mockFetchWithAuth = vi.fn();
const mockRefreshUser = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    fetchWithAuth: mockFetchWithAuth,
    refreshUser: mockRefreshUser,
  }),
}));

import { BookmarkCategoryButton } from "@/components/bookmark-category-button";

describe("BookmarkCategoryButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders bookmark button", () => {
    render(
      <BookmarkCategoryButton categorySlug="analytics" initialStarred={false} />
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("shows unbookmarked state initially", () => {
    render(
      <BookmarkCategoryButton categorySlug="analytics" initialStarred={false} />
    );
    const button = screen.getByRole("button");
    expect(button.title).toBe("Bookmark this category");
  });

  it("shows bookmarked state initially", () => {
    render(
      <BookmarkCategoryButton categorySlug="analytics" initialStarred={true} />
    );
    const button = screen.getByRole("button");
    expect(button.title).toBe("Remove bookmark");
  });

  it("bookmarks category on click when unbookmarked", async () => {
    const user = userEvent.setup();
    mockFetchWithAuth.mockResolvedValue({ ok: true });

    render(
      <BookmarkCategoryButton categorySlug="analytics" initialStarred={false} />
    );

    await user.click(screen.getByRole("button"));

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/account/starred-categories",
      {
        method: "POST",
        body: JSON.stringify({ slug: "analytics" }),
      }
    );
  });

  it("refreshes user after successful bookmark", async () => {
    const user = userEvent.setup();
    mockFetchWithAuth.mockResolvedValue({ ok: true });

    render(
      <BookmarkCategoryButton categorySlug="analytics" initialStarred={false} />
    );

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockRefreshUser).toHaveBeenCalled();
    });
  });

  it("shows confirm modal when clicking bookmarked button", async () => {
    const user = userEvent.setup();

    render(
      <BookmarkCategoryButton categorySlug="analytics" initialStarred={true} />
    );

    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Remove Bookmarked Category")).toBeInTheDocument();
    expect(
      screen.getByText(/Remove bookmark for/)
    ).toBeInTheDocument();
  });

  it("removes bookmark after confirming in modal", async () => {
    const user = userEvent.setup();
    mockFetchWithAuth.mockResolvedValue({ ok: true });

    render(
      <BookmarkCategoryButton categorySlug="analytics" initialStarred={true} />
    );

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Remove"));

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/account/starred-categories/analytics",
      { method: "DELETE" }
    );
  });

  it("cancels remove bookmark from modal", async () => {
    const user = userEvent.setup();

    render(
      <BookmarkCategoryButton categorySlug="analytics" initialStarred={true} />
    );

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Cancel"));

    expect(mockFetchWithAuth).not.toHaveBeenCalled();
  });

  it("shows error modal on bookmark failure", async () => {
    const user = userEvent.setup();
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Limit reached" }),
    });

    render(
      <BookmarkCategoryButton categorySlug="analytics" initialStarred={false} />
    );

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText("Limit reached")).toBeInTheDocument();
    });
  });

  it("supports small size", () => {
    render(
      <BookmarkCategoryButton
        categorySlug="analytics"
        initialStarred={false}
        size="sm"
      />
    );
    const button = screen.getByRole("button");
    expect(button.className).toContain("h-7");
  });

  it("supports default size", () => {
    render(
      <BookmarkCategoryButton categorySlug="analytics" initialStarred={false} />
    );
    const button = screen.getByRole("button");
    expect(button.className).toContain("h-9");
  });

  it("disables button while loading", async () => {
    const user = userEvent.setup();
    let resolvePromise: () => void;
    mockFetchWithAuth.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = () => resolve({ ok: true });
      })
    );

    render(
      <BookmarkCategoryButton categorySlug="analytics" initialStarred={false} />
    );

    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toBeDisabled();

    resolvePromise!();
  });
});
