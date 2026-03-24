import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  height: number;
  href?: string;
  imageClassName?: string;
  width: number;
}

export function Logo({
  height,
  width,
  className,
  href = "/",
  imageClassName = "h-auto w-full",
}: LogoProps): ReactElement {
  return (
    <Link className={className} href={href}>
      <Image
        alt=""
        className={cn("block dark:hidden", imageClassName)}
        height={height}
        loading="eager"
        src="/logo-light.svg"
        width={width}
      />
      <Image
        alt=""
        className={cn("hidden dark:block", imageClassName)}
        height={height}
        loading="eager"
        src="/logo-dark.svg"
        width={width}
      />
      <span className="sr-only">The Magic Lab</span>
    </Link>
  );
}
