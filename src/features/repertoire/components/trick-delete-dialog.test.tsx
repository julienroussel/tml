import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TrickDeleteDialog } from "./trick-delete-dialog";

describe("TrickDeleteDialog", () => {
  it("shows the trick name in the title when open", () => {
    render(
      <TrickDeleteDialog
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open={true}
        trickName="Card Warp"
      />
    );
    // The global mock renders interpolated values as "namespace.key:{\"name\":\"Card Warp\"}"
    // vitest.setup.ts uses: `${key}:${JSON.stringify(params)}` — but looking at the actual
    // setup mock: (key, values?) => `${fullKey} (${parts.join(", ")})` where parts are "k: v"
    // So t("deleteConfirmTitle", { name: "Card Warp" }) → "repertoire.deleteConfirmTitle (name: Card Warp)"
    expect(
      screen.getByText("repertoire.deleteConfirmTitle (name: Card Warp)")
    ).toBeInTheDocument();
  });

  it("shows the description when open", () => {
    render(
      <TrickDeleteDialog
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open={true}
        trickName="Card Warp"
      />
    );
    expect(
      screen.getByText("repertoire.deleteConfirmDescription")
    ).toBeInTheDocument();
  });

  it("uses empty string for trickName when null", () => {
    render(
      <TrickDeleteDialog
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open={true}
        trickName={null}
      />
    );
    // trickName ?? "" → "" so no interpolation suffix rendered
    expect(
      screen.getByText("repertoire.deleteConfirmTitle (name: )")
    ).toBeInTheDocument();
  });

  it("does not render dialog content when closed", () => {
    render(
      <TrickDeleteDialog
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open={false}
        trickName="Card Warp"
      />
    );
    expect(
      screen.queryByText("repertoire.deleteConfirmDescription")
    ).not.toBeInTheDocument();
  });

  it("calls onConfirm when the delete button is clicked", async () => {
    const onConfirm = vi.fn();
    render(
      <TrickDeleteDialog
        onConfirm={onConfirm}
        onOpenChange={vi.fn()}
        open={true}
        trickName="Card Warp"
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "repertoire.deleteConfirm" })
    );

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onOpenChange with false when cancel button is clicked", async () => {
    const onOpenChange = vi.fn();
    render(
      <TrickDeleteDialog
        onConfirm={vi.fn()}
        onOpenChange={onOpenChange}
        open={true}
        trickName="Card Warp"
      />
    );

    await userEvent.click(
      screen.getByRole("button", { name: "repertoire.cancel" })
    );

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("renders cancel and delete buttons when open", () => {
    render(
      <TrickDeleteDialog
        onConfirm={vi.fn()}
        onOpenChange={vi.fn()}
        open={true}
        trickName="Some Trick"
      />
    );
    expect(
      screen.getByRole("button", { name: "repertoire.cancel" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "repertoire.deleteConfirm" })
    ).toBeInTheDocument();
  });
});
