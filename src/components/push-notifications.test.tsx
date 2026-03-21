import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions", () => ({
  subscribeUser: vi.fn().mockResolvedValue({ success: true } as const),
  unsubscribeUser: vi.fn().mockResolvedValue({ success: true } as const),
  sendNotification: vi.fn().mockResolvedValue({ success: true } as const),
}));

import { PushNotifications, urlBase64ToUint8Array } from "./push-notifications";

describe("urlBase64ToUint8Array", () => {
  it("converts a standard base64url string", () => {
    // "SGVsbG8" is base64url for "Hello"
    const result = urlBase64ToUint8Array("SGVsbG8");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(result)).toBe("Hello");
  });

  it("handles base64url character replacement (- to +, _ to /)", () => {
    // "a-b_cw" in base64url becomes "a+b/cw==" in standard base64,
    // which decodes to the bytes [0x6B, 0xE6, 0xFF, 0x73].
    const result = urlBase64ToUint8Array("a-b_cw");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result)).toEqual([0x6b, 0xe6, 0xff, 0x73]);
  });

  it("adds correct padding for strings needing 1 pad char", () => {
    // 3 chars needs 1 "=" padding (3 % 4 = 3, so (4-3)%4 = 1)
    const result = urlBase64ToUint8Array("YWI");
    expect(new TextDecoder().decode(result)).toBe("ab");
  });

  it("adds correct padding for strings needing 2 pad chars", () => {
    // 2 chars needs 2 "=" padding (2 % 4 = 2, so (4-2)%4 = 2)
    const result = urlBase64ToUint8Array("YQ");
    expect(new TextDecoder().decode(result)).toBe("a");
  });

  it("handles strings that need no padding", () => {
    // 4 chars needs 0 padding (4 % 4 = 0, so (4-0)%4 = 0)
    const result = urlBase64ToUint8Array("YWJj");
    expect(new TextDecoder().decode(result)).toBe("abc");
  });

  it("handles empty string", () => {
    const result = urlBase64ToUint8Array("");
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(0);
  });
});

