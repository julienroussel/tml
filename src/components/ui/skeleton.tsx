import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "bg-accent rounded-md motion-safe:animate-pulse",
        className
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}

export { Skeleton };
