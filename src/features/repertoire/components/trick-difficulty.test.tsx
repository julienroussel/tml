import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TrickDifficulty } from "./trick-difficulty";

describe("TrickDifficulty", () => {
  it("renders in read-only mode without radiogroup role", () => {
    render(<TrickDifficulty value={3} />);
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("renders in interactive mode with radiogroup role when onChange is provided", () => {
    render(<TrickDifficulty onChange={vi.fn()} value={3} />);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });

  it("renders 5 stars", () => {
    render(<TrickDifficulty onChange={vi.fn()} value={3} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
  });

  it("shows correct checked state for filled stars", () => {
    render(<TrickDifficulty onChange={vi.fn()} value={3} />);
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toHaveAttribute("aria-checked", "true");
    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    expect(radios[2]).toHaveAttribute("aria-checked", "true");
    expect(radios[3]).toHaveAttribute("aria-checked", "false");
    expect(radios[4]).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange with null when clicking the current value (toggle off)", async () => {
    const onChange = vi.fn();
    render(<TrickDifficulty onChange={onChange} value={2} />);
    const radios = screen.getAllByRole("radio");
    await userEvent.click(radios[1] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("calls onChange with the new star value when clicking a different star", async () => {
    const onChange = vi.fn();
    render(<TrickDifficulty onChange={onChange} value={2} />);
    const radios = screen.getAllByRole("radio");
    await userEvent.click(radios[4] as HTMLElement);
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("does not call onChange in read-only mode", () => {
    const onChange = vi.fn();
    render(<TrickDifficulty readOnly value={3} />);
    // No radio buttons in read-only mode
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders with null value without crashing", () => {
    render(<TrickDifficulty onChange={vi.fn()} value={null} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(5);
    for (const radio of radios) {
      expect(radio).toHaveAttribute("aria-checked", "false");
    }
  });

  it("renders small size without crashing", () => {
    render(<TrickDifficulty size="sm" value={2} />);
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("handles ArrowRight key to increase difficulty", async () => {
    const onChange = vi.fn();
    render(<TrickDifficulty onChange={onChange} value={2} />);
    const radios = screen.getAllByRole("radio");
    await userEvent.type(radios[1] as HTMLElement, "{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("handles Delete key to clear difficulty", async () => {
    const onChange = vi.fn();
    render(<TrickDifficulty onChange={onChange} value={3} />);
    const radios = screen.getAllByRole("radio");
    await userEvent.type(radios[2] as HTMLElement, "{Delete}");
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
