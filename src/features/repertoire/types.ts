/**
 * Parsed types for repertoire data read from local SQLite via PowerSync.
 *
 * These mirror the server-side Drizzle schema but use camelCase field names
 * and native JS types (booleans instead of 0/1, string[] instead of JSON).
 */

import type { TagId, TrickId } from "@/db/types";
import type {
  AngleSensitivity,
  PerformanceType,
  TrickStatus,
} from "./constants";

export interface ParsedTrick {
  angleSensitivity: AngleSensitivity | null;
  category: string | null;
  createdAt: string;
  description: string | null;
  difficulty: number | null;
  duration: number | null;
  effectType: string | null;
  id: TrickId;
  isCameraFriendly: boolean | null;
  isSilent: boolean | null;
  languages: string[];
  music: string | null;
  name: string;
  notes: string | null;
  performanceType: PerformanceType | null;
  props: string | null;
  source: string | null;
  status: TrickStatus;
  updatedAt: string;
  videoUrl: string | null;
}

export interface ParsedTag {
  color: string | null;
  id: TagId;
  name: string;
}

export interface TrickWithTags extends ParsedTrick {
  tags: ParsedTag[];
}
