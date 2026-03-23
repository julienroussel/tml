const themes = ["light", "dark", "system"] as const;
type Theme = (typeof themes)[number];

function isTheme(value: string): value is Theme {
  return (themes as readonly string[]).includes(value);
}

export type { Theme };
export { isTheme, themes };