describe("PushNotifications", () => {
  // jsdom does not implement window.matchMedia; stub it so InstallPrompt
  // (which calls it unconditionally in its useEffect) does not throw.
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation(
        (query: string): MediaQueryList => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn().mockReturnValue(false),
        })
      ),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Remove any own-property stubs added during the test so that
    // "serviceWorker" in navigator and "PushManager" in window return false
    // again (jsdom does not define either natively).
    //
    // Using Object.defineProperty with value:undefined would keep the key
    // present and "in" checks would still return true — we need actual removal.
    if (Object.getOwnPropertyDescriptor(navigator, "serviceWorker")) {
      Reflect.deleteProperty(navigator, "serviceWorker");
    }
    if (Object.getOwnPropertyDescriptor(window, "PushManager")) {
      Reflect.deleteProperty(window, "PushManager");
    }
    if (Object.getOwnPropertyDescriptor(window, "matchMedia")) {
      Reflect.deleteProperty(window, "matchMedia");
    }
  });

  const makeMockSubscription = (
    overrides: { unsubscribe?: () => Promise<boolean> } = {}
  ): PushSubscription =>
    // PushSubscription has many required members (e.g. expirationTime, options,
    // getKey) that are irrelevant to these tests. The double cast via `unknown`
    // is necessary to satisfy TypeScript while keeping the mock minimal. If the
    // component starts using additional PushSubscription members, add them here.
    ({
      endpoint: "https://example.com",
      unsubscribe:
        overrides.unsubscribe ??
        vi.fn<() => Promise<boolean>>().mockResolvedValue(true),
      toJSON: () => ({
        endpoint: "https://example.com",
        keys: { p256dh: "key", auth: "auth" },
      }),
    }) as unknown as PushSubscription;

  const stubPushAPIs = (subscription: PushSubscription | null = null) => {
    const mockSubscribe = vi.fn().mockResolvedValue(subscription);
    const mockRegister = vi.fn().mockResolvedValue({
      pushManager: {
        getSubscription: vi.fn().mockResolvedValue(subscription),
      },
    });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: mockRegister,
        ready: Promise.resolve({
          pushManager: { subscribe: mockSubscribe },
        }),
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "PushManager", {
      value: class PushManager {},
      writable: true,
      configurable: true,
    });
    return { mockSubscribe, mockRegister };
  };

  it("shows not supported message when PushManager is absent", async () => {
    // Neither serviceWorker nor PushManager is defined in jsdom by default.
    // The afterEach cleanup ensures any prior stubs are removed, so this test
    // runs with both absent without needing extra setup.
    render(<PushNotifications />);

    expect(
      await screen.findByText("pushNotifications.notSupported")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "pushNotifications.enable" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "pushNotifications.disable" })
    ).not.toBeInTheDocument();
  });

  it("shows not supported message when serviceWorker is absent from navigator", async () => {
    // PushManager is present but serviceWorker is deliberately absent —
    // the component requires both, so it should still show the unsupported message.
    Object.defineProperty(window, "PushManager", {
      value: class PushManager {},
      writable: true,
      configurable: true,
    });
    // serviceWorker is not defined in jsdom; confirm it stays absent by not adding it.

    render(<PushNotifications />);

    expect(
      await screen.findByText("pushNotifications.notSupported")
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "pushNotifications.enable" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "pushNotifications.disable" })
    ).not.toBeInTheDocument();
  });

  it("shows subscribed state UI with Disable Notifications, message input, and Send button", async () => {
    const mockSubscription = makeMockSubscription();
    const { mockRegister } = stubPushAPIs(mockSubscription);

    render(<PushNotifications />);

    expect(
      await screen.findByRole("button", { name: "pushNotifications.disable" })
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("pushNotifications.messageAriaLabel")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "pushNotifications.sendAriaLabel" })
    ).toBeInTheDocument();
    expect(mockRegister).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
  });

  it("unsubscribes when Disable Notifications is clicked", async () => {
    const { unsubscribeUser } = await import("@/app/actions");
    const user = userEvent.setup();
    const mockUnsubscribe = vi.fn().mockResolvedValue(true);
    const mockSubscription = makeMockSubscription({
      unsubscribe: mockUnsubscribe,
    });
    stubPushAPIs(mockSubscription);

    render(<PushNotifications />);

    const disableButton = await screen.findByRole("button", {
      name: "pushNotifications.disable",
    });
    await user.click(disableButton);

    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(vi.mocked(unsubscribeUser)).toHaveBeenCalledWith(
      "https://example.com"
    );
    expect(
      await screen.findByRole("button", { name: "pushNotifications.enable" })
    ).toBeInTheDocument();
  });

  it("shows Enable Notifications button when supported but not subscribed", async () => {
    stubPushAPIs(null);

    render(<PushNotifications />);

    // After the useEffect runs, isSupported becomes true and subscription
    // resolves to null, so the Enable Notifications button should appear.
    const button = await screen.findByRole("button", {
      name: "pushNotifications.enable",
    });
    expect(button).toBeInTheDocument();
  });

  it("calls subscribeUser and transitions to subscribed state when Enable Notifications is clicked", async () => {
    const { subscribeUser } = await import("@/app/actions");
    const user = userEvent.setup();
    const mockNewSubscription = makeMockSubscription();
    const { mockSubscribe } = stubPushAPIs(null);
    mockSubscribe.mockResolvedValue(mockNewSubscription);

    render(<PushNotifications />);

    const enableButton = await screen.findByRole("button", {
      name: "pushNotifications.enable",
    });
    await user.click(enableButton);

    expect(vi.mocked(subscribeUser)).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: "https://example.com",
        keys: expect.objectContaining({ p256dh: "key", auth: "auth" }),
      })
    );
    expect(
      await screen.findByRole("button", { name: "pushNotifications.disable" })
    ).toBeInTheDocument();
  });

  it("remains in unsubscribed state when subscribeUser server action fails", async () => {
    const { subscribeUser } = await import("@/app/actions");
    vi.mocked(subscribeUser).mockResolvedValueOnce({
      success: false,
      error: "Server error",
    });
    const user = userEvent.setup();
    const mockNewSubscription = makeMockSubscription();
    const { mockSubscribe } = stubPushAPIs(null);
    mockSubscribe.mockResolvedValue(mockNewSubscription);

    render(<PushNotifications />);

    const enableButton = await screen.findByRole("button", {
      name: "pushNotifications.enable",
    });
    await user.click(enableButton);

    expect(
      screen.getByRole("button", { name: "pushNotifications.enable" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "pushNotifications.disable" })
    ).not.toBeInTheDocument();
    expect(mockNewSubscription.unsubscribe).toHaveBeenCalled();
  });

  it("logs error when unsubscribeUser server action returns failure", async () => {
    const { unsubscribeUser } = await import("@/app/actions");
    vi.mocked(unsubscribeUser).mockResolvedValueOnce({
      success: false,
      error: "Server removal failed",
    });
    const consoleError = vi
      .spyOn(console, "error")
      // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during test
      .mockImplementation(() => {});
    const user = userEvent.setup();
    const mockSubscription = makeMockSubscription();
    stubPushAPIs(mockSubscription);

    render(<PushNotifications />);

    const disableButton = await screen.findByRole("button", {
      name: "pushNotifications.disable",
    });
    await user.click(disableButton);

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to remove server subscription:",
      "Server removal failed"
    );
  });

  it("calls sendNotification when message is typed and Send is clicked", async () => {
    const { sendNotification } = await import("@/app/actions");
    const user = userEvent.setup();
    const mockSubscription = makeMockSubscription();
    stubPushAPIs(mockSubscription);

    render(<PushNotifications />);

    await screen.findByRole("button", { name: "pushNotifications.disable" });

    const input = screen.getByLabelText("pushNotifications.messageAriaLabel");
    await user.type(input, "Hello world");

    const sendButton = screen.getByRole("button", {
      name: "pushNotifications.sendAriaLabel",
    });
    await user.click(sendButton);

    expect(vi.mocked(sendNotification)).toHaveBeenCalledWith("Hello world");
    expect(input).toHaveValue("");
  });

  it("does not call sendNotification when message input is empty", async () => {
    const { sendNotification } = await import("@/app/actions");
    vi.mocked(sendNotification).mockClear();
    const user = userEvent.setup();
    const mockSubscription = makeMockSubscription();
    stubPushAPIs(mockSubscription);

    render(<PushNotifications />);

    await screen.findByRole("button", { name: "pushNotifications.disable" });

    const sendButton = screen.getByRole("button", {
      name: "pushNotifications.sendAriaLabel",
    });
    await user.click(sendButton);

    expect(vi.mocked(sendNotification)).not.toHaveBeenCalled();
  });

  it("does not clear input when sendNotification returns failure", async () => {
    const { sendNotification } = await import("@/app/actions");
    vi.mocked(sendNotification).mockResolvedValueOnce({
      success: false,
      error: "Send failed",
    });
    const user = userEvent.setup();
    const mockSubscription = makeMockSubscription();
    stubPushAPIs(mockSubscription);

    render(<PushNotifications />);

    await screen.findByRole("button", { name: "pushNotifications.disable" });

    const input = screen.getByLabelText("pushNotifications.messageAriaLabel");
    await user.type(input, "Keep this");

    const sendButton = screen.getByRole("button", {
      name: "pushNotifications.sendAriaLabel",
    });
    await user.click(sendButton);

    expect(vi.mocked(sendNotification)).toHaveBeenCalledWith("Keep this");
    expect(input).toHaveValue("Keep this");
  });

  it("handles sendNotification rejection gracefully", async () => {
    const { sendNotification } = await import("@/app/actions");
    vi.mocked(sendNotification).mockRejectedValueOnce(
      new Error("Network error")
    );
    const consoleError = vi
      .spyOn(console, "error")
      // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during test
      .mockImplementation(() => {});
    const user = userEvent.setup();
    const mockSubscription = makeMockSubscription();
    stubPushAPIs(mockSubscription);

    render(<PushNotifications />);

    await screen.findByRole("button", { name: "pushNotifications.disable" });

    const input = screen.getByLabelText("pushNotifications.messageAriaLabel");
    await user.type(input, "Fail test");

    const sendButton = screen.getByRole("button", {
      name: "pushNotifications.sendAriaLabel",
    });
    await user.click(sendButton);

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to send notification:",
      expect.objectContaining({ message: "Network error" })
    );
    // Component should still be functional
    expect(
      screen.getByRole("button", { name: "pushNotifications.disable" })
    ).toBeInTheDocument();
    expect(input).toHaveValue("Fail test");
  });

  it("calls sendNotification when Enter is pressed in the message input", async () => {
    const { sendNotification } = await import("@/app/actions");
    vi.mocked(sendNotification).mockClear();
    const user = userEvent.setup();
    const mockSubscription = makeMockSubscription();
    stubPushAPIs(mockSubscription);

    render(<PushNotifications />);
    await screen.findByRole("button", { name: "pushNotifications.disable" });

    const input = screen.getByLabelText("pushNotifications.messageAriaLabel");
    await user.type(input, "Hello world{Enter}");

    expect(vi.mocked(sendNotification)).toHaveBeenCalledWith("Hello world");
  });

  it("handles unsubscribe failure gracefully", async () => {
    const user = userEvent.setup();
    const mockUnsubscribe = vi
      .fn()
      .mockRejectedValue(new Error("Unsubscribe failed"));
    const mockSubscription = makeMockSubscription({
      unsubscribe: mockUnsubscribe,
    });
    stubPushAPIs(mockSubscription);

    const consoleError = vi
      .spyOn(console, "error")
      // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during test
      .mockImplementation(() => {});
    render(<PushNotifications />);

    const disableButton = await screen.findByRole("button", {
      name: "pushNotifications.disable",
    });
    await user.click(disableButton);

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to unsubscribe from push:",
      expect.objectContaining({ message: "Unsubscribe failed" })
    );
  });

  it("registers service worker via load event when document is still loading", async () => {
    Object.defineProperty(document, "readyState", {
      value: "loading",
      writable: true,
      configurable: true,
    });

    try {
      stubPushAPIs(null);

      render(<PushNotifications />);

      // Trigger the load event to complete initialization
      window.dispatchEvent(new Event("load"));

      // After load event, component should show enable button (supported but not subscribed)
      const button = await screen.findByRole("button", {
        name: "pushNotifications.enable",
      });
      expect(button).toBeInTheDocument();
      expect(navigator.serviceWorker.register).toHaveBeenCalledWith("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
    } finally {
      Object.defineProperty(document, "readyState", {
        value: "complete",
        writable: true,
        configurable: true,
      });
    }
  });

  it("logs error when service worker registration fails", async () => {
    const registrationError = new Error("SW registration failed");
    Object.defineProperty(window, "PushManager", {
      value: class PushManager {},
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: vi.fn().mockRejectedValue(registrationError),
        // biome-ignore lint/suspicious/noEmptyBlockStatements: promise that never resolves to keep SW in pending state
        ready: new Promise(() => {}),
      },
      writable: true,
      configurable: true,
    });
    const consoleError = vi
      .spyOn(console, "error")
      // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during test
      .mockImplementation(() => {});

    render(<PushNotifications />);

    await vi.waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to register service worker:",
        registrationError
      );
    });
  });

  it("handles subscribe permission denied gracefully", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      // intentionally silenced for test
    });
    stubPushAPIs(null);

    // Override the ready promise to reject on subscribe
    const mockSubscribeReject = vi
      .fn()
      .mockRejectedValue(
        new DOMException("User denied permission", "NotAllowedError")
      );
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ...navigator.serviceWorker,
        register: vi.fn().mockResolvedValue({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(null),
          },
        }),
        ready: Promise.resolve({
          pushManager: { subscribe: mockSubscribeReject },
        }),
      },
      writable: true,
      configurable: true,
    });

    render(<PushNotifications />);
    const enableButton = await screen.findByRole("button", {
      name: "pushNotifications.enable",
    });

    await user.click(enableButton);

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to subscribe to push:",
      expect.objectContaining({ message: "User denied permission" })
    );
    // Component should still be functional — Enable button should remain
    expect(
      screen.getByRole("button", { name: "pushNotifications.enable" })
    ).toBeInTheDocument();
  });

  it("handles subscribe failure gracefully", async () => {
    const user = userEvent.setup();
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {
      // intentionally silenced for test
    });
    stubPushAPIs(null);

    const mockSubscribeReject = vi
      .fn()
      .mockRejectedValue(new Error("Push service unavailable"));
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        ...navigator.serviceWorker,
        register: vi.fn().mockResolvedValue({
          pushManager: {
            getSubscription: vi.fn().mockResolvedValue(null),
          },
        }),
        ready: Promise.resolve({
          pushManager: { subscribe: mockSubscribeReject },
        }),
      },
      writable: true,
      configurable: true,
    });

    render(<PushNotifications />);
    const enableButton = await screen.findByRole("button", {
      name: "pushNotifications.enable",
    });

    await user.click(enableButton);

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to subscribe to push:",
      expect.objectContaining({ message: "Push service unavailable" })
    );
    // Component should remain in unsubscribed state after failure
    expect(
      screen.getByRole("button", { name: "pushNotifications.enable" })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "pushNotifications.disable" })
    ).not.toBeInTheDocument();
  });
});

