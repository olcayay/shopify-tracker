import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockFetchWithAuth = vi.fn();

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Admin", email: "a@b.com", role: "owner", isSystemAdmin: true, emailDigestEnabled: true, timezone: "UTC" },
    account: null,
    isLoading: false,
    fetchWithAuth: mockFetchWithAuth,
    refreshUser: vi.fn(),
  }),
}));

vi.mock("@/lib/format-utils", () => ({
  timeAgo: (d: string) => d,
}));

import AppUpdatesPage from "@/app/(dashboard)/system-admin/app-updates/page";

function mockOkResponse(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}

const titleSubtitleConflictLabel = {
  id: 101,
  name: "title-subtitle-conflict",
  color: "#ef4444",
  isDismissal: true,
};
const duplicateLabel = {
  id: 102,
  name: "duplicate",
  color: "#dc2626",
  isDismissal: true,
};

const mockApiResponse = {
  data: [
    {
      id: 1,
      appName: "App One",
      appSlug: "app-one",
      platform: "shopify",
      field: "appCardSubtitle",
      oldValue: "Old subtitle",
      newValue: "New subtitle",
      detectedAt: "2026-04-11T10:00:00Z",
      labels: [],
    },
    {
      id: 2,
      appName: "App Two",
      appSlug: "app-two",
      platform: "shopify",
      field: "appCardSubtitle",
      oldValue: "App Two",
      newValue: "Real subtitle",
      detectedAt: "2026-04-11T09:00:00Z",
      labels: [titleSubtitleConflictLabel],
    },
    {
      id: 3,
      appName: "App Three",
      appSlug: "app-three",
      platform: "wix",
      field: "name",
      oldValue: "Old Name",
      newValue: "New Name",
      detectedAt: "2026-04-11T08:00:00Z",
      labels: [duplicateLabel],
    },
  ],
  pagination: { page: 1, limit: 50, total: 3, totalPages: 1 },
  filters: {
    fields: ["appCardSubtitle", "name"],
    platforms: ["shopify", "wix"],
    labels: [titleSubtitleConflictLabel, duplicateLabel],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchWithAuth.mockResolvedValue(mockOkResponse(mockApiResponse));
});

