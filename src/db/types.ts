import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { goals } from "./schema/goals";
import type { items, itemTricks } from "./schema/items";
import type { performances } from "./schema/performances";
import type {
  practiceSessions,
  practiceSessionTricks,
} from "./schema/practice-sessions";
import type { pushSubscriptions } from "./schema/push-subscriptions";
import type { setlists, setlistTricks } from "./schema/setlists";
import type { tags, trickTags } from "./schema/tags";
import type { tricks } from "./schema/tricks";
import type { userPreferences } from "./schema/user-preferences";
import type { users } from "./schema/users";

/**
 * Branded ID types for compile-time safety.
 *
 * These are defined for incremental adoption — apply them at key boundaries
 * (API handlers, service functions, component props) as features are built out.
 *
 * Note: Drizzle's InferSelectModel produces `string` for uuid columns,
 * not these branded types. To get branded IDs at the type level, use
 * the typed wrappers: `Omit<User, 'id'> & { id: UserId }`.
 * These types are defined here as the canonical brand definitions
 * for use in application code outside the ORM layer.
 */
type UserId = string & { readonly __brand: "UserId" };
type TrickId = string & { readonly __brand: "TrickId" };
type SetlistId = string & { readonly __brand: "SetlistId" };
type PracticeSessionId = string & { readonly __brand: "PracticeSessionId" };
type PerformanceId = string & { readonly __brand: "PerformanceId" };
type ItemId = string & { readonly __brand: "ItemId" };
type GoalId = string & { readonly __brand: "GoalId" };
type TagId = string & { readonly __brand: "TagId" };

// Select types (read from DB)
type User = InferSelectModel<typeof users>;
type Trick = InferSelectModel<typeof tricks>;
type Setlist = InferSelectModel<typeof setlists>;
type SetlistTrick = InferSelectModel<typeof setlistTricks>;
type PracticeSession = InferSelectModel<typeof practiceSessions>;
type PracticeSessionTrick = InferSelectModel<typeof practiceSessionTricks>;
type Performance = InferSelectModel<typeof performances>;
type Item = InferSelectModel<typeof items>;
type ItemTrick = InferSelectModel<typeof itemTricks>;
type Goal = InferSelectModel<typeof goals>;
type Tag = InferSelectModel<typeof tags>;
type TrickTag = InferSelectModel<typeof trickTags>;
type PushSubscription = InferSelectModel<typeof pushSubscriptions>;
type UserPreference = InferSelectModel<typeof userPreferences>;

// Insert types (write to DB)
type NewUser = InferInsertModel<typeof users>;
type NewTrick = InferInsertModel<typeof tricks>;
type NewSetlist = InferInsertModel<typeof setlists>;
type NewPracticeSession = InferInsertModel<typeof practiceSessions>;
type NewPerformance = InferInsertModel<typeof performances>;
type NewItem = InferInsertModel<typeof items>;
type NewGoal = InferInsertModel<typeof goals>;
type NewTag = InferInsertModel<typeof tags>;

export type {
  Goal,
  GoalId,
  Item,
  ItemId,
  ItemTrick,
  NewGoal,
  NewItem,
  NewPerformance,
  NewPracticeSession,
  NewSetlist,
  NewTag,
  NewTrick,
  NewUser,
  Performance,
  PerformanceId,
  PracticeSession,
  PracticeSessionId,
  PracticeSessionTrick,
  PushSubscription,
  Setlist,
  SetlistId,
  SetlistTrick,
  Tag,
  TagId,
  Trick,
  TrickId,
  TrickTag,
  User,
  UserId,
  UserPreference,
};
