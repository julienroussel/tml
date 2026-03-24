import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuthLayout from "./layout";

const providersPropsSpy = vi.fn();
vi.mock("@/components/providers", () => ({
  Providers: (props: Record<string, unknown>) => {
    providersPropsSpy(props);
    return <>{props.children}</>;
  },
}));

describe("AuthLayout", () => {
  it("renders children", async () => {
    render(await AuthLayout({ children: <div>auth content</div> }));

    expect(screen.getByText("auth content")).toBeInTheDocument();
  });

  it("renders skip-to-content link", async () => {
    render(await AuthLayout({ children: <div>content</div> }));

    const skipLink = screen.getByText("common.skipToContent");
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute("href", "#main-content");
  });

  it("does not wrap children in a main element (auth pages provide their own)", async () => {
    render(
      await AuthLayout({
        children: <main id="main-content">content</main>,
      })
    );

    // Should only be one main element (from the child, not the layout)
    const mains = screen.getAllByRole("main");
    expect(mains).toHaveLength(1);
  });

  it("passes defaultLocale and messages to Providers", async () => {
    providersPropsSpy.mockClear();
    render(await AuthLayout({ children: <div>content</div> }));

    expect(providersPropsSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        locale: "en",
        messages: expect.any(Object),
      })
    );
  });
});
