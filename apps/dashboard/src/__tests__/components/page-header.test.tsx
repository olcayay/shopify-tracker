import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Settings } from "lucide-react";

describe("PageHeader", () => {
  it("renders title", () => {
    render(<PageHeader title="My Page" />);
    expect(screen.getByText("My Page")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("My Page");
  });

  it("renders description when provided", () => {
    render(<PageHeader title="Title" description="Some description" />);
    expect(screen.getByText("Some description")).toBeInTheDocument();
  });

  it("does not render description when not provided", () => {
    const { container } = render(<PageHeader title="Title" />);
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  it("renders icon when provided", () => {
    const { container } = render(<PageHeader title="Settings" icon={Settings} />);
    const iconWrapper = container.querySelector(".bg-primary\\/10");
    expect(iconWrapper).toBeInTheDocument();
  });

  it("renders breadcrumbs with links", () => {
    render(
      <PageHeader
        title="User List"
        breadcrumbs={[
          { label: "System Admin", href: "/system-admin" },
          { label: "Users" },
        ]}
      />,
    );
    const link = screen.getByText("System Admin");
    expect(link.closest("a")).toHaveAttribute("href", "/system-admin");
    // Last breadcrumb is current page (no link)
    expect(screen.getByText("Users").closest("a")).toBeNull();
  });

  it("renders actions slot", () => {
    render(
      <PageHeader
        title="Title"
        actions={<button data-testid="action-btn">Action</button>}
      />,
    );
    expect(screen.getByTestId("action-btn")).toBeInTheDocument();
  });

  it("renders full combination", () => {
    render(
      <PageHeader
        title="Dashboard"
        description="Overview of your data"
        icon={Settings}
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Overview" },
        ]}
        actions={<span>Refresh</span>}
      />,
    );
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Overview of your data")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Refresh")).toBeInTheDocument();
  });
});
