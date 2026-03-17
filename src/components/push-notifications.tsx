"use client";

import { useTranslations } from "next-intl";
import { type ReactElement, useEffect, useRef, useState } from "react";

import {
  sendNotification,
  subscribeUser,
  unsubscribeUser,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackEvent } from "@/lib/analytics";

export function urlBase64ToUint8Array(
  base64String: string
): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = globalThis.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function PushNotificationManager(): ReactElement {
  const t = useTranslations("pushNotifications");
  const [isSupported, setIsSupported] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  );
  const [message, setMessage] = useState("");

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    setMounted(true);

    let removeLoadListener: (() => void) | undefined;

    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      const register = async () => {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        const sub = await registration.pushManager.getSubscription();
        if (isMountedRef.current) {
          setSubscription(sub);
        }
      };
      const onLoad = () => {
        register().catch((error) => {
          console.error("Failed to register service worker:", error);
        });
      };
      if (document.readyState === "complete") {
        onLoad();
      } else {
        window.addEventListener("load", onLoad, { once: true });
        removeLoadListener = () => window.removeEventListener("load", onLoad);
      }
    }

    return () => {
      isMountedRef.current = false;
      removeLoadListener?.();
    };
  }, []);

  async function subscribeToPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const json = sub.toJSON();
      if (!(json.endpoint && json.keys?.p256dh && json.keys?.auth)) {
        await sub.unsubscribe();
        throw new Error("Invalid push subscription: missing required fields");
      }
      const result = await subscribeUser({
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
      });
      if (!result.success) {
        await sub.unsubscribe();
        throw new Error(result.error);
      }
      setSubscription(sub);
      trackEvent("push_notifications_enabled");
    } catch (error: unknown) {
      console.error("Failed to subscribe to push:", error);
    }
  }

  async function unsubscribeFromPush() {
    try {
      const result = await unsubscribeUser();
      if (!result.success) {
        console.error("Failed to remove server subscription:", result.error);
        return;
      }
      await subscription?.unsubscribe();
      setSubscription(null);
      trackEvent("push_notifications_disabled");
    } catch (error: unknown) {
      console.error("Failed to unsubscribe from push:", error);
    }
  }

  async function handleSendNotification() {
    try {
      if (message.trim()) {
        const result = await sendNotification(message);
        if (result.success) {
          setMessage("");
        }
      }
    } catch (error: unknown) {
      console.error("Failed to send notification:", error);
    }
  }

  if (!mounted) {
    return <div aria-hidden="true" />;
  }

  if (!isSupported) {
    return <p className="text-muted-foreground text-sm">{t("notSupported")}</p>;
  }

  return (
    <div aria-live="polite" className="flex flex-col items-center gap-4">
      {subscription ? (
        <>
          <form
            className="flex w-full max-w-sm gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSendNotification().catch((error) =>
                console.error("Unhandled submit error:", error)
              );
            }}
          >
            <Input
              aria-label={t("messageAriaLabel")}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messagePlaceholder")}
              type="text"
              value={message}
            />
            <Button aria-label={t("sendAriaLabel")} size="sm" type="submit">
              {t("send")}
            </Button>
          </form>
          <Button
            onClick={() => {
              unsubscribeFromPush().catch((error: unknown) =>
                console.error("Unhandled unsubscribe error:", error)
              );
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            {t("disable")}
          </Button>
        </>
      ) : (
        <Button
          onClick={() => {
            subscribeToPush().catch((error: unknown) =>
              console.error("Unhandled subscribe error:", error)
            );
          }}
          size="sm"
          type="button"
        >
          {t("enable")}
        </Button>
      )}
    </div>
  );
}

const IOS_REGEX = /iPad|iPhone|iPod/;

function InstallPrompt(): ReactElement | null {
  const t = useTranslations("pushNotifications");
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    setIsIOS(IOS_REGEX.test(navigator.userAgent) && !("MSStream" in window));
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
  }, []);

  if (isStandalone) {
    return null;
  }

  if (isIOS) {
    return (
      <p className="max-w-sm text-center text-muted-foreground text-sm">
        {t("iosInstallPrompt")}
      </p>
    );
  }

  return null;
}

export function PushNotifications(): ReactElement {
  return (
    <div className="flex flex-col items-center gap-4">
      <PushNotificationManager />
      <InstallPrompt />
    </div>
  );
}
