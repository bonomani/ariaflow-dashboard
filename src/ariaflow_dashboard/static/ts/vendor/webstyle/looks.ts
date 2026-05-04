/**
 * webstyle — looks with default mood baked in.
 *
 * Three looks, each with the mood the demo associates with it:
 *   aurora → mood "pro"    (slate accent, subtle status, tightened alphas)
 *   fluent → mood "fluent" (= the empty mood in MOODS: Aurora colors,
 *                            fluent structural overrides via data-palette="fluent")
 *   liquid → mood "liquid" (sky+20° accent ≈ macOS systemBlue,
 *                            liquid-glass structure via data-palette="liquid-glass")
 *
 * Color/alpha tokens are precomputed by scripts/compute-pro.js from the
 * MOODS definition in examples/index.html. Structural tokens (radii,
 * easing, shadows, blur) come from CSS via :root[data-palette="..."]
 * — applyLook() sets that attribute so the CSS rules kick in.
 *
 * Regenerate after a palette/mood change:
 *   node scripts/compute-pro.js
 */
import type { WsToken } from "./webstyle";

export type WsLook = "aurora" | "fluent" | "liquid";

/** Look name → CSS data-palette value. The CSS uses "liquid-glass" for
 * the structural overrides; we expose the shorter "liquid" in the API. */
const PALETTE_FOR_LOOK: Record<WsLook, string> = {
  aurora: "aurora",
  fluent: "fluent",
  liquid: "liquid-glass",
};
export type WsTheme = "dark" | "light";
export type WsLookTokens = Partial<Record<WsToken, string>>;

export const LOOK_TOKENS: Record<WsLook, Record<WsTheme, WsLookTokens>> = {
  aurora: {
    dark: {
      "--ws-accent-rgb": "153 162 175",
      "--ws-accent-on": "#ffffff",
      "--ws-good-rgb": "180 239 198",
      "--ws-warn-rgb": "251 235 157",
      "--ws-danger-rgb": "240 186 185",
      "--ws-info-rgb": "223 221 220",
      "--ws-alpha-idle": "0.042",
      "--ws-alpha-hover": "0.072",
      "--ws-alpha-active": "0.108",
      "--ws-alpha-inactive": "0.33",
      "--ws-alpha-border-soft": "0.15",
      "--ws-alpha-border-medium": "0.21",
      "--ws-alpha-border-strong": "0.24",
      "--ws-alpha-border-heavy": "0.3",
      "--ws-alpha-glow": "0.21",
      "--ws-alpha-glow-soft": "0.072",
      "--ws-alpha-shadow": "0.21",
      "--ws-alpha-shadow-overlay": "0.3",
    },
    light: {
      "--ws-accent-rgb": "76 85 97",
      "--ws-accent-on": "#ffffff",
      "--ws-good-rgb": "61 112 73",
      "--ws-warn-rgb": "148 87 57",
      "--ws-danger-rgb": "146 63 55",
      "--ws-info-rgb": "59 56 54",
      "--ws-alpha-idle": "0.03",
      "--ws-alpha-hover": "0.06",
      "--ws-alpha-active": "0.108",
      "--ws-alpha-inactive": "0.33",
      "--ws-alpha-border-soft": "0.15",
      "--ws-alpha-border-medium": "0.18",
      "--ws-alpha-border-strong": "0.18",
      "--ws-alpha-border-heavy": "0.3",
      "--ws-alpha-glow": "0.21",
      "--ws-alpha-glow-soft": "0.072",
      "--ws-alpha-shadow": "0.048",
      "--ws-alpha-shadow-overlay": "0.096",
    },
  },
  fluent: {
    // "fluent" mood = empty mood in MOODS: no color/alpha overrides,
    // Aurora baseline applies. Structural overrides (radii, easing,
    // shadows, blur) come from the :root[data-palette="fluent"] CSS rule.
    dark: {},
    light: {},
  },
  liquid: {
    // Liquid mood = sky shifted +20° (≈ macOS systemBlue). Status
    // colors and alphas stay at Aurora baseline.
    dark: {
      "--ws-accent-rgb": "123 203 255",
      "--ws-accent-on": "#0a0a0a",
    },
    light: {
      "--ws-accent-rgb": "65 102 177",
      "--ws-accent-on": "#ffffff",
    },
  },
};

/** AAA-leaning color/alpha tokens. Look-independent — when a11y is
 *  enabled these replace the look's defaults, but the look still
 *  controls structural CSS (radii, blur, easing) via data-palette. */
