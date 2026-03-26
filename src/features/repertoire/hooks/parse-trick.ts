import type { TrickId } from "@/db/types";
import {
  ANGLE_SENSITIVITIES,
  type AngleSensitivity,
  PERFORMANCE_TYPES,
  type PerformanceType,
  TRICK_STATUSES,
  type TrickStatus,
} from "../constants";
import type { ParsedTrick } from "../types";

/** Raw row shape returned by SQLite — snake_case, JSON-encoded arrays, integer booleans. */
export interface TrickRow {
  angle_sensitivity: string | null;
  category: string | null;
  created_at: string;
  description: string | null;
  difficulty: number | null;
  duration: number | null;
  effect_type: string | null;
  id: string;
  is_camera_friendly: number | null;
  is_silent: number | null;
  languages: string | null;
  music: string | null;
  name: string;
  notes: string | null;
  performance_type: string | null;
  props: string | null;
  source: string | null;
  status: string;
  updated_at: string;
  video_url: string | null;
}

/**
 * Safely parses a JSON-encoded string array. Returns an empty array on
 * null input or malformed JSON so the UI never sees a parse error.
 */
export function parseLanguages(raw: string | null): string[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

/** Converts a SQLite integer (0/1/null) to a JS boolean or null. */
export function intToBoolean(value: number | null): boolean | null {
  if (value === null) {
    return null;
  }
  return value !== 0;
}

function isTrickStatus(value: string): value is TrickStatus {
  return (TRICK_STATUSES as readonly string[]).includes(value);
}

function isPerformanceType(value: string): value is PerformanceType {
  return (PERFORMANCE_TYPES as readonly string[]).includes(value);
}

function isAngleSensitivity(value: string): value is AngleSensitivity {
  return (ANGLE_SENSITIVITIES as readonly string[]).includes(value);
}

/** Validates a raw status string from SQLite against known statuses. */
function parseStatus(raw: string): TrickStatus {
  return isTrickStatus(raw) ? raw : "new";
}

/** Validates a raw performance type string from SQLite. Returns null for unknown values. */
function parsePerformanceType(raw: string | null): PerformanceType | null {
  return raw !== null && isPerformanceType(raw) ? raw : null;
}

/** Validates a raw angle sensitivity string from SQLite. Returns null for unknown values. */
function parseAngleSensitivity(raw: string | null): AngleSensitivity | null {
  return raw !== null && isAngleSensitivity(raw) ? raw : null;
}

/** Maps a raw SQLite row to a camelCase `ParsedTrick` with native JS types. */
export function parseTrickRow(row: TrickRow): ParsedTrick {
  return {
    id: row.id as TrickId,
    name: row.name,
    description: row.description,
    category: row.category,
    effectType: row.effect_type,
    difficulty: row.difficulty,
    status: parseStatus(row.status),
    duration: row.duration,
    performanceType: parsePerformanceType(row.performance_type),
    angleSensitivity: parseAngleSensitivity(row.angle_sensitivity),
    props: row.props,
    music: row.music,
    languages: parseLanguages(row.languages),
    isCameraFriendly: intToBoolean(row.is_camera_friendly),
    isSilent: intToBoolean(row.is_silent),
    notes: row.notes,
    source: row.source,
    videoUrl: row.video_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
