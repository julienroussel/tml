import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-md bg-accent motion-safe:animate-pulse",
        className
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}

export { Skeleton };