export const A11Y_TOKENS: Record<WsTheme, WsLookTokens> = {
  dark: {
    "--ws-accent-rgb": "140 164 197",
    "--ws-accent-on": "#ffffff",
    "--ws-good-rgb": "56 255 160",
    "--ws-warn-rgb": "255 235 0",
    "--ws-danger-rgb": "255 160 164",
    "--ws-info-rgb": "232 227 224",
    "--ws-alpha-idle": "0.105",
    "--ws-alpha-hover": "0.18",
    "--ws-alpha-active": "0.27",
    "--ws-alpha-inactive": "0.825",
    "--ws-alpha-border-soft": "0.375",
    "--ws-alpha-border-medium": "0.525",
    "--ws-alpha-border-strong": "0.6",
    "--ws-alpha-border-heavy": "0.75",
    "--ws-alpha-glow": "0.525",
    "--ws-alpha-glow-soft": "0.18",
    "--ws-alpha-shadow": "0.525",
    "--ws-alpha-shadow-overlay": "0.75",
  },
  light: {
    "--ws-accent-rgb": "63 85 117",
    "--ws-accent-on": "#ffffff",
    "--ws-good-rgb": "0 71 0",
    "--ws-warn-rgb": "180 0 0",
    "--ws-danger-rgb": "139 0 0",
    "--ws-info-rgb": "16 11 6",
    "--ws-alpha-idle": "0.075",
    "--ws-alpha-hover": "0.15",
    "--ws-alpha-active": "0.27",
    "--ws-alpha-inactive": "0.825",
    "--ws-alpha-border-soft": "0.375",
    "--ws-alpha-border-medium": "0.45",
    "--ws-alpha-border-strong": "0.45",
    "--ws-alpha-border-heavy": "0.75",
    "--ws-alpha-glow": "0.525",
    "--ws-alpha-glow-soft": "0.18",
    "--ws-alpha-shadow": "0.12",
    "--ws-alpha-shadow-overlay": "0.24",
  },
};

/** Get the resolved token map for one (look, theme) pair.
 *  When a11y is true, returns A11Y_TOKENS[theme] (look-independent
 *  AAA-leaning palette). The look still controls structural CSS via
 *  data-palette — only color/alpha tokens swap. */
export function lookTokens(
  look: WsLook = "aurora",
  theme: WsTheme = "dark",
  a11y = false,
): WsLookTokens {
  return a11y ? A11Y_TOKENS[theme] : LOOK_TOKENS[look][theme];
}

/**
 * Apply a look to an element (default: <html>). Sets data-palette so
 * the look's structural CSS rules engage, sets data-theme for light
 * theme, and writes the resolved color/alpha overrides as inline
 * custom properties. Returns a cleanup that reverses everything.
 *
 * Pass `a11y: true` to swap color/alpha tokens for the AAA-leaning
 * "contrast" mood (look's structural CSS still applies).
 */
export function applyLook(
  options: {
    look?: WsLook;
    theme?: WsTheme;
    a11y?: boolean;
    target?: HTMLElement;
  } = {},
): () => void {
  const look = options.look ?? "aurora";
  const theme = options.theme ?? "dark";
  const a11y = options.a11y ?? false;
  const el = options.target ?? document.documentElement;
  const tokens = lookTokens(look, theme, a11y);

  const prevPalette = el.dataset.palette;
  const prevTheme = el.dataset.theme;

  // aurora is the CSS default — leaving data-palette unset is correct,
  // but setting it explicitly is harmless and makes the state visible.
  el.dataset.palette = PALETTE_FOR_LOOK[look];
  if (theme === "light") el.dataset.theme = "light";
  else delete el.dataset.theme;

  for (const [k, v] of Object.entries(tokens)) {
    el.style.setProperty(k, v as string);
  }

  return () => {
    for (const k of Object.keys(tokens)) el.style.removeProperty(k);
    if (prevPalette === undefined) delete el.dataset.palette;
    else el.dataset.palette = prevPalette;
    if (prevTheme === undefined) delete el.dataset.theme;
    else el.dataset.theme = prevTheme;
  };
}

/** Inline-style object for React: `<html style={lookStyle()} />`.
 *  Note: this returns only the color/alpha tokens. data-palette /
 *  data-theme attributes still need to be set separately for the
 *  structural CSS rules to apply. */
export function lookStyle(
  look: WsLook = "aurora",
  theme: WsTheme = "dark",
  a11y = false,
): Record<string, string> {
  return { ...lookTokens(look, theme, a11y) } as Record<string, string>;
}
