import { AccountView } from "@neondatabase/auth/react";
import { accountViewPaths } from "@neondatabase/auth/react/ui/server";
import type { Metadata } from "next";
import type { ReactElement } from "react";

export const dynamicParams = false;

export function generateStaticParams(): { path: string }[] {
  return Object.values(accountViewPaths).map((path) => ({ path }));
}

export const metadata: Metadata = {
  title: "Account",
  description: "Manage your account settings.",
};

export default async function AccountPage({
  params,
}: {
  params: Promise<{ path: string }>;
}): Promise<ReactElement> {
  const { path } = await params;

  return <AccountView path={path} />;
}
