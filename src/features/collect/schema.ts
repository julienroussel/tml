import { z } from "zod";
import { ITEM_CONDITIONS, ITEM_TYPES } from "./constants";

const HTTPS_URL_RE = /^https:\/\//i;
const PRICE_RE = /^\d{1,7}(\.\d{0,2})?$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const itemFormSchema = z.object({
  // Essentials
  name: z
    .string()
    .trim()
    .min(1, "validation.nameRequired")
    .max(200, "validation.nameTooLong"),
  type: z.enum(ITEM_TYPES),
  description: z
    .string()
    .trim()
    .max(2000, "validation.descriptionTooLong")
    .optional()
    .default(""),

  // Details
  brand: z.string().trim().max(200).optional().default(""),
  creator: z.string().trim().max(200).optional().default(""),
  condition: z.enum(ITEM_CONDITIONS).nullable().optional().default(null),
  location: z.string().trim().max(200).optional().default(""),
  quantity: z.coerce
    .number()
    .int()
    .min(0, "validation.quantityMin")
    .max(9999, "validation.quantityMax")
    .optional()
    .default(1),

  // Purchase
  purchaseDate: z
    .string()
    .trim()
    .refine((val) => val === "" || ISO_DATE_RE.test(val), {
      message: "validation.invalidDate",
    })
    .optional()
    .default(""),
  purchasePrice: z
    .string()
    .trim()
    .refine((val) => val === "" || (PRICE_RE.test(val) && Number(val) >= 0), {
      message: "validation.invalidPrice",
    })
    .optional()
    .default(""),

  // Reference
  url: z
    .string()
    .trim()
    .max(2000, "validation.urlTooLong")
    // Lowercase only the scheme so the DB CHECK (LIKE 'https://%') accepts
    // values where the user typed "HTTPS://" — the path/query is preserved
    // as-is to avoid changing case-sensitive query strings or fragments.
    .transform((val) =>
      HTTPS_URL_RE.test(val)
        ? `${val.slice(0, 8).toLowerCase()}${val.slice(8)}`
        : val
    )
    .refine(
      (val) => {
        if (val === "") {
          return true;
        }
        if (!(HTTPS_URL_RE.test(val) && URL.canParse(val))) {
          return false;
        }
        const parsed = new URL(val);
        // Reject URLs with no host (e.g. bare "https://").
        if (parsed.hostname.length === 0) {
          return false;
        }
        // Reject userinfo (e.g. https://user:pass@evil.com) — a common
        // phishing trick that obscures the real host from casual inspection.
        if (parsed.username !== "" || parsed.password !== "") {
          return false;
        }
        // Reject IDN/punycode hosts (e.g. https://xn--pple-43d.com mimicking
        // apple.com) to block homograph phishing. Trade-off: legitimate IDN
        // URLs are rejected too — for a personal-inventory feature the set
        // of valid punycode references is essentially zero.
        if (parsed.hostname.toLowerCase().includes("xn--")) {
          return false;
        }
        return true;
      },
      { message: "validation.invalidUrl" }
    )
    .optional()
    .default(""),

  // Organization (tags and tricks handled via junction tables, not in this schema)
  notes: z.string().trim().max(5000).optional().default(""),
});

type ItemFormValues = z.infer<typeof itemFormSchema>;

export type { ItemFormValues };
export { itemFormSchema };
