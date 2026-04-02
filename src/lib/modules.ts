import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Dumbbell,
  ListChecks,
  Package,
  Settings,
  Sparkles,
  Star,
} from "lucide-react";

type ModuleGroup = "admin" | "main";

interface AppModuleBase {
  enabled: boolean;
  group: ModuleGroup;
  icon: LucideIcon;
  slug: string;
}

const APP_MODULES = [
  {
    slug: "improve",
    icon: Dumbbell,
    enabled: false,
    group: "main",
  },
  {
    slug: "train",
    icon: ListChecks,
    enabled: false,
    group: "main",
  },
  {
    slug: "plan",
    icon: BookOpen,
    enabled: false,
    group: "main",
  },
  {
    slug: "perform",
    icon: Star,
    enabled: false,
    group: "main",
  },
  {
    slug: "enhance",
    icon: Sparkles,
    enabled: false,
    group: "main",
  },
  {
    slug: "collect",
    icon: Package,
    enabled: false,
    group: "main",
  },
  {
    slug: "admin",
    icon: Settings,
    enabled: false,
    group: "admin",
  },
] as const satisfies readonly AppModuleBase[];

type ModuleSlug = (typeof APP_MODULES)[number]["slug"];

type AppModuleEntry = (typeof APP_MODULES)[number];

function getModule<S extends ModuleSlug>(
  slug: S
): Extract<AppModuleEntry, { slug: S }> {
  const mod = APP_MODULES.find(
    (m): m is Extract<AppModuleEntry, { slug: S }> => m.slug === slug
  );
  if (!mod) {
    throw new Error(`Module not found: ${slug}`);
  }
  return mod;
}

function getMainModules(): readonly Extract<
  AppModuleEntry,
  { group: "main" }
>[] {
  return APP_MODULES.filter(
    (m): m is Extract<AppModuleEntry, { group: "main" }> => m.group === "main"
  );
}

function getAdminModules(): readonly Extract<
  AppModuleEntry,
  { group: "admin" }
>[] {
  return APP_MODULES.filter(
    (m): m is Extract<AppModuleEntry, { group: "admin" }> => m.group === "admin"
  );
}

export type { AppModuleEntry, ModuleGroup, ModuleSlug };
export { APP_MODULES, getAdminModules, getMainModules, getModule };
