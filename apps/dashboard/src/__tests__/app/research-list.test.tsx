import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useParams } from "next/navigation";

const mockFetchWithAuth = vi.fn();
const mockPush = vi.fn();

vi.mock("next/navigation", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    useParams: vi.fn(() => ({ platform: "shopify" })),
    useRouter: () => ({
      push: mockPush,
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
    }),
  };
});

vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({
    user: {
      id: "u1",
      name: "Test User",
      email: "test@example.com",
      role: "owner",
      isSystemAdmin: false,
    },
    account: {
      id: "acc-1",
      name: "Test Account",
      usage: { researchProjects: 1 },
      limits: { maxResearchProjects: 3 },
    },
    isLoading: false,
    fetchWithAuth: mockFetchWithAuth,
  }),
}));

// Mock skeletons
vi.mock("@/components/skeletons", () => ({
  TableSkeleton: () => <div data-testid="table-skeleton">Loading...</div>,
}));

// Mock confirm modal
vi.mock("@/components/confirm-modal", () => ({
  ConfirmModal: ({
    open,
    title,
    onConfirm,
    onCancel,
  }: {
    open: boolean;
    title: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    open ? (
      <div data-testid="confirm-modal">
        <span>{title}</span>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

import ResearchListPage from "@/app/(dashboard)/[platform]/research/page";

describe("ResearchListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useParams).mockReturnValue({ platform: "shopify" });
  });

  it("shows loading skeleton initially", () => {
    mockFetchWithAuth.mockReturnValue(new Promise(() => {}));
    render(<ResearchListPage />);
    expect(screen.getByText("Research Projects")).toBeInTheDocument();
    expect(screen.getByTestId("table-skeleton")).toBeInTheDocument();
  });

  it("renders Research Projects heading with usage count", () => {
    mockFetchWithAuth.mockReturnValue(new Promise(() => {}));
    render(<ResearchListPage />);
    expect(screen.getByText("(1/3)")).toBeInTheDocument();
  });

  it("renders project list after loading", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url === "/api/research-projects") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: "p1",
                name: "My Research",
                creatorName: "Test User",
                createdAt: "2026-03-01T00:00:00Z",
                updatedAt: "2026-03-15T00:00:00Z",
              },
            ]),
        });
      }
      // Project data
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            project: { id: "p1", name: "My Research" },
            keywords: [],
            competitors: [],
            keywordRankings: {},
            competitorSuggestions: [],
            keywordSuggestions: [],
            wordAnalysis: [],
            categories: [],
            featureCoverage: [],
            opportunities: [],
            virtualApps: [],
          }),
      });
    });
    render(<ResearchListPage />);
    await waitFor(() => {
      expect(screen.getByText("My Research")).toBeInTheDocument();
    });
  });

  it("shows empty state when no projects", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    render(<ResearchListPage />);
    await waitFor(() => {
      expect(
        screen.getByText("No research projects yet")
      ).toBeInTheDocument();
    });
  });

  it("shows Create Your First Project button in empty state for editors", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    render(<ResearchListPage />);
    await waitFor(() => {
      expect(
        screen.getByText("Create Your First Project")
      ).toBeInTheDocument();
    });
  });

  it("shows New Project button for editors when projects exist", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url === "/api/research-projects") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: "p1",
                name: "Project 1",
                creatorName: null,
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-01T00:00:00Z",
              },
            ]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            project: { id: "p1", name: "Project 1" },
            keywords: [],
            competitors: [],
            keywordRankings: {},
            competitorSuggestions: [],
            keywordSuggestions: [],
            wordAnalysis: [],
            categories: [],
            featureCoverage: [],
            opportunities: [],
            virtualApps: [],
          }),
      });
    });
    render(<ResearchListPage />);
    await waitFor(() => {
      expect(screen.getByText("New Project")).toBeInTheDocument();
    });
  });

  it("calls fetchWithAuth to load projects", async () => {
    mockFetchWithAuth.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });
    render(<ResearchListPage />);
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/api/research-projects"
      );
    });
  });

  it("renders creator name and dates for projects", async () => {
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url === "/api/research-projects") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              {
                id: "p1",
                name: "Research Project",
                creatorName: "Alice",
                createdAt: "2026-03-01T00:00:00Z",
                updatedAt: "2026-03-20T00:00:00Z",
              },
            ]),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            project: { id: "p1", name: "Research Project" },
            keywords: [],
            competitors: [],
            keywordRankings: {},
            competitorSuggestions: [],
            keywordSuggestions: [],
            wordAnalysis: [],
            categories: [],
            featureCoverage: [],
            opportunities: [],
            virtualApps: [],
          }),
      });
    });
    render(<ResearchListPage />);
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText(/Created/)).toBeInTheDocument();
      expect(screen.getByText(/Updated/)).toBeInTheDocument();
    });
  });

  it("navigates to project detail when creating new project", async () => {
    const user = userEvent.setup();
    mockFetchWithAuth.mockImplementation((url: string, options?: any) => {
      if (url === "/api/research-projects" && !options?.method) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      if (url === "/api/research-projects" && options?.method === "POST") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "new-project-id" }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({}),
      });
    });
    render(<ResearchListPage />);
    await waitFor(() => {
      expect(
        screen.getByText("Create Your First Project")
      ).toBeInTheDocument();
    });
    await user.click(screen.getByText("Create Your First Project"));
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        "/shopify/research/new-project-id"
      );
    });
  });
});
