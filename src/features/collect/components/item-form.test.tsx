import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  hasDetailsValues,
  hasPurchaseValues,
  hasReferenceValues,
  ItemForm,
} from "./item-form";

const VALIDATION_MESSAGE_PATTERN = /collect\.validation/;

// cmdk (used by CategoryCombobox) requires these in jsdom
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
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.scrollTo) {
    Element.prototype.scrollTo = () => undefined;
  }
});

const defaultProps = {
  availableTags: [],
  availableTricks: [],
  formId: "test-item-form",
  onCreateTag: vi.fn(),
  onSubmit: vi.fn(),
  onToggleTag: vi.fn(),
  onToggleTrick: vi.fn(),
  selectedTagIds: [],
  selectedTrickIds: [],
  userBrands: [],
  userLocations: [],
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("hasDetailsValues", () => {
  it("returns false for undefined input", () => {
    expect(hasDetailsValues(undefined)).toBe(false);
  });

  it("returns false when all detail fields are empty/default", () => {
    expect(
      hasDetailsValues({
        brand: "",
        creator: "",
        condition: null,
        location: "",
        quantity: 1,
      })
    ).toBe(false);
  });

  it("returns true when brand is non-empty", () => {
    expect(hasDetailsValues({ brand: "Bicycle" })).toBe(true);
  });

  it("returns true when creator is non-empty", () => {
    expect(hasDetailsValues({ creator: "Tamariz" })).toBe(true);
  });

  it("returns true when condition is set", () => {
    expect(hasDetailsValues({ condition: "good" })).toBe(true);
  });

  it("returns true when location is non-empty", () => {
    expect(hasDetailsValues({ location: "Stage case" })).toBe(true);
  });

  it("returns true when quantity differs from default of 1", () => {
    expect(hasDetailsValues({ quantity: 5 })).toBe(true);
    expect(hasDetailsValues({ quantity: 0 })).toBe(true);
  });
});

describe("hasPurchaseValues", () => {
  it("returns false for undefined input", () => {
    expect(hasPurchaseValues(undefined)).toBe(false);
  });

  it("returns false when both purchase fields are empty", () => {
    expect(hasPurchaseValues({ purchaseDate: "", purchasePrice: "" })).toBe(
      false
    );
  });

  it("returns true when purchaseDate is set", () => {
    expect(hasPurchaseValues({ purchaseDate: "2024-01-15" })).toBe(true);
  });

  it("returns true when purchasePrice is set", () => {
    expect(hasPurchaseValues({ purchasePrice: "29.99" })).toBe(true);
  });
});

describe("hasReferenceValues", () => {
  it("returns false for undefined input", () => {
    expect(hasReferenceValues(undefined)).toBe(false);
  });

  it("returns false when url is empty", () => {
    expect(hasReferenceValues({ url: "" })).toBe(false);
  });

  it("returns true when url is set", () => {
    expect(hasReferenceValues({ url: "https://example.com" })).toBe(true);
  });
});

describe("ItemForm", () => {
  it("renders without crashing", () => {
    render(<ItemForm {...defaultProps} />);
    expect(document.getElementById("test-item-form")).toBeInTheDocument();
  });

  it("renders the essentials section", () => {
    render(<ItemForm {...defaultProps} />);
    expect(screen.getByText("collect.section.essentials")).toBeInTheDocument();
  });

  it("renders the name field", () => {
    render(<ItemForm {...defaultProps} />);
    expect(
      screen.getByRole("textbox", { name: "collect.field.name" })
    ).toBeInTheDocument();
  });

  describe("creatorLabel swap", () => {
    it("uses 'Author' label when type is 'book'", () => {
      render(
        <ItemForm
          {...defaultProps}
          defaultValues={{ type: "book", creator: "x" }}
        />
      );
      expect(
        screen.getByText("collect.field.creatorLabelBook")
      ).toBeInTheDocument();
      expect(
        screen.queryByText("collect.field.creatorLabelDefault")
      ).not.toBeInTheDocument();
    });

    it("uses 'Creator' label for non-book types", () => {
      render(
        <ItemForm
          {...defaultProps}
          defaultValues={{ type: "prop", creator: "x" }}
        />
      );
      expect(
        screen.getByText("collect.field.creatorLabelDefault")
      ).toBeInTheDocument();
      expect(
        screen.queryByText("collect.field.creatorLabelBook")
      ).not.toBeInTheDocument();
    });

    it("uses 'Creator' label for type 'gimmick'", () => {
      render(
        <ItemForm
          {...defaultProps}
          defaultValues={{ type: "gimmick", creator: "x" }}
        />
      );
      expect(
        screen.getByText("collect.field.creatorLabelDefault")
      ).toBeInTheDocument();
    });
  });

  describe("quantity NaN guard", () => {
    it("does not propagate NaN when the quantity input is cleared", async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();

      render(
        <ItemForm
          {...defaultProps}
          defaultValues={{ name: "Item", type: "prop", quantity: 5 }}
          onSubmit={onSubmit}
        />
      );

      const quantityInput = screen.getByRole("spinbutton", {
        name: "collect.field.quantity",
      });

      // Clear the input — valueAsNumber becomes NaN
      await user.clear(quantityInput);

      // The displayed value should fall back (the field value should never become NaN)
      const form = document.getElementById("test-item-form");
      if (!(form instanceof HTMLFormElement)) {
        throw new Error("Expected form element");
      }
      fireEvent.submit(form);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });
      const submittedQuantity = onSubmit.mock.calls[0]?.[0]?.quantity;
      expect(Number.isNaN(submittedQuantity)).toBe(false);
    });
  });

  describe("NONE condition sentinel", () => {
    it("preserves null condition for items without condition set", async () => {
      const onSubmit = vi.fn();
      render(
        <ItemForm
          {...defaultProps}
          defaultValues={{ name: "Item", type: "prop", condition: null }}
          onSubmit={onSubmit}
        />
      );

      const form = document.getElementById("test-item-form");
      if (!(form instanceof HTMLFormElement)) {
        throw new Error("Expected form element");
      }
      fireEvent.submit(form);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });
      // condition should be null (sentinel never reaches the form values)
      expect(onSubmit.mock.calls[0]?.[0]?.condition).toBeNull();
    });

    it("preserves a non-null condition through to onSubmit unchanged", async () => {
      const onSubmit = vi.fn();
      render(
        <ItemForm
          {...defaultProps}
          defaultValues={{ name: "Item", type: "prop", condition: "good" }}
          onSubmit={onSubmit}
        />
      );

      const form = document.getElementById("test-item-form");
      if (!(form instanceof HTMLFormElement)) {
        throw new Error("Expected form element");
      }
      fireEvent.submit(form);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });
      expect(onSubmit.mock.calls[0]?.[0]?.condition).toBe("good");
    });
  });

  describe("section auto-expand", () => {
    it("opens details section when defaultValues contain non-default detail values", () => {
      render(
        <ItemForm {...defaultProps} defaultValues={{ brand: "Bicycle" }} />
      );
      // The brand field is inside the details collapsible — visible only when open
      expect(
        screen.getByRole("combobox", {
          name: "collect.field.brandPlaceholder",
        })
      ).toBeInTheDocument();
    });

    it("opens purchase section when defaultValues contain purchase values", () => {
      render(
        <ItemForm
          {...defaultProps}
          defaultValues={{ purchaseDate: "2024-06-01" }}
        />
      );
      expect(screen.getByDisplayValue("2024-06-01")).toBeInTheDocument();
    });

    it("opens reference section when defaultValues contain a url", () => {
      render(
        <ItemForm
          {...defaultProps}
          defaultValues={{ url: "https://example.com/item" }}
        />
      );
      expect(
        screen.getByDisplayValue("https://example.com/item")
      ).toBeInTheDocument();
    });
  });

  describe("isDirty → onDirtyChange", () => {
    it("calls onDirtyChange(false) on mount when form is clean", () => {
      const onDirtyChange = vi.fn();
      render(<ItemForm {...defaultProps} onDirtyChange={onDirtyChange} />);
      expect(onDirtyChange).toHaveBeenCalledWith(false);
    });

    it("calls onDirtyChange(true) when a field changes", async () => {
      const onDirtyChange = vi.fn();
      const user = userEvent.setup();

      render(<ItemForm {...defaultProps} onDirtyChange={onDirtyChange} />);

      const nameInput = screen.getByRole("textbox", {
        name: "collect.field.name",
      });
      await user.type(nameInput, "X");

      await waitFor(() => {
        expect(onDirtyChange).toHaveBeenCalledWith(true);
      });
    });
  });

  describe("FormMessage Zod-key translation", () => {
    it("translates a 'validation.*' message via the collect namespace", async () => {
      render(<ItemForm {...defaultProps} />);

      const form = document.getElementById("test-item-form");
      if (!(form instanceof HTMLFormElement)) {
        throw new Error("Expected form element");
      }
      // Submit empty — name is required, will produce "validation.nameRequired"
      fireEvent.submit(form);

      // The translated message should be rendered with the namespace prefix
      // (per the global next-intl mock that returns "namespace.key").
      await waitFor(() => {
        expect(
          screen.getByText(VALIDATION_MESSAGE_PATTERN)
        ).toBeInTheDocument();
      });
    });
  });
});
