import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormSection } from "./form-section";

describe("FormSection", () => {
  it("renders the title", () => {
    render(<FormSection title="Advanced">content</FormSection>);
    expect(screen.getByText("Advanced")).toBeInTheDocument();
  });

  it("renders children content when defaultOpen is true", () => {
    render(
      <FormSection defaultOpen title="Details">
        Some inner content
      </FormSection>
    );
    expect(screen.getByText("Some inner content")).toBeInTheDocument();
  });

  it("renders without crashing with defaultOpen=false", () => {
    render(
      <FormSection defaultOpen={false} title="Closed Section">
        Hidden content
      </FormSection>
    );
    // Title always visible
    expect(screen.getByText("Closed Section")).toBeInTheDocument();
  });
});
