import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useHydratedSelection } from "./use-hydrated-selection";

type TestId = string & { readonly __brand: "TestId" };
const t = (s: string): TestId => s as TestId;

describe("useHydratedSelection", () => {
  it("starts hydrating when editingId is set and isLoading is true", () => {
    const { result } = renderHook(() =>
      useHydratedSelection<TestId>({
        editingId: "row-1",
        isLoading: true,
        seed: () => [t("a"), t("b")],
      })
    );

    expect(result.current.isHydrating).toBe(true);
    expect(result.current.selected).toEqual([]);
    expect(result.current.original).toEqual([]);
    expect(result.current.isDirty).toBe(false);
  });

  it("stays idle when editingId is null", () => {
    const { result } = renderHook(() =>
      useHydratedSelection<TestId>({
        editingId: null,
        isLoading: false,
        seed: () => [t("a")],
      })
    );

    expect(result.current.isHydrating).toBe(false);
    expect(result.current.selected).toEqual([]);
    expect(result.current.isDirty).toBe(false);
  });

  it("seeds selected and original when isLoading flips to false", () => {
    const { result, rerender } = renderHook(
      ({ isLoading }) =>
        useHydratedSelection<TestId>({
          editingId: "row-1",
          isLoading,
          seed: () => [t("a"), t("b")],
        }),
      { initialProps: { isLoading: true } }
    );

    expect(result.current.isHydrating).toBe(true);

    rerender({ isLoading: false });

    expect(result.current.isHydrating).toBe(false);
    expect(result.current.selected).toEqual([t("a"), t("b")]);
    expect(result.current.original).toEqual([t("a"), t("b")]);
    expect(result.current.isDirty).toBe(false);
  });

  it("does not re-seed when seed source mutates after lock-in (background sync)", () => {
    let seedValue: TestId[] = [t("a"), t("b")];
    const { result, rerender } = renderHook(
      ({ isLoading }) =>
        useHydratedSelection<TestId>({
          editingId: "row-1",
          isLoading,
          seed: () => seedValue,
        }),
      { initialProps: { isLoading: true } }
    );

    rerender({ isLoading: false });
    expect(result.current.selected).toEqual([t("a"), t("b")]);

    // Background sync added a tag to the upstream query result.
    seedValue = [t("a"), t("b"), t("c")];
    rerender({ isLoading: false });

    // selected stays locked at the original seed — this is the headline
    // regression class from issue #216.
    expect(result.current.selected).toEqual([t("a"), t("b")]);
    expect(result.current.original).toEqual([t("a"), t("b")]);
    expect(result.current.isDirty).toBe(false);
  });

  it("toggle adds and removes ids", () => {
    const { result, rerender } = renderHook(
      ({ isLoading }) =>
        useHydratedSelection<TestId>({
          editingId: "row-1",
          isLoading,
          seed: () => [t("a")],
        }),
      { initialProps: { isLoading: true } }
    );
    rerender({ isLoading: false });

    act(() => result.current.toggle(t("b")));
    expect(result.current.selected).toEqual([t("a"), t("b")]);

    act(() => result.current.toggle(t("a")));
    expect(result.current.selected).toEqual([t("b")]);
  });

  it("toggle is a no-op while hydrating", () => {
    const { result } = renderHook(() =>
      useHydratedSelection<TestId>({
        editingId: "row-1",
        isLoading: true,
        seed: () => [t("a")],
      })
    );

    act(() => result.current.toggle(t("z")));
    expect(result.current.selected).toEqual([]);
    expect(result.current.isHydrating).toBe(true);
  });

  it("isDirty becomes true after toggle and false after toggle-back", () => {
    const { result, rerender } = renderHook(
      ({ isLoading }) =>
        useHydratedSelection<TestId>({
          editingId: "row-1",
          isLoading,
          seed: () => [t("a"), t("b")],
        }),
      { initialProps: { isLoading: true } }
    );
    rerender({ isLoading: false });

    expect(result.current.isDirty).toBe(false);

    act(() => result.current.toggle(t("c")));
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.toggle(t("c")));
    expect(result.current.isDirty).toBe(false);
  });

  it("isDirty does not flip on order-only differences", () => {
    const { result, rerender } = renderHook(
      ({ isLoading }) =>
        useHydratedSelection<TestId>({
          editingId: "row-1",
          isLoading,
          seed: () => [t("a"), t("b")],
        }),
      { initialProps: { isLoading: true } }
    );
    rerender({ isLoading: false });

    // Toggle off then on — same set, different order
    act(() => result.current.toggle(t("a")));
    act(() => result.current.toggle(t("a")));

    // selected is now [b, a] — set-equal to [a, b]
    expect(result.current.selected).toEqual([t("b"), t("a")]);
    expect(result.current.isDirty).toBe(false);
  });

  it("reset returns hook to hydrating state when editingId is still set", () => {
    const { result, rerender } = renderHook(
      ({ isLoading }) =>
        useHydratedSelection<TestId>({
          editingId: "row-1",
          isLoading,
          seed: () => [t("a"), t("b")],
        }),
      { initialProps: { isLoading: true } }
    );
    rerender({ isLoading: false });

    expect(result.current.selected).toEqual([t("a"), t("b")]);

    act(() => result.current.reset());

    expect(result.current.selected).toEqual([]);
    expect(result.current.original).toEqual([]);
    // editingId is still "row-1" and isLoading is false — but selected is null
    // internally, so isHydrating is true (waiting for the next seed cycle).
    expect(result.current.isHydrating).toBe(true);
  });

  it("seedEmpty bypasses the hydration gate (Add mode)", () => {
    const { result } = renderHook(() =>
      useHydratedSelection<TestId>({
        editingId: null,
        isLoading: false,
        seed: () => [t("never")],
      })
    );

    act(() => result.current.seedEmpty());

    expect(result.current.selected).toEqual([]);
    expect(result.current.original).toEqual([]);
    expect(result.current.isHydrating).toBe(false);

    act(() => result.current.toggle(t("new")));
    expect(result.current.selected).toEqual([t("new")]);
    expect(result.current.isDirty).toBe(true);
  });

  it("re-seeds when editingId switches without an explicit reset", () => {
    let currentId: string | null = "row-1";
    const seeds: Record<string, TestId[]> = {
      "row-1": [t("a")],
      "row-2": [t("x"), t("y")],
    };

    const { result, rerender } = renderHook(
      ({ id, isLoading }) =>
        useHydratedSelection<TestId>({
          editingId: id,
          isLoading,
          seed: () => (id ? (seeds[id] ?? []) : []),
        }),
      { initialProps: { id: currentId, isLoading: false } }
    );

    expect(result.current.selected).toEqual([t("a")]);

    // User clicked Edit on a different row without closing the sheet.
    currentId = "row-2";
    rerender({ id: currentId, isLoading: false });

    expect(result.current.selected).toEqual([t("x"), t("y")]);
    expect(result.current.original).toEqual([t("x"), t("y")]);
    expect(result.current.isDirty).toBe(false);
  });
});
