import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ItemDeleteDialog } from "./item-delete-dialog";

describe("ItemDeleteDialog", () => {
  it("renders the title with the item name when open", () => {
    render(
      <ItemDeleteDialog
        itemName="Invisible Deck"
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open={true}
      />
    );
    // The next-intl mock formats interpolated values as "key (param: value)".
    expect(
      screen.getByText("collect.deleteConfirmTitle (name: Invisible Deck)")
    ).toBeInTheDocument();
  });

  it("renders the description when open", () => {
    render(
      <ItemDeleteDialog
        itemName="Invisible Deck"
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open={true}
      />
    );
    expect(
      screen.getByText("collect.deleteConfirmDescription")
    ).toBeInTheDocument();
  });

  it("falls back to an empty name when itemName is null without crashing", () => {
    // Exercises the `itemName ?? ""` guard — passing null directly to
    // next-intl's t() with a `{name}` placeholder would otherwise throw.
    render(
      <ItemDeleteDialog
        itemName={null}
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open={true}
      />
    );
    expect(
      screen.getByText("collect.deleteConfirmTitle (name: )")
    ).toBeInTheDocument();
  });

  it("does not render dialog content when closed", () => {
    render(
      <ItemDeleteDialog
        itemName="Invisible Deck"
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open={false}
      />
    );
    expect(
      screen.queryByText("collect.deleteConfirmDescription")
    ).not.toBeInTheDocument();
  });

  it("calls onConfirm when the destructive action button is clicked", async () => {
    const onConfirm = vi.fn();
    render(
      <ItemDeleteDialog
        itemName="Invisible Deck"
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
        open={true}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "collect.deleteConfirm" })
    );

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onOpenChange with false when the cancel button is clicked", async () => {
    const onOpenChange = vi.fn();
    render(
      <ItemDeleteDialog
        itemName="Invisible Deck"
        onConfirm={vi.fn()}
        onOpenChange={onOpenChange}
        open={true}
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "collect.cancel" })
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
