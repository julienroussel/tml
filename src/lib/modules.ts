import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Dumbbell,
  ListChecks,
  Package,
  Settings,
  Sparkles,
  Star,
  WandSparkles,
} from "lucide-react";

const MODULE_GROUPS = ["library", "lab", "insights", "admin"] as const;

type ModuleGroup = (typeof MODULE_GROUPS)[number];

interface AppModuleBase {
  enabled: boolean;
  group: ModuleGroup;
  icon: LucideIcon;
  slug: string;
}

const MODULE_GROUP_NAV_KEYS = {
  admin: "admin",
  insights: "insights",
  lab: "theLab",
  library: "library",
} as const satisfies Record<ModuleGroup, string>;

const APP_MODULES = [
  {
    slug: "repertoire",
    icon: WandSparkles,
    enabled: true,
    group: "library",
  },
  {
    slug: "collect",
    icon: Package,
    enabled: true,
    group: "library",
  },
  {
    slug: "improve",
    icon: Dumbbell,
    enabled: false,
    group: "lab",
  },
  {
    slug: "train",
    icon: ListChecks,
    enabled: false,
    group: "lab",
  },
  {
    slug: "plan",
    icon: BookOpen,
    enabled: false,
    group: "lab",
  },
  {
    slug: "perform",
    icon: Star,
    enabled: false,
    group: "lab",
  },
  {
    slug: "enhance",
    icon: Sparkles,
    enabled: false,
    group: "insights",
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

function getModulesByGroup<G extends ModuleGroup>(
  group: G
): readonly Extract<AppModuleEntry, { group: G }>[] {
  return APP_MODULES.filter(
    (m): m is Extract<AppModuleEntry, { group: G }> => m.group === group
  );
}

export type { AppModuleEntry, ModuleGroup, ModuleSlug };
export {
  APP_MODULES,
  getModule,
  getModulesByGroup,
  MODULE_GROUP_NAV_KEYS,
  MODULE_GROUPS,
};
