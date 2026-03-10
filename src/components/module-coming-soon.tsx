import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import { getModule, type ModuleSlug } from "@/lib/modules";

interface ModuleComingSoonProps {
  slug: ModuleSlug;
}

export function ModuleComingSoon({
  slug,
}: ModuleComingSoonProps): ReactElement {
  const mod = getModule(slug);
  const Icon = mod.icon;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <Icon className="size-8 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-2xl tracking-tight">{mod.label}</h1>
        <p className="max-w-md text-muted-foreground">{mod.description}</p>
      </div>
      <Badge variant="secondary">Coming soon</Badge>
    </div>
  );
}
