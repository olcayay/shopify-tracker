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

/** Fire pointer + mouse enter events (Radix HoverCard uses onPointerEnter) */
function hoverEnter(el: HTMLElement) {
  fireEvent.pointerEnter(el);
  fireEvent.mouseEnter(el);
}

/** Fire pointer + mouse leave events */
function hoverLeave(el: HTMLElement) {
  fireEvent.pointerLeave(el);
  fireEvent.mouseLeave(el);
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

  it("does not show hover card on quick hover (< 800ms)", async () => {
    render(
      <AppQuickActions {...defaultProps}>
        <span>App Name</span>
      </AppQuickActions>
    );
    hoverEnter(screen.getByText("App Name").closest("[data-radix-hover-card-trigger]") || screen.getByText("App Name"));
    act(() => { vi.advanceTimersByTime(500); });
    hoverLeave(screen.getByText("App Name").closest("[data-radix-hover-card-trigger]") || screen.getByText("App Name"));
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.queryByText("Start tracking")).not.toBeInTheDocument();
  });

  it("shows hover card after 800ms hover", async () => {
    render(
      <AppQuickActions {...defaultProps}>
        <span>App Name</span>
      </AppQuickActions>
    );
    const trigger = screen.getByText("App Name").closest("[data-radix-hover-card-trigger]") || screen.getByText("App Name");
    hoverEnter(trigger);
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
    const trigger = screen.getByText("App Name").closest("[data-radix-hover-card-trigger]") || screen.getByText("App Name");
    hoverEnter(trigger);
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
    const trigger = screen.getByText("App Name").closest("[data-radix-hover-card-trigger]") || screen.getByText("App Name");
    hoverEnter(trigger);
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

    const trigger = screen.getByText("App Name").closest("[data-radix-hover-card-trigger]") || screen.getByText("App Name");
    hoverEnter(trigger);
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

    const trigger = screen.getByText("App Name").closest("[data-radix-hover-card-trigger]") || screen.getByText("App Name");
    hoverEnter(trigger);
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

  it("does not render hover card for viewer users", () => {
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
    // Viewer users get no HoverCard wrapper, just plain children
    expect(screen.getByText("App Name")).toBeInTheDocument();
    // No trigger attribute since HoverCard isn't rendered
    expect(screen.getByText("App Name").closest("[data-radix-hover-card-trigger]")).toBeNull();
  });

  it("dismisses hover card on pointer leave", () => {
    render(
      <AppQuickActions {...defaultProps}>
        <span>App Name</span>
      </AppQuickActions>
    );
    const trigger = screen.getByText("App Name").closest("[data-radix-hover-card-trigger]") || screen.getByText("App Name");
    hoverEnter(trigger);
    act(() => { vi.advanceTimersByTime(800); });
    expect(screen.getByText("Start tracking")).toBeInTheDocument();

    hoverLeave(trigger);
    act(() => { vi.advanceTimersByTime(300); });
    expect(screen.queryByText("Start tracking")).not.toBeInTheDocument();
  });

  it("trigger wrapper has inline-flex display for proper positioning in table cells", () => {
    render(
      <AppQuickActions {...defaultProps}>
        <span>App Name</span>
      </AppQuickActions>
    );
    // The trigger div wraps children with inline-flex for proper bounding rect measurement
    const triggerDiv = screen.getByText("App Name").parentElement;
    expect(triggerDiv).not.toBeNull();
    expect(triggerDiv!.classList.contains("inline-flex")).toBe(true);
  });
});
