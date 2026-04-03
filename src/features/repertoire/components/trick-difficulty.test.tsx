import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TrickDifficulty } from "./trick-difficulty";

describe("TrickDifficulty", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

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
    const target = radios[1];
    if (!(target instanceof HTMLElement)) {
      throw new Error("Expected at least 2 radio elements");
    }
    await userEvent.click(target);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("calls onChange with the new star value when clicking a different star", async () => {
    const onChange = vi.fn();
    render(<TrickDifficulty onChange={onChange} value={2} />);
    const radios = screen.getAllByRole("radio");
    const target = radios[4];
    if (!(target instanceof HTMLElement)) {
      throw new Error("Expected at least 5 radio elements");
    }
    await userEvent.click(target);
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
    const target = radios[1];
    if (!(target instanceof HTMLElement)) {
      throw new Error("Expected at least 2 radio elements");
    }
    await userEvent.type(target, "{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("handles Delete key to clear difficulty", async () => {
    const onChange = vi.fn();
    render(<TrickDifficulty onChange={onChange} value={3} />);
    const radios = screen.getAllByRole("radio");
    const target = radios[2];
    if (!(target instanceof HTMLElement)) {
      throw new Error("Expected at least 3 radio elements");
    }
    await userEvent.type(target, "{Delete}");
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("handles ArrowLeft key to decrease difficulty", async () => {
    const onChange = vi.fn();
    render(<TrickDifficulty onChange={onChange} value={3} />);
    const radios = screen.getAllByRole("radio");
    const target = radios[2];
    if (!(target instanceof HTMLElement)) {
      throw new Error("Expected at least 3 radio elements");
    }
    await userEvent.type(target, "{ArrowLeft}");
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("handles ArrowDown key to decrease difficulty", async () => {
    const onChange = vi.fn();
    render(<TrickDifficulty onChange={onChange} value={3} />);
    const radios = screen.getAllByRole("radio");
    const target = radios[2];
    if (!(target instanceof HTMLElement)) {
      throw new Error("Expected at least 3 radio elements");
    }
    await userEvent.type(target, "{ArrowDown}");
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it("ArrowLeft from value 1 clears to null", async () => {
    const onChange = vi.fn();
    render(<TrickDifficulty onChange={onChange} value={1} />);
    const radios = screen.getAllByRole("radio");
    const target = radios[0];
    if (!(target instanceof HTMLElement)) {
      throw new Error("Expected at least 1 radio element");
    }
    await userEvent.type(target, "{ArrowLeft}");
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it("ArrowLeft with no selection selects difficulty 1", async () => {
    const onChange = vi.fn();
    render(<TrickDifficulty onChange={onChange} value={null} />);
    const radios = screen.getAllByRole("radio");
    const target = radios[0];
    if (!(target instanceof HTMLElement)) {
      throw new Error("Expected at least 1 radio element");
    }
    await userEvent.type(target, "{ArrowLeft}");
    expect(onChange).toHaveBeenCalledWith(1);
  });
});
