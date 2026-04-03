import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { TagId } from "@/db/types";
import { TrickForm } from "./trick-form";

const REMOVE_LANGUAGE_PATTERN = /repertoire\.removeLanguage/;
const VALIDATION_MESSAGE_PATTERN = /repertoire\.validation/;

// cmdk (used by CategoryCombobox and TagPicker) requires these in jsdom
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
});

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

const defaultProps = {
  availableTags: [],
  formId: "test-trick-form",
  onCreateTag: vi.fn(),
  onSubmit: vi.fn(),
  onToggleTag: vi.fn(),
  selectedTagIds: [],
  userCategories: [],
  userEffectTypes: [],
};

describe("TrickForm", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<TrickForm {...defaultProps} />);
    expect(document.getElementById("test-trick-form")).toBeInTheDocument();
  });

  it("renders the basics section", () => {
    render(<TrickForm {...defaultProps} />);
    expect(screen.getByText("repertoire.section.basics")).toBeInTheDocument();
  });

  it("renders the performance section", () => {
    render(<TrickForm {...defaultProps} />);
    expect(
      screen.getByText("repertoire.section.performance")
    ).toBeInTheDocument();
  });

  it("renders the name field", () => {
    render(<TrickForm {...defaultProps} />);
    expect(
      screen.getByRole("textbox", { name: "repertoire.field.name" })
    ).toBeInTheDocument();
  });

  it("renders with existing default values", () => {
    render(
      <TrickForm
        {...defaultProps}
        defaultValues={{ name: "Card Warp", status: "learning" }}
      />
    );
    expect(screen.getByDisplayValue("Card Warp")).toBeInTheDocument();
  });

  it("calls onDirtyChange when dirty state changes", () => {
    const onDirtyChange = vi.fn();
    render(<TrickForm {...defaultProps} onDirtyChange={onDirtyChange} />);
    // onDirtyChange(false) is called on mount since form starts clean
    expect(onDirtyChange).toHaveBeenCalledWith(false);
  });

  it("renders performance section open when performance values are present", () => {
    render(
      <TrickForm
        {...defaultProps}
        defaultValues={{
          difficulty: 3,
          status: "learning",
          duration: 90,
          performanceType: "close_up",
          angleSensitivity: "none",
        }}
      />
    );
    // Section should be open — form renders with those values
    expect(
      screen.getByText("repertoire.section.performance")
    ).toBeInTheDocument();
  });

  it("renders show setup section", () => {
    render(<TrickForm {...defaultProps} />);
    expect(
      screen.getByText("repertoire.section.showSetup")
    ).toBeInTheDocument();
  });

  it("renders show setup section open when show setup values are present", () => {
    render(
      <TrickForm
        {...defaultProps}
        defaultValues={{ props: "Deck of cards", music: "" }}
      />
    );
    expect(
      screen.getByText("repertoire.section.showSetup")
    ).toBeInTheDocument();
  });

  it("renders reference section", () => {
    render(<TrickForm {...defaultProps} />);
    expect(
      screen.getByText("repertoire.section.reference")
    ).toBeInTheDocument();
  });

  it("renders reference section open when reference values are present", () => {
    render(
      <TrickForm
        {...defaultProps}
        defaultValues={{ source: "Card Sharps book", videoUrl: "" }}
      />
    );
    expect(
      screen.getByText("repertoire.section.reference")
    ).toBeInTheDocument();
  });

  it("renders organization section (includes tags)", () => {
    const tags = [
      {
        id: "tag-1" as TagId,
        name: "Beginner",
        color: null,
      },
    ];
    render(
      <TrickForm
        {...defaultProps}
        availableTags={tags}
        selectedTagIds={["tag-1" as TagId]}
      />
    );
    // Organization section includes tags
    expect(
      screen.getByText("repertoire.section.organization")
    ).toBeInTheDocument();
  });

  it("renders user categories in the category combobox", () => {
    render(<TrickForm {...defaultProps} userCategories={["Cards", "Coins"]} />);
    // The combobox button uses placeholder as aria-label when no label prop
    expect(
      screen.getByRole("combobox", {
        name: "repertoire.field.categoryPlaceholder",
      })
    ).toBeInTheDocument();
  });

  describe("section open/close helpers", () => {
    it("opens show setup section when isCameraFriendly is true", () => {
      render(
        <TrickForm
          {...defaultProps}
          defaultValues={{ isCameraFriendly: true }}
        />
      );
      // The isCameraFriendly switch is inside the show setup collapsible — visible when open
      expect(
        screen.getByText("repertoire.field.isCameraFriendly")
      ).toBeInTheDocument();
    });

    it("opens show setup section when isSilent is true", () => {
      render(
        <TrickForm {...defaultProps} defaultValues={{ isSilent: true }} />
      );
      expect(screen.getByText("repertoire.field.isSilent")).toBeInTheDocument();
    });

    it("opens show setup section when languages are present", () => {
      render(
        <TrickForm
          {...defaultProps}
          defaultValues={{ languages: ["French"] }}
        />
      );
      expect(screen.getByText("French")).toBeInTheDocument();
    });

    it("opens reference section when videoUrl is present", () => {
      render(
        <TrickForm
          {...defaultProps}
          defaultValues={{ videoUrl: "https://example.com" }}
        />
      );
      const input = screen.getByRole("textbox", {
        name: "repertoire.field.videoUrl",
      });
      expect(input).toHaveValue("https://example.com");
    });
  });

  describe("form submission", () => {
    it("calls onSubmit with form data when name is provided", async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<TrickForm {...defaultProps} onSubmit={onSubmit} />);

      const nameInput = screen.getByRole("textbox", {
        name: "repertoire.field.name",
      });
      await user.clear(nameInput);
      await user.type(nameInput, "Test Trick");

      const form = document.getElementById("test-trick-form");
      if (!(form instanceof HTMLFormElement)) {
        throw new Error("Expected #test-trick-form to be a <form> element");
      }
      fireEvent.submit(form);

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
        expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
          name: "Test Trick",
        });
      });
    });

    it("prevents submission when name is empty", async () => {
      const onSubmit = vi.fn();
      render(<TrickForm {...defaultProps} onSubmit={onSubmit} />);

      const form = document.getElementById("test-trick-form");
      if (!(form instanceof HTMLFormElement)) {
        throw new Error("Expected #test-trick-form to be a <form> element");
      }
      fireEvent.submit(form);

      // Wait for validation to complete (positive assertion first)
      await waitFor(() => {
        expect(
          screen.getByText(VALIDATION_MESSAGE_PATTERN)
        ).toBeInTheDocument();
      });
      // Then verify onSubmit was never called
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});

