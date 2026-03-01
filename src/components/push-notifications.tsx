"use client";

import { useEffect, useState } from "react";

import {
  sendNotification,
  subscribeUser,
  unsubscribeUser,
} from "@/app/actions";
import { Button } from "@/components/ui/button";

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

const IOS_REGEX = /iPad|iPhone|iPod/;

function PushNotificationManager() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(
    null
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if ("serviceWorker" in navigator && "PushManager" in window) {
      setIsSupported(true);
      const register = async () => {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
        const sub = await registration.pushManager.getSubscription();
        setSubscription(sub);
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
        return () => {
          window.removeEventListener("load", onLoad);
        };
      }
    }
  }, []);

  async function subscribeToPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      setSubscription(sub);
      const json = sub.toJSON();
      if (!(json.endpoint && json.keys?.p256dh && json.keys?.auth)) {
        throw new Error("Invalid push subscription: missing required fields");
      }
      await subscribeUser({
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
      });
    } catch (error) {
      console.error("Failed to subscribe to push:", error);
    }
  }

  async function unsubscribeFromPush() {
    try {
      await subscription?.unsubscribe();
      setSubscription(null);
      await unsubscribeUser();
    } catch (error) {
      console.error("Failed to unsubscribe from push:", error);
    }
  }

  async function handleSendNotification() {
    try {
      if (message.trim()) {
        await sendNotification(message);
        setMessage("");
      }
    } catch (error) {
      console.error("Failed to send notification:", error);
    }
  }

  if (!isSupported) {
    return (
      <p className="text-muted-foreground text-sm">
        Push notifications are not supported in this browser.
      </p>
    );
  }

  return (
    <div aria-live="polite" className="flex flex-col items-center gap-4">
      {subscription ? (
        <>
          <form
            className="flex w-full max-w-sm gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              // Error handling is inside handleSendNotification
              handleSendNotification();
            }}
          >
            <input
              aria-label="Notification message"
              className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter notification message"
              type="text"
              value={message}
            />
            <Button size="sm" type="submit">
              Send
            </Button>
          </form>
          <Button
            onClick={unsubscribeFromPush}
            size="sm"
            type="button"
            variant="outline"
          >
            Disable Notifications
          </Button>
        </>
      ) : (
        <Button onClick={subscribeToPush} size="sm" type="button">
          Enable Notifications
        </Button>
      )}
    </div>
  );
}

function InstallPrompt() {
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
        To install this app, tap the share button
        <span aria-hidden="true"> (share) </span>
        and then &quot;Add to Home Screen&quot;
        <span aria-hidden="true"> (+) </span>.
      </p>
    );
  }

  return null;
}

export function PushNotifications() {
  return (
    <div className="flex flex-col items-center gap-4">
      <PushNotificationManager />
      <InstallPrompt />
    </div>
  );
}
