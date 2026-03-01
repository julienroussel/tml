"use client";

import dynamic from "next/dynamic";

export const PushNotificationsLazy = dynamic(
  () =>
    import("@/components/push-notifications").then(
      (mod) => mod.PushNotifications
    ),
  { ssr: false }
);
