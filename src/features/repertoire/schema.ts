import { z } from "zod";
import {
  ANGLE_SENSITIVITIES,
  PERFORMANCE_TYPES,
  TRICK_STATUSES,
} from "./constants";

const HTTPS_URL_RE = /^https:\/\//i;

const trickFormSchema = z.object({
  // The Basics
  name: z
    .string()
    .trim()
    .min(1, "validation.nameRequired")
    .max(200, "validation.nameTooLong"),
  description: z
    .string()
    .trim()
    .max(2000, "validation.descriptionTooLong")
    .optional()
    .default(""),
  category: z.string().trim().max(100).optional().default(""),
  effectType: z.string().trim().max(100).optional().default(""),
  // Performance
  difficulty: z.coerce
    .number()
    .int()
    .min(1)
    .max(5)
    .nullable()
    .optional()
    .default(null),
  status: z.enum(TRICK_STATUSES).default("new"),
  duration: z.coerce
    .number()
    .int()
    .min(0)
    .max(7200)
    .nullable()
    .optional()
    .default(null),
  performanceType: z
    .enum(PERFORMANCE_TYPES)
    .nullable()
    .optional()
    .default(null),
  angleSensitivity: z
    .enum(ANGLE_SENSITIVITIES)
    .nullable()
    .optional()
    .default(null),
  // Show Setup
  props: z.string().trim().max(1000).optional().default(""),
  music: z.string().trim().max(200).optional().default(""),
  languages: z.array(z.string().trim().max(50)).max(10).optional().default([]),
  isCameraFriendly: z.boolean().nullable().optional().default(null),
  isSilent: z.boolean().nullable().optional().default(null),
  // Reference
  source: z.string().trim().max(500).optional().default(""),
  videoUrl: z
    .string()
    .trim()
    .max(2000, "validation.videoUrlTooLong")
    .refine(
      (val) => val === "" || (URL.canParse(val) && HTTPS_URL_RE.test(val)),
      { message: "validation.invalidUrl" }
    )
    .optional()
    .default(""),
  // Organization (tags handled via junction table, not in this schema)
  notes: z.string().trim().max(5000).optional().default(""),
});

type TrickFormValues = z.infer<typeof trickFormSchema>;
type TrickFormInput = z.input<typeof trickFormSchema>;

const tagFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "validation.tagNameRequired")
    .max(50, "validation.tagNameTooLong"),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .nullable()
    .optional()
    .default(null),
});

type TagFormValues = z.infer<typeof tagFormSchema>;

export type { TagFormValues, TrickFormInput, TrickFormValues };
export { tagFormSchema, trickFormSchema };
