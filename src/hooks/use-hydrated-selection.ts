"use client";

import { useEffect, useRef, useState } from "react";

interface UseHydratedSelectionOptions<T extends string> {
  /**
   * The id of the row currently being edited, or null when not editing.
   * Sentinel for the lifecycle: null → idle, non-null → hydrating-or-ready.
   */
  editingId: string | null;
  /**
   * True while the upstream query providing the seed is still loading.
   * The hook will not seed selection until this flips to false.
   */
  isLoading: boolean;
  /**
   * Computes the seed array from current state. Called at most once per
   * editing session — internally invoked through a ref so the seed callback's
   * per-render identity does not gate effect re-fires.
   */
  seed: () => T[];
}

interface UseHydratedSelectionResult<T extends string> {
  /** False during hydration; otherwise selected !== original (set comparison). */
  isDirty: boolean;
  /** True iff editingId is set and the seed has not been applied yet. */
  isHydrating: boolean;
  /** Original seed value, captured at lock-in time. Empty during hydration. */
  original: T[];
  /** Resets internal state to null. Call from the sheet's close handler. */
  reset: () => void;
  /** Seeds selected = original = []. Call from Add-mode handlers. */
  seedEmpty: () => void;
  /** Always returns an array (empty during hydration). Never null externally. */
  selected: T[];
  /** No-op during hydration; otherwise toggles id in selected. */
  toggle: (id: T) => void;
}

/**
 * Manages a multi-select selection that must be seeded from a PowerSync query
 * once the query has hydrated. Avoids the silent-unlink race where the user
 * clicks Edit before the join has loaded and the snapshot is `[]` (issue #216).
 *
 * Lifecycle:
 *   idle (editingId=null) → hydrating (editingId set, isLoading true)
 *     → ready (seed applied, isLoading false)
 *     → idle (consumer calls reset())
 *
 * The seed function is called at most once per editing session through a ref,
 * so background-sync changes that mutate the upstream query result after seed
 * lock-in do NOT re-fire the seeding effect — preserving snapshot semantics
 * for delta-only mutations.
 */
export function useHydratedSelection<T extends string>({
  editingId,
  isLoading,
  seed,
}: UseHydratedSelectionOptions<T>): UseHydratedSelectionResult<T> {
  const [selected, setSelected] = useState<T[] | null>(null);
  const [original, setOriginal] = useState<T[] | null>(null);

  const seedRef = useRef(seed);
  seedRef.current = seed;

  const lastSeededIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (editingId === null || isLoading) {
      return;
    }
    if (lastSeededIdRef.current === editingId) {
      return;
    }
    const seedValue = seedRef.current();
    setSelected(seedValue);
    setOriginal(seedValue);
    lastSeededIdRef.current = editingId;
  }, [editingId, isLoading]);

  const isHydrating = editingId !== null && (isLoading || selected === null);

  const isDirty =
    selected !== null &&
    original !== null &&
    (selected.length !== original.length ||
      selected.some((id) => !original.includes(id)));

  // Stable handler identities. Inline `function reset() {}` declarations get a
  // fresh identity each render, which trips Biome's useExhaustiveDependencies
  // when consumers reference these in effect deps. The stable-wrapper pattern
  // (init-once useRef holding closures that delegate to the latest impl) gives
  // us referentially-stable callbacks without using useCallback (CLAUDE.md
  // forbids it because the React Compiler handles same-component memoization —
  // but cross-hook-boundary stability still requires this manual pattern).
  const handlersRef = useRef({
    toggle(id: T): void {
      setSelected((prev) => {
        if (prev === null) {
          return prev;
        }
        return prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      });
    },
    reset(): void {
      setSelected(null);
      setOriginal(null);
      lastSeededIdRef.current = null;
    },
    seedEmpty(): void {
      setSelected([]);
      setOriginal([]);
    },
  });

  return {
    selected: selected ?? [],
    original: original ?? [],
    isHydrating,
    isDirty,
    toggle: handlersRef.current.toggle,
    reset: handlersRef.current.reset,
    seedEmpty: handlersRef.current.seedEmpty,
  };
}

export type { UseHydratedSelectionOptions, UseHydratedSelectionResult };
