"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface FormSectionProps {
  children: ReactNode;
  defaultOpen?: boolean;
  title: string;
}

export function FormSection({
  title,
  defaultOpen = false,
  children,
}: FormSectionProps): React.ReactElement {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger
        className={cn(
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 text-sm font-medium",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none",
          "[&[data-state=open]>svg]:rotate-180"
        )}
      >
        {title}
        <ChevronDown className="text-muted-foreground size-4 shrink-0 motion-safe:transition-transform motion-safe:duration-200" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}
