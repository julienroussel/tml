import Image from "next/image";
import Link from "next/link";
import type { ReactElement } from "react";

interface LogoProps {
  className?: string;
  height: number;
  href?: string;
  width: number;
}

export function Logo({
  height,
  width,
  className,
  href = "/",
}: LogoProps): ReactElement {
  return (
    <Link className={className} href={href}>
      <Image
        alt=""
        className="block h-auto w-full dark:hidden"
        height={height}
        loading="eager"
        src="/logo-light.svg"
        width={width}
      />
      <Image
        alt=""
        className="hidden h-auto w-full dark:block"
        height={height}
        loading="eager"
        src="/logo-dark.svg"
        width={width}
      />
      <span className="sr-only">The Magic Lab</span>
    </Link>
  );
}
