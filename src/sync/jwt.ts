/** Narrowing guard for `{ token: string }` shape returned by /api/auth/token. */
export function hasStringToken(value: unknown): value is { token: string } {
  return (
    value !== null &&
    typeof value === "object" &&
    "token" in value &&
    typeof value.token === "string"
  );
}
