import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { STATUS_CONFIG, TRICK_STATUSES } from "../constants";
import { TrickStatusBadge } from "./trick-status-badge";

describe("TrickStatusBadge", () => {
  it.each(TRICK_STATUSES)("renders badge text for status: %s", (status) => {
    render(<TrickStatusBadge status={status} />);
    // The global next-intl mock from vitest.setup.ts returns "namespace.key"
    // The component calls t(config.label) where label is e.g. "status.new"
    // and the namespace is "repertoire", so the output is "repertoire.status.new"
    const expectedLabel = STATUS_CONFIG[status].label;
    expect(screen.getByText(`repertoire.${expectedLabel}`)).toBeInTheDocument();
  });

  it.each(
    TRICK_STATUSES
  )("applies the correct variant from STATUS_CONFIG for status: %s", (status) => {
    render(<TrickStatusBadge status={status} />);
    const expectedVariant = STATUS_CONFIG[status].variant;
    // Badge renders a <span> with data-slot="badge" and data-variant set to the variant value
    const badge = document.querySelector("[data-slot='badge']");
    expect(badge).not.toBeNull();
    expect(badge).toHaveAttribute("data-variant", expectedVariant);
  });

  it("renders exactly one badge element", () => {
    render(<TrickStatusBadge status="new" />);
    const badges = document.querySelectorAll("[data-slot='badge']");
    expect(badges).toHaveLength(1);
  });
});
