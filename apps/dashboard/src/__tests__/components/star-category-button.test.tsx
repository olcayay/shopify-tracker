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

import { StarCategoryButton } from "@/components/star-category-button";

describe("StarCategoryButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders star button", () => {
    render(
      <StarCategoryButton categorySlug="analytics" initialStarred={false} />
    );
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("shows unstarred state initially", () => {
    render(
      <StarCategoryButton categorySlug="analytics" initialStarred={false} />
    );
    const button = screen.getByRole("button");
    expect(button.title).toBe("Star this category");
  });

  it("shows starred state initially", () => {
    render(
      <StarCategoryButton categorySlug="analytics" initialStarred={true} />
    );
    const button = screen.getByRole("button");
    expect(button.title).toBe("Remove from starred categories");
  });

  it("stars category on click when unstarred", async () => {
    const user = userEvent.setup();
    mockFetchWithAuth.mockResolvedValue({ ok: true });

    render(
      <StarCategoryButton categorySlug="analytics" initialStarred={false} />
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

  it("refreshes user after successful star", async () => {
    const user = userEvent.setup();
    mockFetchWithAuth.mockResolvedValue({ ok: true });

    render(
      <StarCategoryButton categorySlug="analytics" initialStarred={false} />
    );

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(mockRefreshUser).toHaveBeenCalled();
    });
  });

  it("shows confirm modal when clicking starred button", async () => {
    const user = userEvent.setup();

    render(
      <StarCategoryButton categorySlug="analytics" initialStarred={true} />
    );

    await user.click(screen.getByRole("button"));

    expect(screen.getByText("Remove Starred Category")).toBeInTheDocument();
    expect(
      screen.getByText(/Are you sure you want to remove/)
    ).toBeInTheDocument();
  });

  it("unstars after confirming in modal", async () => {
    const user = userEvent.setup();
    mockFetchWithAuth.mockResolvedValue({ ok: true });

    render(
      <StarCategoryButton categorySlug="analytics" initialStarred={true} />
    );

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Remove"));

    expect(mockFetchWithAuth).toHaveBeenCalledWith(
      "/api/account/starred-categories/analytics",
      { method: "DELETE" }
    );
  });

  it("cancels unstar from modal", async () => {
    const user = userEvent.setup();

    render(
      <StarCategoryButton categorySlug="analytics" initialStarred={true} />
    );

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("Cancel"));

    expect(mockFetchWithAuth).not.toHaveBeenCalled();
  });

  it("shows error modal on star failure", async () => {
    const user = userEvent.setup();
    mockFetchWithAuth.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Limit reached" }),
    });

    render(
      <StarCategoryButton categorySlug="analytics" initialStarred={false} />
    );

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText("Limit reached")).toBeInTheDocument();
    });
  });

  it("supports small size", () => {
    render(
      <StarCategoryButton
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
      <StarCategoryButton categorySlug="analytics" initialStarred={false} />
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
      <StarCategoryButton categorySlug="analytics" initialStarred={false} />
    );

    await user.click(screen.getByRole("button"));
    expect(screen.getByRole("button")).toBeDisabled();

    resolvePromise!();
  });
});
