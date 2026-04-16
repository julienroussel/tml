import { column, Schema, Table } from "@powersync/web";

const tricks = new Table({
  user_id: column.text,
  name: column.text,
  description: column.text,
  category: column.text,
  effect_type: column.text,
  difficulty: column.integer,
  status: column.text,
  duration: column.integer,
  performance_type: column.text,
  angle_sensitivity: column.text,
  props: column.text,
  music: column.text,
  // PostgreSQL text[] arrays are serialized as JSON strings by PowerSync.
  // Client code must JSON.parse() this value to get the array.
  languages: column.text,
  // PostgreSQL booleans are stored as integers (0/1) in SQLite.
  // Client code must convert to/from boolean.
  is_camera_friendly: column.integer,
  is_silent: column.integer,
  notes: column.text,
  source: column.text,
  video_url: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const tags = new Table({
  user_id: column.text,
  name: column.text,
  color: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const trick_tags = new Table({
  user_id: column.text,
  trick_id: column.text,
  tag_id: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const setlists = new Table({
  user_id: column.text,
  name: column.text,
  description: column.text,
  estimated_duration_minutes: column.integer,
  // PostgreSQL text[] arrays are serialized as JSON strings by PowerSync.
  // Client code must JSON.parse() this value to get the array.
  tags: column.text,
  language: column.text,
  environment: column.text,
  // PostgreSQL text[] arrays are serialized as JSON strings by PowerSync.
  // Client code must JSON.parse() this value to get the array.
  requirements: column.text,
  notes: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const setlist_tricks = new Table({
  user_id: column.text,
  setlist_id: column.text,
  trick_id: column.text,
  position: column.integer,
  transition_notes: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const practice_sessions = new Table({
  user_id: column.text,
  date: column.text,
  duration_minutes: column.integer,
  mood: column.integer,
  notes: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const practice_session_tricks = new Table({
  user_id: column.text,
  practice_session_id: column.text,
  trick_id: column.text,
  repetitions: column.integer,
  rating: column.integer,
  notes: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const performances = new Table({
  user_id: column.text,
  date: column.text,
  venue: column.text,
  event_name: column.text,
  setlist_id: column.text,
  audience_size: column.integer,
  audience_type: column.text,
  duration_minutes: column.integer,
  rating: column.integer,
  notes: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const items = new Table({
  user_id: column.text,
  name: column.text,
  type: column.text,
  description: column.text,
  brand: column.text,
  condition: column.text,
  location: column.text,
  notes: column.text,
  purchase_date: column.text,
  // Stored as text to preserve exact decimal precision (server uses numeric(10,2)).
  // Client code must parse this value as a number when displaying.
  purchase_price: column.text,
  quantity: column.integer,
  creator: column.text,
  url: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const item_tags = new Table({
  user_id: column.text,
  item_id: column.text,
  tag_id: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const item_tricks = new Table({
  user_id: column.text,
  item_id: column.text,
  trick_id: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

const goals = new Table({
  user_id: column.text,
  title: column.text,
  description: column.text,
  target_type: column.text,
  target_value: column.integer,
  current_value: column.integer,
  deadline: column.text,
  completed_at: column.text,
  trick_id: column.text,
  created_at: column.text,
  updated_at: column.text,
  deleted_at: column.text,
});

// Note: The following server-only tables are intentionally excluded from the
// client schema: users, user_preferences, and push_subscriptions.
// These are managed server-side (via ensureUserExists, server actions, and the
// Web Push API respectively) and never need to sync to the client.
export const appSchema = new Schema({
  tricks,
  tags,
  trick_tags,
  setlists,
  setlist_tricks,
  practice_sessions,
  practice_session_tricks,
  performances,
  items,
  item_tags,
  item_tricks,
  goals,
});
