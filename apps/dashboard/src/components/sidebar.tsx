"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderTree,
  AppWindow,
  Search,
  Star,
  Puzzle,
  Settings,
  Shield,
  LogOut,
  User,
  Users,
  Bot,
  KeyRound,
  Package,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/categories", label: "Categories", icon: FolderTree },
  { href: "/apps", label: "Apps", icon: AppWindow },
  { href: "/keywords", label: "Keywords", icon: Search },
  { href: "/competitors", label: "Competitors", icon: Star },
  { href: "/features", label: "Features", icon: Puzzle },
  { href: "/settings", label: "Settings", icon: Settings },
];

const systemAdminItems = [
  { href: "/system-admin", label: "Overview", icon: Shield },
  { href: "/system-admin/accounts", label: "Accounts", icon: Users },
  { href: "/system-admin/users", label: "Users", icon: User },
  { href: "/system-admin/apps", label: "Apps", icon: AppWindow },
  { href: "/system-admin/keywords", label: "Keywords", icon: KeyRound },
  { href: "/system-admin/features", label: "Features", icon: Puzzle },
  { href: "/system-admin/packages", label: "Packages", icon: Package },
  { href: "/system-admin/scraper", label: "Scraper", icon: Bot },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, account, logout } = useAuth();
  const isSystemAdmin = user?.isSystemAdmin;
  const isAdminSection = pathname.startsWith("/system-admin");

  return (
    <aside className="w-60 border-r bg-muted/30 min-h-screen p-4 flex flex-col">
      <div className="font-semibold text-lg mb-6 px-3">Shopify Tracker</div>
      <nav className="flex flex-col gap-1 flex-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
        {isSystemAdmin && (
          <>
            <div className="border-t my-2" />
            <Link
              href="/system-admin"
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isAdminSection
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Shield className="h-4 w-4" />
              System Admin
              {isAdminSection ? (
                <ChevronDown className="h-3.5 w-3.5 ml-auto" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 ml-auto" />
              )}
            </Link>
            {isAdminSection &&
              systemAdminItems.map((item) => {
                const isActive =
                  item.href === "/system-admin"
                    ? pathname === "/system-admin"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 pl-7 pr-3 py-1.5 rounded-md text-sm transition-colors ${
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                );
              })}
          </>
        )}
      </nav>
      {user && (
        <div className="border-t pt-3 mt-3">
          <div className="flex items-center gap-2 px-3 py-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user.name}</div>
              <div className="text-xs text-muted-foreground truncate">
                {account?.name} &middot; {user.role}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors w-full"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}
