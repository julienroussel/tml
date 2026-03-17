---
name: i18n-add
description: "Add translation keys across all 7 locale files (en, fr, es, pt, it, de, nl). Handles namespace creation, ICU plurals, and completeness checks. Use when adding UI strings or creating components with user-facing text."
user-invocable: true
---

# i18n — Add Translation Keys

Run this skill when adding new user-facing strings to the app.

## Steps

### 1. Determine the keys to add
Identify:
- **Namespace**: Which feature/page? (`common`, `improve`, `plan`, `perform`, `train`, `enhance`, `collect`, `nav`, `settings`, `auth`, etc.)
- **Key name**: Use camelCase (`logPractice`, `deleteConfirm`, `itemCount`)
- **English value**: The base string. Use ICU MessageFormat for plurals: `"{count, plural, one {# trick} other {# tricks}}"`

### 2. Add to all 7 locale files
Edit each file in `src/i18n/messages/`:

| File | Locale |
|------|--------|
| `en.json` | English (default — always add first) |
| `fr.json` | French |
| `es.json` | Spanish |
| `pt.json` | Portuguese |
| `it.json` | Italian |
| `de.json` | German |
| `nl.json` | Dutch |

For each locale, add the key under the correct namespace object. Translate the value appropriately for each language.

### 3. Use in components

**Server Components:**
```tsx
import { useTranslations } from 'next-intl';
export default function Page() {
  const t = useTranslations('improve');
  return <h1>{t('title')}</h1>;
}
```

**Client Components:**
```tsx
'use client';
import { useTranslations } from 'next-intl';
export function MyComponent() {
  const t = useTranslations('common');
  return <button>{t('save')}</button>;
}
```

### 4. Verify completeness
```bash
pnpm i18n:check
```
This validates all locales have matching keys. Fix any missing keys before committing.

## Key Naming Convention
- Namespaced: `"common.save"`, `"improve.logPractice"`, `"nav.dashboard"`
- Use camelCase for keys
- Group by feature/page, with `common` for shared strings

## What to Translate
- UI strings, labels, buttons, placeholders
- Error messages, validation messages
- Public marketing content
- Email templates, notifications
- Metadata (titles, descriptions)

## What NOT to Translate
- User-generated content
- URL slugs
- Code/logs
- Database values
