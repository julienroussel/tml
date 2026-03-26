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
          "flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2 font-medium text-sm",
          "hover:bg-accent hover:text-accent-foreground",
          "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "[&[data-state=open]>svg]:rotate-180"
        )}
      >
        {title}
        <ChevronDown className="size-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}
