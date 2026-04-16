import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TrickId } from "@/db/types";

const trickId = (id: string) => id as TrickId;
const REMOVE_LABEL_PATTERN = /trickPicker\.remove/;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (params) {
      return Object.entries(params).reduce(
        (str, [k, v]) => str.replace(`{${k}}`, String(v)),
        key
      );
    }
    return key;
  },
}));

// Minimal mocks for shadcn/ui — render children directly
vi.mock("@/components/ui/badge", () => ({
  Badge: ({
    children,
    ...props
  }: { children: React.ReactNode } & Record<string, unknown>) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: {
    children: React.ReactNode;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/popover", () => ({
  Popover: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverTrigger: ({
    children,
  }: {
    children: React.ReactNode;
    asChild?: boolean;
  }) => <div data-testid="popover-trigger">{children}</div>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/components/ui/command", () => ({
  Command: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CommandEmpty: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CommandGroup: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  CommandInput: (props: Record<string, unknown>) => (
    <input data-testid="command-input" {...props} />
  ),
  CommandItem: ({
    children,
    onSelect,
    disabled,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
    disabled?: boolean;
  }) => (
    <button
      data-testid="command-item"
      disabled={disabled}
      onClick={onSelect}
      type="button"
    >
      {children}
    </button>
  ),
  CommandList: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(" "),
}));

// Suppress lucide-react icons
vi.mock("lucide-react", () => ({
  CheckIcon: () => null,
  SearchIcon: () => null,
  XIcon: () => null,
}));

describe("TrickPicker", () => {
  async function getComponent() {
    const { TrickPicker } = await import("./trick-picker");
    return TrickPicker;
  }

  const tricks = [
    { id: trickId("t1"), name: "Ambitious Card" },
    { id: trickId("t2"), name: "Triumph" },
    { id: trickId("t3"), name: "Invisible Deck" },
  ];

  /** Find the CommandItem button containing the given trick name. */
  function getItemByName(name: string): HTMLElement {
    const items = screen.getAllByTestId("command-item");
    const match = items.find((el) => el.textContent?.includes(name));
    if (!match) {
      throw new Error(`No CommandItem button for trick "${name}"`);
    }
    return match;
  }

  it("calls onToggleTrick when selecting an unselected trick", async () => {
    const TrickPicker = await getComponent();
    const onToggle = vi.fn();

    render(
      <TrickPicker
        availableTricks={tricks}
        onToggleTrick={onToggle}
        selectedTrickIds={[]}
      />
    );

    fireEvent.click(getItemByName("Ambitious Card"));

    expect(onToggle).toHaveBeenCalledWith(trickId("t1"));
  });

  it("calls onToggleTrick when deselecting a selected trick", async () => {
    const TrickPicker = await getComponent();
    const onToggle = vi.fn();

    render(
      <TrickPicker
        availableTricks={tricks}
        onToggleTrick={onToggle}
        selectedTrickIds={[trickId("t1")]}
      />
    );

    fireEvent.click(getItemByName("Ambitious Card"));

    expect(onToggle).toHaveBeenCalledWith(trickId("t1"));
  });

  it("does NOT call onToggleTrick when at max limit for unselected trick", async () => {
    const TrickPicker = await getComponent();
    const onToggle = vi.fn();

    render(
      <TrickPicker
        availableTricks={tricks}
        maxTricks={2}
        onToggleTrick={onToggle}
        selectedTrickIds={[trickId("t1"), trickId("t2")]}
      />
    );

    // Try clicking the third trick (not selected, but at limit)
    fireEvent.click(getItemByName("Invisible Deck"));

    expect(onToggle).not.toHaveBeenCalled();
  });

  it("disables CommandItems for unselected tricks when at the maxTricks limit", async () => {
    const TrickPicker = await getComponent();
    const onToggle = vi.fn();

    render(
      <TrickPicker
        availableTricks={tricks}
        maxTricks={2}
        onToggleTrick={onToggle}
        selectedTrickIds={[trickId("t1"), trickId("t2")]}
      />
    );

    // The unselected one (Invisible Deck) is disabled at the limit
    expect(getItemByName("Invisible Deck")).toBeDisabled();
    // Selected items remain enabled so users can deselect
    expect(getItemByName("Ambitious Card")).not.toBeDisabled();
    expect(getItemByName("Triumph")).not.toBeDisabled();
  });

  it("still allows deselecting when at max limit", async () => {
    const TrickPicker = await getComponent();
    const onToggle = vi.fn();

    render(
      <TrickPicker
        availableTricks={tricks}
        maxTricks={2}
        onToggleTrick={onToggle}
        selectedTrickIds={[trickId("t1"), trickId("t2")]}
      />
    );

    // Click a selected trick — should still allow deselection
    fireEvent.click(getItemByName("Ambitious Card"));

    expect(onToggle).toHaveBeenCalledWith(trickId("t1"));
  });

  it("renders selected tricks as removable badges", async () => {
    const TrickPicker = await getComponent();
    const onToggle = vi.fn();

    render(
      <TrickPicker
        availableTricks={tricks}
        onToggleTrick={onToggle}
        selectedTrickIds={[trickId("t1")]}
      />
    );

    // The aria-label includes the trick name via the {name} placeholder
    const removeButton = screen.getByLabelText(REMOVE_LABEL_PATTERN);
    expect(removeButton).toBeInTheDocument();
  });

  it("renders CommandEmpty content when availableTricks is empty", async () => {
    const TrickPicker = await getComponent();
    const onToggle = vi.fn();

    render(
      <TrickPicker
        availableTricks={[]}
        onToggleTrick={onToggle}
        selectedTrickIds={[]}
      />
    );

    expect(screen.getByText("trickPicker.noResults")).toBeInTheDocument();
  });

  it("treats maxTricks={undefined} as unbounded — no item is disabled", async () => {
    const TrickPicker = await getComponent();
    const onToggle = vi.fn();

    render(
      <TrickPicker
        availableTricks={tricks}
        onToggleTrick={onToggle}
        selectedTrickIds={[trickId("t1"), trickId("t2"), trickId("t3")]}
      />
    );

    // Even with all selected, none are disabled because no maxTricks
    expect(getItemByName("Ambitious Card")).not.toBeDisabled();
    expect(getItemByName("Triumph")).not.toBeDisabled();
    expect(getItemByName("Invisible Deck")).not.toBeDisabled();
  });
});
