import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface ComparisonResult {
  extraKeys: string[];
  locale: string;
  missingKeys: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getNestedKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];

  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (isRecord(value)) {
      keys.push(...getNestedKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
}

function compareLocale(
  referenceKeys: string[],
  localeKeys: string[],
  locale: string
): ComparisonResult {
  const refSet = new Set(referenceKeys);
  const locSet = new Set(localeKeys);

  const missingKeys: string[] = [];
  const extraKeys: string[] = [];

  for (const key of refSet) {
    if (!locSet.has(key)) {
      missingKeys.push(key);
    }
  }

  for (const key of locSet) {
    if (!refSet.has(key)) {
      extraKeys.push(key);
    }
  }

  return { extraKeys, locale, missingKeys };
}

function checkI18nCompleteness(messagesDir: string): ComparisonResult[] {
  const files = readdirSync(messagesDir).filter((file) =>
    file.endsWith(".json")
  );

  const enFile = files.find((file) => file === "en.json");
  if (!enFile) {
    console.error("Reference file en.json not found in", messagesDir);
    process.exit(1);
  }

  const enParsed: unknown = JSON.parse(
    readFileSync(join(messagesDir, enFile), "utf-8")
  );
  if (!isRecord(enParsed)) {
    throw new Error(`Invalid JSON structure in ${join(messagesDir, enFile)}`);
  }
  const enContent = enParsed;
  const referenceKeys = getNestedKeys(enContent);

  const results: ComparisonResult[] = [];

  for (const file of files) {
    if (file === "en.json") {
      continue;
    }

    const locale = file.replace(".json", "");
    const localeParsed: unknown = JSON.parse(
      readFileSync(join(messagesDir, file), "utf-8")
    );
    if (!isRecord(localeParsed)) {
      throw new Error(`Invalid JSON structure in ${join(messagesDir, file)}`);
    }
    const localeContent = localeParsed;
    const localeKeys = getNestedKeys(localeContent);

    results.push(compareLocale(referenceKeys, localeKeys, locale));
  }

  return results;
}

export type { ComparisonResult };
export { checkI18nCompleteness, compareLocale, getNestedKeys };

const isMainModule = process.argv[1]?.endsWith("check-i18n.ts");

if (isMainModule) {
  const messagesDir = resolve(
    import.meta.dirname ?? ".",
    "../src/i18n/messages"
  );

  console.log("Checking i18n completeness...\n");
  console.log(`Messages directory: ${messagesDir}\n`);

  const results = checkI18nCompleteness(messagesDir);
  let hasErrors = false;

  for (const result of results) {
    const isComplete =
      result.missingKeys.length === 0 && result.extraKeys.length === 0;

    if (isComplete) {
      console.log(`  ${result.locale}: OK`);
    } else {
      hasErrors = true;
      console.log(`  ${result.locale}: ISSUES FOUND`);

      if (result.missingKeys.length > 0) {
        console.log("    Missing keys:");
        for (const key of result.missingKeys) {
          console.log(`      - ${key}`);
        }
      }

      if (result.extraKeys.length > 0) {
        console.log("    Extra keys:");
        for (const key of result.extraKeys) {
          console.log(`      - ${key}`);
        }
      }
    }
  }

  console.log();

  if (hasErrors) {
    console.log("i18n check failed. Please fix the issues above.");
    process.exit(1);
  } else {
    console.log("All locales are complete.");
    process.exit(0);
  }
}
