// biome-ignore lint/performance/noBarrelFile: schema barrel file is intentional for Drizzle config
export { goals } from "./goals";
// TODO: Add Neon RLS policies to enforce user_id = auth.uid() on all user-owned tables
export { items, itemTricks } from "./items";
export { performances } from "./performances";
export {
  practiceSessions,
  practiceSessionTricks,
} from "./practice-sessions";
export { pushSubscriptions } from "./push-subscriptions";
export { routines, routineTricks } from "./routines";
export { tricks } from "./tricks";
export { userPreferences } from "./user-preferences";
export { users } from "./users";
