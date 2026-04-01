import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  combineToSeconds,
  DurationInput,
  splitSeconds,
} from "./duration-input";

describe("splitSeconds", () => {
  it("returns empty strings for null", () => {
    expect(splitSeconds(null)).toEqual({ minutes: "", seconds: "" });
  });

  it("returns empty strings for negative", () => {
    expect(splitSeconds(-1)).toEqual({ minutes: "", seconds: "" });
  });

  it("returns empty strings for zero", () => {
    expect(splitSeconds(0)).toEqual({ minutes: "", seconds: "" });
  });

  it("splits 90 into 1m 30s", () => {
    expect(splitSeconds(90)).toEqual({ minutes: "1", seconds: "30" });
  });

  it("splits 60 into 1m 0s", () => {
    expect(splitSeconds(60)).toEqual({ minutes: "1", seconds: "0" });
  });

  it("splits 30 into 0m 30s (no minutes shown)", () => {
    expect(splitSeconds(30)).toEqual({ minutes: "", seconds: "30" });
  });
});

describe("combineToSeconds", () => {
  it("returns null for empty strings", () => {
    expect(combineToSeconds("", "")).toBeNull();
  });

  it("returns null for NaN minutes", () => {
    expect(combineToSeconds("abc", "30")).toBeNull();
  });

  it("returns null for NaN seconds", () => {
    expect(combineToSeconds("1", "abc")).toBeNull();
  });

  it("combines 1m 30s into 90", () => {
    expect(combineToSeconds("1", "30")).toBe(90);
  });

  it("combines empty minutes with 30s", () => {
    expect(combineToSeconds("", "30")).toBe(30);
  });

  it("combines 2m with empty seconds", () => {
    expect(combineToSeconds("2", "")).toBe(120);
  });
});

describe("DurationInput component", () => {
  it("renders without crashing with null value", () => {
    render(<DurationInput onChange={vi.fn()} value={null} />);
    expect(
      screen.getByRole("spinbutton", {
        name: "repertoire.field.durationMinutes",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", {
        name: "repertoire.field.durationSeconds",
      })
    ).toBeInTheDocument();
  });

  it("renders with an initial value split into minutes and seconds", () => {
    render(<DurationInput onChange={vi.fn()} value={90} />);
    const minutesInput = screen.getByRole("spinbutton", {
      name: "repertoire.field.durationMinutes",
    });
    const secondsInput = screen.getByRole("spinbutton", {
      name: "repertoire.field.durationSeconds",
    });
    expect(minutesInput).toHaveValue(1);
    expect(secondsInput).toHaveValue(30);
  });

  it("calls onChange after minutes input blurs", async () => {
    const onChange = vi.fn();
    render(<DurationInput onChange={onChange} value={null} />);
    const minutesInput = screen.getByRole("spinbutton", {
      name: "repertoire.field.durationMinutes",
    });
    await userEvent.clear(minutesInput);
    await userEvent.type(minutesInput, "2");
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(120);
  });

  it("calls onChange after seconds input blurs", async () => {
    const onChange = vi.fn();
    render(<DurationInput onChange={onChange} value={null} />);
    const secondsInput = screen.getByRole("spinbutton", {
      name: "repertoire.field.durationSeconds",
    });
    await userEvent.clear(secondsInput);
    await userEvent.type(secondsInput, "45");
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(45);
  });

  it("clamps seconds to 59 on blur", async () => {
    const onChange = vi.fn();
    render(<DurationInput onChange={onChange} value={null} />);
    const secondsInput = screen.getByRole("spinbutton", {
      name: "repertoire.field.durationSeconds",
    });
    await userEvent.clear(secondsInput);
    await userEvent.type(secondsInput, "90");
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(59);
  });

  it("clamps minutes to 120 on blur", async () => {
    const onChange = vi.fn();
    render(<DurationInput onChange={onChange} value={null} />);
    const minutesInput = screen.getByRole("spinbutton", {
      name: "repertoire.field.durationMinutes",
    });
    await userEvent.clear(minutesInput);
    await userEvent.type(minutesInput, "999");
    await userEvent.tab();
    expect(onChange).toHaveBeenCalledWith(120 * 60);
  });
});