describe("AppUpdatesPage — bulk operations", () => {
  it("renders checkboxes for each row", async () => {
    render(<AppUpdatesPage />);
    await waitFor(() => {
      expect(screen.getByText("App One")).toBeInTheDocument();
    });
    const checkboxes = screen.getAllByRole("checkbox");
    // 1 header checkbox + 3 row checkboxes
    expect(checkboxes).toHaveLength(4);
  });

  it("shows bulk actions bar when items are selected", async () => {
    const user = userEvent.setup();
    render(<AppUpdatesPage />);
    await waitFor(() => {
      expect(screen.getByText("App One")).toBeInTheDocument();
    });

    // Click first row checkbox
    const checkboxes = screen.getAllByRole("checkbox");
    await act(async () => {
      await user.click(checkboxes[1]); // first row
    });

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByText("Delete Selected")).toBeInTheDocument();
  });

  it("select all checkbox selects all rows", async () => {
    const user = userEvent.setup();
    render(<AppUpdatesPage />);
    await waitFor(() => {
      expect(screen.getByText("App One")).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole("checkbox");
    await act(async () => {
      await user.click(checkboxes[0]); // header checkbox = select all
    });

    expect(screen.getByText("3 selected")).toBeInTheDocument();
  });

  it("shows confirmation dialog on bulk delete", async () => {
    const user = userEvent.setup();
    render(<AppUpdatesPage />);
    await waitFor(() => {
      expect(screen.getByText("App One")).toBeInTheDocument();
    });

    // Select all
    const checkboxes = screen.getAllByRole("checkbox");
    await act(async () => {
      await user.click(checkboxes[0]);
    });

    // Click delete
    await act(async () => {
      await user.click(screen.getByText("Delete Selected"));
    });

    expect(screen.getByText("Delete selected updates")).toBeInTheDocument();
    expect(screen.getByText(/Permanently delete 3 selected updates/)).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls bulk-delete API on confirm", async () => {
    const user = userEvent.setup();
    render(<AppUpdatesPage />);
    await waitFor(() => {
      expect(screen.getByText("App One")).toBeInTheDocument();
    });

    // Select first row
    const checkboxes = screen.getAllByRole("checkbox");
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    // Click Delete Selected
    await act(async () => {
      await user.click(screen.getByText("Delete Selected"));
    });

    // Confirm
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "Delete" }));
    });

    // Verify API was called with correct body
    const deleteCall = mockFetchWithAuth.mock.calls.find(
      (call: unknown[]) => (call[0] as string) === "/api/system-admin/app-updates/bulk-delete"
    );
    expect(deleteCall).toBeDefined();
    expect(JSON.parse(deleteCall![1].body)).toEqual({ ids: [1] });
  });

  it("shows Restore Selected button only when dismissed items are selected", async () => {
    const user = userEvent.setup();
    render(<AppUpdatesPage />);
    await waitFor(() => {
      expect(screen.getByText("App One")).toBeInTheDocument();
    });

    // Select first row (not dismissed)
    const checkboxes = screen.getAllByRole("checkbox");
    await act(async () => {
      await user.click(checkboxes[1]);
    });

    expect(screen.queryByText("Restore Selected")).not.toBeInTheDocument();

    // Also select second row (dismissed)
    await act(async () => {
      await user.click(checkboxes[2]);
    });

    expect(screen.getByText("Restore Selected")).toBeInTheDocument();
  });

  it("calls bulk-restore API when restore is clicked", async () => {
    const user = userEvent.setup();
    // Return ok for all calls (initial fetch + restore)
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("bulk-restore")) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ restored: 1 }) });
      }
      return Promise.resolve(mockOkResponse(mockApiResponse));
    });
    render(<AppUpdatesPage />);
    await waitFor(() => {
      expect(screen.getByText("App One")).toBeInTheDocument();
    });

    // Select second row (dismissed — "App Two" with title-subtitle-conflict)
    const checkboxes = screen.getAllByRole("checkbox");
    await act(async () => {
      await user.click(checkboxes[2]);
    });

    // Click restore
    await act(async () => {
      await user.click(screen.getByText("Restore Selected"));
    });

    const restoreCall = mockFetchWithAuth.mock.calls.find(
      (call: unknown[]) => (call[0] as string) === "/api/system-admin/app-updates/bulk-restore"
    );
    expect(restoreCall).toBeDefined();
    expect(JSON.parse(restoreCall![1].body)).toEqual({ ids: [2] });
  });

  it("shows single delete button per row and triggers confirmation", async () => {
    const user = userEvent.setup();
    render(<AppUpdatesPage />);
    await waitFor(() => {
      expect(screen.getByText("App One")).toBeInTheDocument();
    });

    // Find delete buttons (one per row)
    const deleteButtons = screen.getAllByTitle("Delete permanently");
    expect(deleteButtons).toHaveLength(3);

    // Click first row's delete button
    await act(async () => {
      await user.click(deleteButtons[0]);
    });

    // Confirmation dialog
    expect(screen.getByText("Delete update")).toBeInTheDocument();
    expect(screen.getByText(/Permanently delete this update for "App One"/)).toBeInTheDocument();
  });

  it("renders dismissal labels as pills on dismissed rows", async () => {
    render(<AppUpdatesPage />);
    await waitFor(() => {
      expect(screen.getByText("App One")).toBeInTheDocument();
    });
    // Label appears twice: once as a pill on the row, once as an <option> in
    // the label filter dropdown. The pill carries the tooltip set only on
    // dismissal pills.
    const pills = screen
      .getAllByText("title-subtitle-conflict")
      .filter((el) => el.tagName === "SPAN");
    expect(pills).toHaveLength(1);
    expect(pills[0].getAttribute("title")).toMatch(/Dismissal label/);
  });

  it("status filter dropdown exposes Active / Dismissed options", async () => {
    render(<AppUpdatesPage />);
    await waitFor(() => {
      expect(screen.getByText("App One")).toBeInTheDocument();
    });
    expect(screen.getByText("All Status")).toBeInTheDocument();
    expect(screen.getByText(/Active \(no dismissal label\)/)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Dismissed" })).toBeInTheDocument();
  });

  it("clear selection button works", async () => {
    const user = userEvent.setup();
    render(<AppUpdatesPage />);
    await waitFor(() => {
      expect(screen.getByText("App One")).toBeInTheDocument();
    });

    // Select all
    const checkboxes = screen.getAllByRole("checkbox");
    await act(async () => {
      await user.click(checkboxes[0]);
    });
    expect(screen.getByText("3 selected")).toBeInTheDocument();

    // Clear
    await act(async () => {
      await user.click(screen.getByText("Clear selection"));
    });
    expect(screen.queryByText("3 selected")).not.toBeInTheDocument();
  });
});
