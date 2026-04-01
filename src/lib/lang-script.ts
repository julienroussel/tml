import { locales } from "@/i18n/config";

/**
 * Blocking inline script that corrects `<html lang>` before first paint.
 *
 * Mirrors the next-themes anti-flicker pattern: runs synchronously in `<body>`
 * before React hydration so screen readers and assistive technology announce
 * the correct language from the very first frame.
 *
 * Detection order:
 * 1. URL path segment (marketing pages: /fr, /es/faq, etc.)
 * 2. NEXT_LOCALE cookie (app and auth pages)
 * 3. Fallback: keep the SSR default ("en")
 *
 * @see https://github.com/julienroussel/tml/issues/124
 */
export const LANG_SCRIPT = `(function(){try{var v=[${locales.map((l) => `"${l}"`).join(",")}];var m=location.pathname.match(/^\\/([a-z]{2})(\\/|$)/);if(m&&v.indexOf(m[1])!==-1){document.documentElement.lang=m[1];return}var c=document.cookie.match(/(?:^|;\\s*)NEXT_LOCALE=([^;]*)/);if(c&&v.indexOf(c[1])!==-1){document.documentElement.lang=c[1]}}catch(e){}})()`;
