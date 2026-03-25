import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { goals } from "./goals";
import { itemTricks } from "./items";
import { performances } from "./performances";
import { practiceSessionTricks } from "./practice-sessions";
import { setlistTricks } from "./setlists";

/**
 * Regression test for issue #46: Junction table FK constraints must use
 * NO ACTION on entity FKs (to prevent the hard-delete cleanup job from
 * bypassing soft-delete tombstones) while keeping CASCADE on user_id FKs
 * (so full user account removal still cascades correctly).
 *
 * This ensures the NO ACTION + CASCADE coexistence is preserved and that
 * PostgreSQL's cascade ordering will delete junction rows via user_id
 * CASCADE before NO ACTION on entity FKs can block the operation.
 */

interface FkExpectation {
  readonly columnName: string;
  readonly expectedAction: string;
}

function getFkAction(
  tableName: string,
  foreignKeys: ReturnType<typeof getTableConfig>["foreignKeys"],
  columnName: string
): string | undefined {
  const fk = foreignKeys.find((key) => key.getName().includes(columnName));
  if (!fk) {
    throw new Error(
      `FK containing "${columnName}" not found on table "${tableName}"`
    );
  }
  return fk.onDelete;
}

describe("junction table FK constraints (#46)", () => {
  const junctionTables = [
    {
      name: "item_tricks",
      table: itemTricks,
      entityFks: [
        { columnName: "item_id", expectedAction: "no action" },
        { columnName: "trick_id", expectedAction: "no action" },
      ] satisfies FkExpectation[],
    },
    {
      name: "setlist_tricks",
      table: setlistTricks,
      entityFks: [
        { columnName: "setlist_id", expectedAction: "no action" },
        { columnName: "trick_id", expectedAction: "no action" },
      ] satisfies FkExpectation[],
    },
    {
      name: "practice_session_tricks",
      table: practiceSessionTricks,
      entityFks: [
        { columnName: "practice_session_id", expectedAction: "no action" },
        { columnName: "trick_id", expectedAction: "no action" },
      ] satisfies FkExpectation[],
    },
  ] as const;

  for (const { name, table, entityFks } of junctionTables) {
    describe(name, () => {
      const { foreignKeys } = getTableConfig(table);

      it("uses CASCADE on user_id FK for account deletion", () => {
        const action = getFkAction(name, foreignKeys, "user_id");
        expect(action).toBe("cascade");
      });

      for (const { columnName, expectedAction } of entityFks) {
        it(`uses NO ACTION on ${columnName} FK to prevent orphaned sync tombstones`, () => {
          const action = getFkAction(name, foreignKeys, columnName);
          expect(action).toBe(expectedAction);
        });
      }
    });
  }
});

describe("entity FK SET NULL constraints (#81)", () => {
  it("uses SET NULL on performances.setlist_id FK", () => {
    const { foreignKeys } = getTableConfig(performances);
    const action = getFkAction("performances", foreignKeys, "setlist_id");
    expect(action).toBe("set null");
  });

  it("uses SET NULL on goals.trick_id FK", () => {
    const { foreignKeys } = getTableConfig(goals);
    const action = getFkAction("goals", foreignKeys, "trick_id");
    expect(action).toBe("set null");
  });
});
