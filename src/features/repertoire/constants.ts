const TRICK_STATUSES = [
  "new",
  "learning",
  "performance_ready",
  "mastered",
  "shelved",
] as const;

type TrickStatus = (typeof TRICK_STATUSES)[number];

interface StatusConfig {
  readonly label: string;
  readonly variant: "default" | "secondary" | "destructive" | "outline";
}

const STATUS_CONFIG = {
  new: { label: "status.new", variant: "outline" },
  learning: { label: "status.learning", variant: "default" },
  performance_ready: {
    label: "status.performance_ready",
    variant: "secondary",
  },
  mastered: { label: "status.mastered", variant: "default" },
  shelved: { label: "status.shelved", variant: "outline" },
} as const satisfies Record<TrickStatus, StatusConfig>;

const ANGLE_SENSITIVITIES = ["none", "slight", "moderate", "high"] as const;

type AngleSensitivity = (typeof ANGLE_SENSITIVITIES)[number];

const PERFORMANCE_TYPES = [
  "close_up",
  "parlor",
  "stage",
  "street",
  "virtual",
] as const;

type PerformanceType = (typeof PERFORMANCE_TYPES)[number];

const SUGGESTED_CATEGORIES = [
  "Card",
  "Coin",
  "Mentalism",
  "Stage",
  "Close-up",
  "Manipulation",
  "Parlor",
  "Street",
  "Comedy",
  "Kids",
] as const;

const SUGGESTED_EFFECT_TYPES = [
  "Vanish",
  "Production",
  "Transformation",
  "Transposition",
  "Prediction",
  "Levitation",
  "Restoration",
  "Penetration",
  "Appearance",
  "Escape",
] as const;

const DIFFICULTY_LABELS = [
  "Beginner",
  "Easy",
  "Intermediate",
  "Advanced",
  "Expert",
] as const;

const MAX_TAGS_PER_TRICK = 20;

export type { AngleSensitivity, PerformanceType, TrickStatus };
export {
  ANGLE_SENSITIVITIES,
  DIFFICULTY_LABELS,
  MAX_TAGS_PER_TRICK,
  PERFORMANCE_TYPES,
  STATUS_CONFIG,
  SUGGESTED_CATEGORIES,
  SUGGESTED_EFFECT_TYPES,
  TRICK_STATUSES,
};
