import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ITEM_CONDITIONS, ITEM_SORTS, ITEM_TYPES } from "../constants";
import { ItemFilters, type ItemFiltersProps } from "./item-filters";

// Mock Radix Select to expose onValueChange as a testable native select
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    onValueChange,
    value,
  }: {
    children: React.ReactNode;
    onValueChange?: (value: string) => void;
    value?: string;
  }) => (
    <div>
      <select
        data-select-value={value}
        onChange={(e) => onValueChange?.(e.target.value)}
        value={value}
      >
        {children}
      </select>
    </div>
  ),
  SelectTrigger: ({
    children,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    "aria-label"?: string;
  }) => <fieldset aria-label={ariaLabel}>{children}</fieldset>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => <option value={value}>{children}</option>,
}));

function defaultProps(
  overrides: Partial<ItemFiltersProps> = {}
): ItemFiltersProps {
  return {
    condition: null,
    onConditionChange: vi.fn(),
    onSearchChange: vi.fn(),
    onSortChange: vi.fn(),
    onTypeChange: vi.fn(),
    search: "",
    sort: "newest",
    type: null,
    ...overrides,
  };
}

describe("ItemFilters", () => {
  it("type select defaults to the __all__ sentinel when type prop is null", () => {
    render(<ItemFilters {...defaultProps({ type: null })} />);
    const selects = screen.getAllByRole("combobox");
    expect(selects[0]).toHaveValue("__all__");
  });

  it("calls onTypeChange with null when __all__ is selected", async () => {
    const onTypeChange = vi.fn();
    render(<ItemFilters {...defaultProps({ type: "prop", onTypeChange })} />);
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0] as HTMLElement, "__all__");
    expect(onTypeChange).toHaveBeenCalledWith(null);
    expect(onTypeChange).not.toHaveBeenCalledWith("__all__");
  });

  it("calls onTypeChange with the typed value when a real type is selected", async () => {
    const onTypeChange = vi.fn();
    render(<ItemFilters {...defaultProps({ onTypeChange })} />);
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0] as HTMLElement, "book");
    expect(onTypeChange).toHaveBeenCalledWith("book");
  });

  it("calls onConditionChange with null when __all__ is selected", async () => {
    const onConditionChange = vi.fn();
    render(
      <ItemFilters {...defaultProps({ condition: "new", onConditionChange })} />
    );
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[1] as HTMLElement, "__all__");
    expect(onConditionChange).toHaveBeenCalledWith(null);
    expect(onConditionChange).not.toHaveBeenCalledWith("__all__");
  });

  it("calls onConditionChange with the typed value when a real condition is selected", async () => {
    const onConditionChange = vi.fn();
    render(<ItemFilters {...defaultProps({ onConditionChange })} />);
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[1] as HTMLElement, "good");
    expect(onConditionChange).toHaveBeenCalledWith("good");
  });

  it("renders a SelectItem for every ITEM_TYPES value", () => {
    render(<ItemFilters {...defaultProps()} />);
    for (const itemType of ITEM_TYPES) {
      expect(
        screen.getByRole("option", { name: `collect.type.${itemType}` })
      ).toBeInTheDocument();
    }
  });

  it("renders a SelectItem for every ITEM_CONDITIONS value", () => {
    render(<ItemFilters {...defaultProps()} />);
    for (const cond of ITEM_CONDITIONS) {
      expect(
        screen.getByRole("option", { name: `collect.condition.${cond}` })
      ).toBeInTheDocument();
    }
  });

  it("renders sort SelectItems whose values match ITEM_SORTS exactly", () => {
    render(<ItemFilters {...defaultProps()} />);
    const selects = screen.getAllByRole("combobox");
    const sortSelect = selects[2] as HTMLSelectElement;
    const sortValues = Array.from(sortSelect.options).map(
      (option) => option.value
    );
    expect(sortValues).toEqual([...ITEM_SORTS]);
  });

  it("calls onSearchChange with the raw string value (no internal debounce)", async () => {
    const onSearchChange = vi.fn();
    render(<ItemFilters {...defaultProps({ onSearchChange })} />);
    const input = screen.getByRole("searchbox", {
      name: "collect.searchPlaceholder",
    });
    await userEvent.type(input, "a");
    // Single keystroke fires exactly one call with the raw string — no debounce at this layer.
    expect(onSearchChange).toHaveBeenCalledTimes(1);
    expect(onSearchChange).toHaveBeenCalledWith("a");
  });
});
