import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CategoryCombobox } from "./category-combobox";

// cmdk uses ResizeObserver and scrollIntoView internally when the popover opens
beforeAll(() => {
  if (!("ResizeObserver" in globalThis)) {
    globalThis.ResizeObserver = class ResizeObserver {
      observe(): void {
        // noop
      }
      unobserve(): void {
        // noop
      }
      disconnect(): void {
        // noop
      }
    };
  }
  // jsdom doesn't implement scrollIntoView
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
});

const defaultProps = {
  onChange: vi.fn(),
  suggestions: ["Cards", "Coins", "Mentalism"],
  userValues: [],
  value: "",
};

describe("CategoryCombobox", () => {
  it("renders without crashing", () => {
    render(<CategoryCombobox {...defaultProps} />);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows the placeholder when value is empty", () => {
    render(
      <CategoryCombobox {...defaultProps} placeholder="Pick a category" />
    );
    expect(screen.getByText("Pick a category")).toBeInTheDocument();
  });

  it("shows the current value when set", () => {
    render(<CategoryCombobox {...defaultProps} value="Cards" />);
    expect(screen.getByText("Cards")).toBeInTheDocument();
  });

  it("shows a clear button when a value is selected", () => {
    render(<CategoryCombobox {...defaultProps} value="Cards" />);
    expect(
      screen.getByRole("button", {
        name: "repertoire.combobox.clearSelection",
      })
    ).toBeInTheDocument();
  });

  it("does not show clear button when value is empty", () => {
    render(<CategoryCombobox {...defaultProps} value="" />);
    expect(
      screen.queryByRole("button", {
        name: "repertoire.combobox.clearSelection",
      })
    ).not.toBeInTheDocument();
  });

  it("calls onChange with empty string when clear button is clicked", async () => {
    const onChange = vi.fn();
    render(
      <CategoryCombobox {...defaultProps} onChange={onChange} value="Cards" />
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "repertoire.combobox.clearSelection",
      })
    );
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("shows suggestions when combobox is opened", async () => {
    render(<CategoryCombobox {...defaultProps} />);
    await userEvent.click(screen.getByRole("combobox"));
    expect(screen.getByText("Cards")).toBeInTheDocument();
    expect(screen.getByText("Coins")).toBeInTheDocument();
    expect(screen.getByText("Mentalism")).toBeInTheDocument();
  });

  it("merges suggestions and userValues deduped", async () => {
    render(
      <CategoryCombobox
        {...defaultProps}
        suggestions={["Cards"]}
        userValues={["Cards", "Rope"]}
      />
    );
    await userEvent.click(screen.getByRole("combobox"));
    // Cards should appear only once
    expect(screen.getAllByText("Cards")).toHaveLength(1);
    expect(screen.getByText("Rope")).toBeInTheDocument();
  });

  it("renders with a custom label", () => {
    render(<CategoryCombobox {...defaultProps} label="Category" />);
    expect(
      screen.getByRole("combobox", { name: "Category" })
    ).toBeInTheDocument();
  });
});
