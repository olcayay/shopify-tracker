import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { mockAuthContext, mockAccount, mockUser, mockViewerUser } from "../test-utils";

const mockFetchWithAuth = vi.fn();
const mockRefreshUser = vi.fn();
const mockUseAuth = vi.fn().mockReturnValue({
  ...mockAuthContext,
  fetchWithAuth: mockFetchWithAuth,
  refreshUser: mockRefreshUser,
});

vi.mock("@/lib/auth-context", () => ({
  useAuth: (...args: any[]) => mockUseAuth(...args),
}));

import { AppQuickActions } from "@/components/app-quick-actions";

function makeJsonResponse(data: any) {
  return { ok: true, json: () => Promise.resolve(data) };
}

describe("AppQuickActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUseAuth.mockReturnValue({
      ...mockAuthContext,
      user: mockUser,
      fetchWithAuth: mockFetchWithAuth,
      refreshUser: mockRefreshUser,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const defaultProps = {
    appSlug: "test-app",
    appName: "Test App",
    platform: "shopify",
    isTracked: false,
    isCompetitor: false,
  };

  it("renders children", () => {
    render(
      <AppQuickActions {...defaultProps}>
        <span>App Name</span>
      </AppQuickActions>
    );
    expect(screen.getByText("App Name")).toBeInTheDocument();
  });

  it("does not show popover on quick hover (< 800ms)", async () => {
    render(
      <AppQuickActions {...defaultProps}>
        <span>App Name</span>
      </AppQuickActions>
    );
    fireEvent.mouseEnter(screen.getByText("App Name"));
    act(() => { vi.advanceTimersByTime(500); });
    fireEvent.mouseLeave(screen.getByText("App Name"));
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.queryByText("Start tracking")).not.toBeInTheDocument();
  });

  it("shows popover after 800ms hover", async () => {
    render(
      <AppQuickActions {...defaultProps}>
        <span>App Name</span>
      </AppQuickActions>
    );
    fireEvent.mouseEnter(screen.getByText("App Name"));
    act(() => { vi.advanceTimersByTime(800); });
    expect(screen.getByText("Start tracking")).toBeInTheDocument();
    expect(screen.getByText("Mark as competitor")).toBeInTheDocument();
  });

  it("shows 'Already tracking' when isTracked is true", () => {
    render(
      <AppQuickActions {...defaultProps} isTracked={true}>
        <span>App Name</span>
      </AppQuickActions>
    );
    fireEvent.mouseEnter(screen.getByText("App Name"));
    act(() => { vi.advanceTimersByTime(800); });
    expect(screen.getByText("Already tracking")).toBeInTheDocument();
    expect(screen.queryByText("Start tracking")).not.toBeInTheDocument();
  });

  it("shows 'Already a competitor' when isCompetitor is true", () => {
    render(
      <AppQuickActions {...defaultProps} isCompetitor={true}>
        <span>App Name</span>
      </AppQuickActions>
    );
    fireEvent.mouseEnter(screen.getByText("App Name"));
    act(() => { vi.advanceTimersByTime(800); });
    expect(screen.getByText("Already a competitor")).toBeInTheDocument();
    expect(screen.queryByText("Mark as competitor")).not.toBeInTheDocument();
  });

  it("calls track API when 'Start tracking' is clicked", async () => {
    vi.useRealTimers();
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url.includes("/api/account/tracked-apps?platform=")) {
        return Promise.resolve(makeJsonResponse({ slug: "test-app" }));
      }
      return Promise.resolve(makeJsonResponse(null));
    });

    const onTrackChange = vi.fn();
    render(
      <AppQuickActions {...defaultProps} onTrackChange={onTrackChange}>
        <span>App Name</span>
      </AppQuickActions>
    );

    // Open popover by setting open state directly via prop interaction
    // We need real timers for the async click handler
    fireEvent.mouseEnter(screen.getByText("App Name"));
    await waitFor(() => {
      expect(screen.getByText("Start tracking")).toBeInTheDocument();
    }, { timeout: 1000 });

    fireEvent.click(screen.getByText("Start tracking"));
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/api/account/tracked-apps?platform=shopify",
        expect.objectContaining({ method: "POST" })
      );
    });
    expect(onTrackChange).toHaveBeenCalledWith(true);
    expect(mockRefreshUser).toHaveBeenCalled();
  });

  it("calls competitor API when 'Mark as competitor' is clicked", async () => {
    vi.useRealTimers();
    mockFetchWithAuth.mockImplementation((url: string) => {
      if (url === "/api/account/tracked-apps") {
        return Promise.resolve(
          makeJsonResponse([{ appSlug: "my-tracked-app", appName: "My Tracked" }])
        );
      }
      if (url.includes("/competitors")) {
        return Promise.resolve(makeJsonResponse({ success: true }));
      }
      return Promise.resolve(makeJsonResponse(null));
    });

    const onCompetitorChange = vi.fn();
    render(
      <AppQuickActions {...defaultProps} onCompetitorChange={onCompetitorChange}>
        <span>App Name</span>
      </AppQuickActions>
    );

    fireEvent.mouseEnter(screen.getByText("App Name"));
    await waitFor(() => {
      expect(screen.getByText("Mark as competitor")).toBeInTheDocument();
    }, { timeout: 1000 });

    fireEvent.click(screen.getByText("Mark as competitor"));
    await waitFor(() => {
      expect(mockFetchWithAuth).toHaveBeenCalledWith(
        "/api/account/tracked-apps/my-tracked-app/competitors",
        expect.objectContaining({ method: "POST" })
      );
    });
    expect(onCompetitorChange).toHaveBeenCalledWith(true);
    expect(mockRefreshUser).toHaveBeenCalled();
  });

  it("does not render popover for viewer users", () => {
    mockUseAuth.mockReturnValue({
      ...mockAuthContext,
      user: mockViewerUser,
      fetchWithAuth: mockFetchWithAuth,
      refreshUser: mockRefreshUser,
    });
    render(
      <AppQuickActions {...defaultProps}>
        <span>App Name</span>
      </AppQuickActions>
    );
    fireEvent.mouseEnter(screen.getByText("App Name"));
    act(() => { vi.advanceTimersByTime(800); });
    expect(screen.queryByText("Start tracking")).not.toBeInTheDocument();
  });

  it("dismisses popover on mouse leave", () => {
    render(
      <AppQuickActions {...defaultProps}>
        <span>App Name</span>
      </AppQuickActions>
    );
    fireEvent.mouseEnter(screen.getByText("App Name"));
    act(() => { vi.advanceTimersByTime(800); });
    expect(screen.getByText("Start tracking")).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByText("App Name"));
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.queryByText("Start tracking")).not.toBeInTheDocument();
  });
});
