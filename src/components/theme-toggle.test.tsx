import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useTheme } from "next-themes";
import { afterEach, describe, expect, it, type Mock, vi } from "vitest";
import { ThemeToggle } from "./theme-toggle";

vi.mock("next-themes", () => ({
  useTheme: vi.fn(),
}));

const mockSetTheme = vi.fn();

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ThemeToggle", () => {
  it("renders a button after mount", () => {
    (useTheme as Mock).mockReturnValue({
      resolvedTheme: "light",
      setTheme: mockSetTheme,
    });
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    expect(button).toBeDefined();
  });

  it('shows aria-label "Switch to dark mode" when light theme', () => {
    (useTheme as Mock).mockReturnValue({
      resolvedTheme: "light",
      setTheme: mockSetTheme,
    });
    render(<ThemeToggle />);
    const button = screen.getByRole("button", {
      name: "Switch to dark mode",
    });
    expect(button).toBeDefined();
  });

  it('shows aria-label "Switch to light mode" when dark theme', () => {
    (useTheme as Mock).mockReturnValue({
      resolvedTheme: "dark",
      setTheme: mockSetTheme,
    });
    render(<ThemeToggle />);
    const button = screen.getByRole("button", {
      name: "Switch to light mode",
    });
    expect(button).toBeDefined();
  });

  it('calls setTheme("dark") when clicking in light mode', () => {
    (useTheme as Mock).mockReturnValue({
      resolvedTheme: "light",
      setTheme: mockSetTheme,
    });
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it('calls setTheme("light") when clicking in dark mode', () => {
    (useTheme as Mock).mockReturnValue({
      resolvedTheme: "dark",
      setTheme: mockSetTheme,
    });
    render(<ThemeToggle />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(mockSetTheme).toHaveBeenCalledWith("light");
  });
});