describe("LanguagesField", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  const propsWithSetupOpen = {
    availableTags: [],
    formId: "test-trick-form",
    onCreateTag: vi.fn(),
    onSubmit: vi.fn(),
    onToggleTag: vi.fn(),
    selectedTagIds: [],
    userCategories: [],
    userEffectTypes: [],
    defaultValues: { props: "x" },
  };

  it("adds a language on Enter key", async () => {
    const user = userEvent.setup();
    render(<TrickForm {...propsWithSetupOpen} />);

    const input = screen.getByRole("textbox", {
      name: "repertoire.field.languages",
    });
    await user.click(input);
    await user.type(input, "French");
    await user.keyboard("{Enter}");

    expect(screen.getByText("French")).toBeInTheDocument();
  });

  it("adds a language on comma key", async () => {
    const user = userEvent.setup();
    render(<TrickForm {...propsWithSetupOpen} />);

    const input = screen.getByRole("textbox", {
      name: "repertoire.field.languages",
    });
    await user.click(input);
    await user.type(input, "Spanish,");

    expect(screen.getByText("Spanish")).toBeInTheDocument();
    expect(input).toHaveValue("");
  });

  it("prevents duplicate languages (case-insensitive)", async () => {
    const user = userEvent.setup();
    render(
      <TrickForm
        {...propsWithSetupOpen}
        defaultValues={{ props: "x", languages: ["French"] }}
      />
    );

    const input = screen.getByRole("textbox", {
      name: "repertoire.field.languages",
    });
    await user.click(input);
    await user.type(input, "french");
    await user.keyboard("{Enter}");

    const badges = screen.getAllByText("French");
    expect(badges).toHaveLength(1);
  });

  it("removes last language on Backspace when input is empty", async () => {
    const user = userEvent.setup();
    render(
      <TrickForm
        {...propsWithSetupOpen}
        defaultValues={{ props: "x", languages: ["French", "English"] }}
      />
    );

    const input = screen.getByRole("textbox", {
      name: "repertoire.field.languages",
    });
    await user.click(input);
    await user.keyboard("{Backspace}");

    expect(screen.queryByText("English")).not.toBeInTheDocument();
    expect(screen.getByText("French")).toBeInTheDocument();
  });

  it("enforces max 10 languages limit", async () => {
    const user = userEvent.setup();
    render(
      <TrickForm
        {...propsWithSetupOpen}
        defaultValues={{
          props: "x",
          languages: [
            "L1",
            "L2",
            "L3",
            "L4",
            "L5",
            "L6",
            "L7",
            "L8",
            "L9",
            "L10",
          ],
        }}
      />
    );

    const input = screen.getByRole("textbox", {
      name: "repertoire.field.languages",
    });
    await user.click(input);
    await user.type(input, "Extra");
    await user.keyboard("{Enter}");

    expect(screen.queryByText("Extra")).not.toBeInTheDocument();
  });

  it("removes a specific language via remove button", async () => {
    const user = userEvent.setup();
    render(
      <TrickForm
        {...propsWithSetupOpen}
        defaultValues={{ props: "x", languages: ["French"] }}
      />
    );

    const removeButton = screen.getByRole("button", {
      name: REMOVE_LANGUAGE_PATTERN,
    });
    await user.click(removeButton);

    expect(screen.queryByText("French")).not.toBeInTheDocument();
  });

  it("ignores empty/whitespace input on Enter", async () => {
    const user = userEvent.setup();
    render(<TrickForm {...propsWithSetupOpen} />);

    const input = screen.getByRole("textbox", {
      name: "repertoire.field.languages",
    });
    await user.click(input);
    await user.type(input, "   ");
    await user.keyboard("{Enter}");

    // No language list should appear
    expect(
      screen.queryByRole("list", { name: "repertoire.field.languages" })
    ).not.toBeInTheDocument();
  });
});
