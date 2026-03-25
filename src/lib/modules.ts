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
  description: string;
  enabled: boolean;
  group: ModuleGroup;
  icon: LucideIcon;
  label: string;
  slug: string;
}

const APP_MODULES = [
  {
    slug: "improve",
    label: "Improve",
    description: "Track practice sessions and refine your skills over time.",
    icon: Dumbbell,
    enabled: false,
    group: "main",
  },
  {
    slug: "train",
    label: "Train",
    description: "Set goals, run drills, and build muscle memory.",
    icon: ListChecks,
    enabled: false,
    group: "main",
  },
  {
    slug: "plan",
    label: "Plan",
    description: "Design setlists and show running orders.",
    icon: BookOpen,
    enabled: false,
    group: "main",
  },
  {
    slug: "perform",
    label: "Perform",
    description: "Log performances, track venues, and review feedback.",
    icon: Star,
    enabled: false,
    group: "main",
  },
  {
    slug: "enhance",
    label: "Enhance",
    description: "Discover insights and suggestions to elevate your magic.",
    icon: Sparkles,
    enabled: false,
    group: "main",
  },
  {
    slug: "collect",
    label: "Collect",
    description: "Manage your inventory of props, books, gimmicks, and more.",
    icon: Package,
    enabled: false,
    group: "main",
  },
  {
    slug: "admin",
    label: "Admin",
    description: "Application settings and administration.",
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
