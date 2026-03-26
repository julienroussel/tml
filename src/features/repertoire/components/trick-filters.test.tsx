import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TrickFilters } from "./trick-filters";

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

const defaultProps = {
  categories: ["Cards", "Coins"],
  category: null,
  onCategoryChange: vi.fn(),
  onSearchChange: vi.fn(),
  onSortChange: vi.fn(),
  onStatusChange: vi.fn(),
  search: "",
  sort: "newest",
  status: null,
};

describe("TrickFilters", () => {
  it("renders without crashing", () => {
    render(<TrickFilters {...defaultProps} />);
    expect(
      screen.getByRole("searchbox", { name: "repertoire.searchPlaceholder" })
    ).toBeInTheDocument();
  });

  it("renders the search input with the current value", () => {
    render(<TrickFilters {...defaultProps} search="silk" />);
    const input = screen.getByRole("searchbox", {
      name: "repertoire.searchPlaceholder",
    });
    expect(input).toHaveValue("silk");
  });

  it("calls onSearchChange when typing in the search input", async () => {
    const onSearchChange = vi.fn();
    render(<TrickFilters {...defaultProps} onSearchChange={onSearchChange} />);
    const input = screen.getByRole("searchbox", {
      name: "repertoire.searchPlaceholder",
    });
    await userEvent.type(input, "card");
    expect(onSearchChange).toHaveBeenCalled();
  });

  it("calls onStatusChange with null when 'all' sentinel is selected", async () => {
    const onStatusChange = vi.fn();
    render(<TrickFilters {...defaultProps} onStatusChange={onStatusChange} />);
    const selects = screen.getAllByRole("combobox");
    // First select is the status select
    await userEvent.selectOptions(selects[0] as HTMLElement, "__all__");
    expect(onStatusChange).toHaveBeenCalledWith(null);
  });

  it("calls onStatusChange with the status value when a real status is selected", async () => {
    const onStatusChange = vi.fn();
    render(<TrickFilters {...defaultProps} onStatusChange={onStatusChange} />);
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[0] as HTMLElement, "learning");
    expect(onStatusChange).toHaveBeenCalledWith("learning");
  });

  it("calls onCategoryChange with null when 'all' sentinel is selected", async () => {
    const onCategoryChange = vi.fn();
    render(
      <TrickFilters {...defaultProps} onCategoryChange={onCategoryChange} />
    );
    const selects = screen.getAllByRole("combobox");
    // Second select is the category select
    await userEvent.selectOptions(selects[1] as HTMLElement, "__all__");
    expect(onCategoryChange).toHaveBeenCalledWith(null);
  });

  it("calls onCategoryChange with the category value when a real category is selected", async () => {
    const onCategoryChange = vi.fn();
    render(
      <TrickFilters {...defaultProps} onCategoryChange={onCategoryChange} />
    );
    const selects = screen.getAllByRole("combobox");
    await userEvent.selectOptions(selects[1] as HTMLElement, "Cards");
    expect(onCategoryChange).toHaveBeenCalledWith("Cards");
  });

  it("calls onSortChange when sort is changed", async () => {
    const onSortChange = vi.fn();
    render(<TrickFilters {...defaultProps} onSortChange={onSortChange} />);
    const selects = screen.getAllByRole("combobox");
    // Third select is the sort select
    await userEvent.selectOptions(selects[2] as HTMLElement, "name-asc");
    expect(onSortChange).toHaveBeenCalledWith("name-asc");
  });

  it("renders category options from the categories prop", () => {
    render(<TrickFilters {...defaultProps} categories={["Cards", "Coins"]} />);
    expect(screen.getByRole("option", { name: "Cards" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Coins" })).toBeInTheDocument();
  });
});