const PUSH_NOT_SUPPORTED = /pushNotifications\.notSupported/;
const INSTALL_THIS_APP = /pushNotifications\.iosInstallPrompt/;
const INSTALL_PROMPT = /pushNotifications\.installPrompt/;

describe("InstallPrompt (via PushNotifications)", () => {
  const originalUserAgent = navigator.userAgent;

  const stubMatchMedia = (standaloneMatches: boolean) => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: standaloneMatches && query === "(display-mode: standalone)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn().mockReturnValue(false),
      })),
    });
  };

  const stubUserAgent = (ua: string) => {
    Object.defineProperty(navigator, "userAgent", {
      value: ua,
      writable: true,
      configurable: true,
    });
  };

  afterEach(() => {
    vi.restoreAllMocks();
    if (Object.getOwnPropertyDescriptor(window, "matchMedia")) {
      Reflect.deleteProperty(window, "matchMedia");
    }
    Object.defineProperty(navigator, "userAgent", {
      value: originalUserAgent,
      writable: true,
      configurable: true,
    });
  });

  it("returns null when in standalone mode", async () => {
    stubMatchMedia(true);

    render(<PushNotifications />);

    expect(screen.queryByText(INSTALL_THIS_APP)).not.toBeInTheDocument();
    // Verify the component did render (PushNotifications shows "not supported"
    // in jsdom since PushManager is absent).
    expect(await screen.findByText(PUSH_NOT_SUPPORTED)).toBeInTheDocument();
  });

  it("shows iOS install instructions when on iOS", () => {
    stubMatchMedia(false);
    stubUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)");

    render(<PushNotifications />);

    expect(screen.getByText(INSTALL_THIS_APP)).toBeInTheDocument();
  });

  it("returns null on non-iOS, non-standalone browsers without beforeinstallprompt", () => {
    stubMatchMedia(false);
    stubUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36");

    render(<PushNotifications />);

    expect(screen.queryByText(INSTALL_THIS_APP)).not.toBeInTheDocument();
  });

  it("shows install button when beforeinstallprompt fires", async () => {
    stubMatchMedia(false);
    stubUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36");

    render(<PushNotifications />);

    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: vi.fn().mockResolvedValue({ outcome: "accepted" as const }),
    });
    window.dispatchEvent(event);

    expect(await screen.findByText(INSTALL_PROMPT)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "pushNotifications.installApp" })
    ).toBeInTheDocument();
  });

  it("calls prompt and hides button when install button is clicked", async () => {
    stubMatchMedia(false);
    stubUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36");
    const user = userEvent.setup();

    render(<PushNotifications />);

    const mockPrompt = vi
      .fn()
      .mockResolvedValue({ outcome: "accepted" as const });
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, { prompt: mockPrompt });
    window.dispatchEvent(event);

    const installButton = await screen.findByRole("button", {
      name: "pushNotifications.installApp",
    });
    await user.click(installButton);

    expect(mockPrompt).toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(
        screen.queryByRole("button", { name: "pushNotifications.installApp" })
      ).not.toBeInTheDocument();
    });
  });

  it("keeps install button visible when prompt is dismissed", async () => {
    stubMatchMedia(false);
    stubUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36");
    const user = userEvent.setup();

    render(<PushNotifications />);

    const mockPrompt = vi
      .fn()
      .mockResolvedValue({ outcome: "dismissed" as const });
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, { prompt: mockPrompt });
    window.dispatchEvent(event);

    const installButton = await screen.findByRole("button", {
      name: "pushNotifications.installApp",
    });
    await user.click(installButton);

    expect(mockPrompt).toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(
        screen.getByRole("button", { name: "pushNotifications.installApp" })
      ).toBeInTheDocument();
    });
  });

  it("prefers beforeinstallprompt over iOS install instructions", async () => {
    stubMatchMedia(false);
    stubUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
    );

    render(<PushNotifications />);

    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: vi.fn().mockResolvedValue({ outcome: "dismissed" as const }),
    });
    window.dispatchEvent(event);

    // Should show install prompt, not iOS instructions
    expect(await screen.findByText(INSTALL_PROMPT)).toBeInTheDocument();
    expect(screen.queryByText(INSTALL_THIS_APP)).not.toBeInTheDocument();
  });

  it("handles prompt() rejection gracefully", async () => {
    stubMatchMedia(false);
    stubUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36");
    const user = userEvent.setup();
    const consoleError = vi
      .spyOn(console, "error")
      // biome-ignore lint/suspicious/noEmptyBlockStatements: suppress console.error output during test
      .mockImplementation(() => {});

    render(<PushNotifications />);

    const promptError = new Error("User dismissed the prompt");
    const mockPrompt = vi.fn().mockRejectedValue(promptError);
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, { prompt: mockPrompt });
    window.dispatchEvent(event);

    const installButton = await screen.findByRole("button", {
      name: "pushNotifications.installApp",
    });
    await user.click(installButton);

    expect(mockPrompt).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      "Install prompt failed:",
      promptError
    );
    // After rejection, the .catch() handler only logs — it does NOT clear
    // the install prompt event, so the button should remain visible.
    expect(
      screen.getByRole("button", { name: "pushNotifications.installApp" })
    ).toBeInTheDocument();
  });
});
