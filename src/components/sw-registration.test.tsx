import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ServiceWorkerRegistration } from "./sw-registration";

describe("ServiceWorkerRegistration", () => {
  let registerMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    registerMock = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders nothing", () => {
    vi.stubGlobal("navigator", {
      serviceWorker: { register: registerMock },
    });
    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
    const { container } = render(<ServiceWorkerRegistration />);
    expect(container.innerHTML).toBe("");
  });

  it("does not register SW when navigator.serviceWorker is not available", () => {
    const nav = { ...navigator };
    // biome-ignore lint/performance/noDelete: need to remove property for test
    delete (nav as Record<string, unknown>).serviceWorker;
    vi.stubGlobal("navigator", nav);

    render(<ServiceWorkerRegistration />);

    expect(registerMock).not.toHaveBeenCalled();
  });

  it("registers SW with correct options when document is already loaded", () => {
    vi.stubGlobal("navigator", {
      serviceWorker: { register: registerMock },
    });
    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");

    render(<ServiceWorkerRegistration />);

    expect(registerMock).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  });

  it("defers registration to load event when document is not yet complete", () => {
    vi.stubGlobal("navigator", {
      serviceWorker: { register: registerMock },
    });
    vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
    const addEventListenerSpy = vi.spyOn(window, "addEventListener");

    render(<ServiceWorkerRegistration />);

    expect(registerMock).not.toHaveBeenCalled();
    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "load",
      expect.any(Function),
      { once: true }
    );

    // Simulate load event firing
    const loadHandler = addEventListenerSpy.mock.calls.find(
      (call) => call[0] === "load"
    )?.[1] as () => void;
    loadHandler();

    expect(registerMock).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  });

  it("logs error when registration fails", async () => {
    const error = new Error("SW failed");
    registerMock.mockRejectedValue(error);
    vi.stubGlobal("navigator", {
      serviceWorker: { register: registerMock },
    });
    vi.spyOn(document, "readyState", "get").mockReturnValue("complete");
    // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during tests
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<ServiceWorkerRegistration />);

    // Wait for the rejected promise to be caught
    await vi.waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "Service worker registration failed:",
        error
      );
    });
  });
});
