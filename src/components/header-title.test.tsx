import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { describe, expect, it, vi } from "vitest";
import { HeaderTitle } from "./header-title";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

describe("HeaderTitle", () => {
  it("renders 'Dashboard' for /dashboard", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard");
    render(<HeaderTitle />);
    expect(screen.getByText("nav.dashboard")).toBeInTheDocument();
  });

  it("renders 'Settings' for /settings", () => {
    vi.mocked(usePathname).mockReturnValue("/settings");
    render(<HeaderTitle />);
    expect(screen.getByText("nav.settings")).toBeInTheDocument();
  });

  it("renders module label for /improve", () => {
    vi.mocked(usePathname).mockReturnValue("/improve");
    render(<HeaderTitle />);
    expect(screen.getByText("nav.improve")).toBeInTheDocument();
  });

  it("renders nothing for unknown route", () => {
    vi.mocked(usePathname).mockReturnValue("/unknown");
    const { container } = render(<HeaderTitle />);
    expect(container).toBeEmptyDOMElement();
  });

  it("uses first segment for sub-routes", () => {
    vi.mocked(usePathname).mockReturnValue("/improve/details");
    render(<HeaderTitle />);
    expect(screen.getByText("nav.improve")).toBeInTheDocument();
  });
});
