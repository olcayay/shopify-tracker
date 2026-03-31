import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FormField } from "@/components/ui/form-field";

describe("FormField", () => {
  it("renders label and children", () => {
    render(
      <FormField label="Email">
        <input data-testid="input" />
      </FormField>,
    );
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByTestId("input")).toBeInTheDocument();
  });

  it("shows required indicator when required is true", () => {
    render(
      <FormField label="Name" required>
        <input />
      </FormField>,
    );
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("does not show required indicator by default", () => {
    render(
      <FormField label="Name">
        <input />
      </FormField>,
    );
    expect(screen.queryByText("*")).toBeNull();
  });

  it("shows error message when error is provided", () => {
    render(
      <FormField label="Email" error="Invalid email">
        <input />
      </FormField>,
    );
    expect(screen.getByText("Invalid email")).toBeInTheDocument();
  });

  it("shows description when no error", () => {
    render(
      <FormField label="Password" description="Must be 8+ characters">
        <input />
      </FormField>,
    );
    expect(screen.getByText("Must be 8+ characters")).toBeInTheDocument();
  });

  it("hides description when error is shown", () => {
    render(
      <FormField label="Password" description="Must be 8+ characters" error="Too short">
        <input />
      </FormField>,
    );
    expect(screen.queryByText("Must be 8+ characters")).toBeNull();
    expect(screen.getByText("Too short")).toBeInTheDocument();
  });

  it("passes htmlFor to label", () => {
    const { container } = render(
      <FormField label="Email" htmlFor="email-input">
        <input id="email-input" />
      </FormField>,
    );
    const label = container.querySelector("label");
    expect(label).toHaveAttribute("for", "email-input");
  });

  it("applies custom className", () => {
    const { container } = render(
      <FormField label="Name" className="md:col-span-2">
        <input />
      </FormField>,
    );
    const wrapper = container.firstElementChild;
    expect(wrapper?.className).toContain("md:col-span-2");
  });
});
