import type { ReactNode } from "react";
import { vi } from "vitest";

/**
 * Shared mock definitions for Next.js modules.
 *
 * `vi.mock()` calls are hoisted by Vitest at compile time — importing
 * this file activates all mocks regardless of which functions are called.
 * The exported functions exist for documentation and IDE discoverability,
 * not for conditional activation.
 */

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  useSearchParams: vi.fn(() => new URLSearchParams()),
  useParams: vi.fn(() => ({})),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...props }: { alt: string } & Record<string, unknown>) => (
    // biome-ignore lint/performance/noImgElement: test mock for next/image
    // biome-ignore lint/correctness/useImageSize: test mock — dimensions passed via props spread
    <img alt={alt} {...props} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: { children: ReactNode } & Record<string, unknown>) => (
    <a {...props}>{children}</a>
  ),
}));

/** @see top-level `vi.mock("next/navigation")` */
function mockNextNavigation(): void {
  // intentional no-op — mock is activated by top-level vi.mock() hoist
}

/** @see top-level `vi.mock("next/image")` */
function mockNextImage(): void {
  // intentional no-op — mock is activated by top-level vi.mock() hoist
}

/** @see top-level `vi.mock("next/link")` */
function mockNextLink(): void {
  // intentional no-op — mock is activated by top-level vi.mock() hoist
}

export { mockNextImage, mockNextLink, mockNextNavigation };
