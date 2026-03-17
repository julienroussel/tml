import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme } from "next-themes";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "./theme-toggle";

vi.mock("next-themes", () => ({
  useTheme: vi.fn(),
}));

const mockSetTheme = vi.fn();

describe("ThemeToggle", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders a button after mount", () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: "light",
      setTheme: mockSetTheme,
      themes: ["light", "dark"],
    });
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
  });

  it("shows translated aria-label", () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: "light",
      setTheme: mockSetTheme,
      themes: ["light", "dark"],
    });
    render(<ThemeToggle />);
    const button = screen.getByRole("button", {
      name: "common.toggleTheme",
    });
    expect(button).toBeInTheDocument();
  });

  it("renders Moon icon in light mode", () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: "light",
      setTheme: mockSetTheme,
      themes: ["light", "dark"],
    });
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: "common.toggleTheme" });
    expect(button).toBeInTheDocument();
    // Lucide Moon renders with class "lucide-moon", distinguishing it from Sun
    const svg = button.querySelector("svg.lucide-moon");
    expect(svg).toBeInTheDocument();
    // Decorative icon should be hidden from the accessible tree
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("renders Sun icon in dark mode", () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: "dark",
      setTheme: mockSetTheme,
      themes: ["light", "dark"],
    });
    render(<ThemeToggle />);
    const button = screen.getByRole("button", {
      name: "common.toggleTheme",
    });
    expect(button).toBeInTheDocument();
    // Lucide Sun renders with class "lucide-sun", distinguishing it from Moon
    const svg = button.querySelector("svg.lucide-sun");
    expect(svg).toBeInTheDocument();
    // Decorative icon should be hidden from the accessible tree
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it('calls setTheme("dark") when clicking in light mode', async () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: "light",
      setTheme: mockSetTheme,
      themes: ["light", "dark"],
    });
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    await userEvent.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it('calls setTheme("light") when clicking in dark mode', async () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: "dark",
      setTheme: mockSetTheme,
      themes: ["light", "dark"],
    });
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    await userEvent.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });

  it("renders placeholder before mount when resolvedTheme is undefined", () => {
    vi.mocked(useTheme).mockReturnValue({
      resolvedTheme: undefined,
      setTheme: mockSetTheme,
      themes: ["light", "dark"],
    });

    render(<ThemeToggle />);

    // After mount, the button should still render (mounted state becomes true via useEffect).
    // With resolvedTheme undefined, the toggle treats it as light mode (fallback branch).
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "common.toggleTheme");

    // Should render Moon icon (light/undefined theme fallback)
    const svg = button.querySelector("svg.lucide-moon");
    expect(svg).toBeInTheDocument();
  });
});
