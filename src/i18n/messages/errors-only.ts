import type { AbstractIntlMessages } from "next-intl";

import type { Locale } from "@/i18n/config";

import de from "./de.json";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import it from "./it.json";
import nl from "./nl.json";
import pt from "./pt.json";

/**
 * Only the `errors` namespace from each locale — used by the root error
 * boundary so it doesn't pull the full ~97KB locale bundle into the client.
 */
export const errorMessages: Record<Locale, AbstractIntlMessages> = {
  de: { errors: de.errors },
  en: { errors: en.errors },
  es: { errors: es.errors },
  fr: { errors: fr.errors },
  it: { errors: it.errors },
  nl: { errors: nl.errors },
  pt: { errors: pt.errors },
};
