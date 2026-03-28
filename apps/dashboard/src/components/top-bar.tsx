"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Settings,
  LogOut,
  User,
  Plus,
  ChevronDown,
  Check,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { PLATFORM_DISPLAY } from "@/lib/platform-display";
import { PLATFORMS, PLATFORM_IDS, type PlatformId } from "@appranks/shared";
import { extractPlatform, extractSection, isOnPlatformPage } from "@/lib/nav-utils";

export function TopBar({
  onOpenDiscovery,
  trackedCount,
}: {
  onOpenDiscovery?: () => void;
  trackedCount?: number | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, account, logout, impersonation, globalPlatformVisibility } = useAuth();
  const enabledPlatforms = (account?.enabledPlatforms ?? []) as PlatformId[];
  const isSystemAdmin = user?.isSystemAdmin;

  const activePlatform = extractPlatform(pathname);
  const currentSection = extractSection(pathname);
  const isPlatformPage = isOnPlatformPage(pathname) && (enabledPlatforms.includes(activePlatform) || !!isSystemAdmin);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const platformList = (isSystemAdmin ? PLATFORM_IDS : enabledPlatforms).filter(
    (pid) => pid in PLATFORMS
  );

  function switchPlatform(pid: PlatformId) {
    setDropdownOpen(false);
    // Preserve current section when switching platforms
    const section = currentSection;
    router.push(section ? `/${pid}/${section}` : `/${pid}`);
  }

  const display = isPlatformPage ? PLATFORM_DISPLAY[activePlatform] : null;

  return (
    <header className="h-14 border-b bg-background flex items-center px-4 gap-3 shrink-0">
      {/* Logo */}
      <Link
        href="/overview"
        className="font-semibold text-lg hover:text-primary transition-colors shrink-0"
      >
        AppRanks
      </Link>

      {/* Platform Dropdown */}
      {platformList.length > 0 && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-muted transition-colors"
          >
            {display && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: display.color }}
              />
            )}
            <span className="max-w-[140px] truncate">
              {isPlatformPage ? display?.label ?? "Select" : "Select Platform"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>

          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-popover border rounded-lg shadow-lg z-50 py-1">
              {platformList.map((pid) => {
                const d = PLATFORM_DISPLAY[pid];
                const isActive = activePlatform === pid && isPlatformPage;
                const isGloballyHidden = isSystemAdmin && globalPlatformVisibility && globalPlatformVisibility[pid] === false;
                return (
                  <button
                    key={pid}
                    onClick={() => switchPlatform(pid)}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "bg-muted font-medium"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="truncate">{d.label}</span>
                    {isGloballyHidden && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 ml-auto">
                        Hidden
                      </span>
                    )}
                    {isActive && (
                      <Check className="h-3.5 w-3.5 ml-auto text-primary shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Platform */}
      <button
        onClick={onOpenDiscovery}
        className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="Add platform"
      >
        <Plus className="h-4 w-4" />
      </button>

      {/* N/11 platforms badge */}
      <button
        onClick={onOpenDiscovery}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
      >
        {trackedCount != null ? trackedCount : "–"}/{enabledPlatforms.length} platforms tracked
      </button>

      {/* Breadcrumb (only on platform pages) */}
      {isPlatformPage && currentSection && (
        <div className="hidden md:flex items-center gap-1.5 text-sm text-muted-foreground ml-1">
          <span className="text-muted-foreground/50">/</span>
          <span className="capitalize">{currentSection}</span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings */}
      <Link
        href="/settings"
        className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${
          pathname.startsWith("/settings")
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        title="Settings"
      >
        <Settings className="h-4 w-4" />
      </Link>

      {/* User Menu */}
      {user && (
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="h-8 w-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title={user.name}
          >
            <User className="h-4 w-4" />
          </button>

          {userMenuOpen && (
            <div className="absolute top-full right-0 mt-1 w-56 bg-popover border rounded-lg shadow-lg z-50 py-1">
              <div className="px-3 py-2 border-b">
                <div className="text-sm font-medium truncate">{user.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {account?.name} &middot; {user.role}
                </div>
                {impersonation?.isImpersonating && (
                  <div className="text-xs text-amber-600 mt-1">
                    Viewing as {impersonation.targetUser?.name}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setUserMenuOpen(false);
                  logout();
                }}
                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
