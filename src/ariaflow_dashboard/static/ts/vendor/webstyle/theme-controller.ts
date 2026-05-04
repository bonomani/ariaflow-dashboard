/**
 * webstyle — headless theme controller.
 *
 * State machine for the three knobs every webstyle consumer ends up
 * re-implementing: theme (light/dark/auto-from-OS), a11y (AAA-leaning
 * palette on/off), and look (aurora/fluent/liquid). Persists to
 * localStorage, listens to `prefers-color-scheme` changes when in auto
 * mode, and reapplies the look on every change.
 *
 * Headless on purpose — no DOM widgets, just `subscribe()` + `set*()` /
 * `cycle*()` / `toggle*()`. Render the cycle button or palette switcher
 * however your app likes.
 *
 * Usage:
 *   import { applyLook } from "@bonomani/webstyle/looks";
 *   import { createThemeController } from "@bonomani/webstyle/theme-controller";
 *
 *   const theme = createThemeController({ apply: applyLook });
 *   theme.subscribe((s) => updateMyButton(s));
 *   document.querySelector("#theme-btn").addEventListener("click", theme.cycleMode);
 *
 * Tests: storage + matchMedia are injectable for headless test runs.
 */
import type { WsLook, WsTheme } from "./looks.ts";

/** Platform fingerprint we react to. "linux" / "other" both fall through
 * to the aurora default. */
export type WsPlatform = "windows" | "macos" | "linux" | "other";

/** Best-effort platform detection. Prefers the modern userAgentData
 * (Chromium 90+, Edge, Opera) and falls back to the userAgent string —
 * navigator.platform is deprecated and frozen on most browsers. Returns
 * "other" outside the browser (SSR / Node). */
export function detectPlatform(): WsPlatform {
  const nav = (globalThis as { navigator?: { userAgent?: string; userAgentData?: { platform?: string } } }).navigator;
  if (!nav) return "other";
  const hint = nav.userAgentData?.platform?.toLowerCase();
  const ua = (hint ?? nav.userAgent ?? "").toLowerCase();
  if (ua.includes("win")) return "windows";
  if (ua.includes("mac") || ua.includes("darwin")) return "macos";
  if (ua.includes("linux")) return "linux";
  return "other";
}

/** Platform → opinionated default look. Windows → fluent (matches the
 * Fluent UI structural defaults users already live with), macOS →
 * liquid (liquid-glass mirrors macOS Big Sur+ surfaces), everything
 * else → aurora (the neutral Aurora baseline). */
export function defaultLookForPlatform(p: WsPlatform = detectPlatform()): WsLook {
  switch (p) {
    case "windows": return "fluent";
    case "macos":   return "liquid";
    default:        return "aurora";
  }
}

export type ThemeMode = "light" | "dark" | "auto";

export interface ThemeState {
  /** User-facing setting: light / dark / auto (= follow OS). */
  mode: ThemeMode;
  /** Resolved theme actually applied (auto → resolved via matchMedia). */
  resolved: WsTheme;
  /** AAA-leaning color/alpha overrides on top of the look. */
  a11y: boolean;
  /** Aurora / Fluent / Liquid — controls structural CSS via data-palette. */
  look: WsLook;
}

/** Minimal subset of localStorage we use — lets tests pass an in-memory stub. */
export interface ThemeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Minimal subset of matchMedia we use. Exists on `window` in the
 *  browser; tests can pass a stub that returns `{ matches, addEventListener,
 *  removeEventListener }`. */
export interface MediaQueryLike {
  matches: boolean;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
}
export type MatchMediaLike = (query: string) => MediaQueryLike;

export type ApplyLookFn = (options: {
  look?: WsLook;
  theme?: WsTheme;
  a11y?: boolean;
  target?: HTMLElement;
}) => () => void;

export interface ThemeControllerOptions {
  /** The applyLook function from `@bonomani/webstyle/looks`. Injected
   *  rather than imported so this module stays free of any DOM/CSS
   *  side-effects when imported in non-browser contexts. */
  apply: ApplyLookFn;
  /** Where the look's data-palette / data-theme / inline tokens land.
   *  Default: `document.documentElement`. */
  target?: HTMLElement;
  /** Initial values, used only when nothing is persisted yet. */
  initialMode?: ThemeMode;          // default "auto"
  initialA11y?: boolean;            // default false
  initialLook?: WsLook;             // default "aurora"
  /** localStorage key. Default: "ws-theme-v1". Set to `null` to disable
   *  persistence entirely (e.g. SSR, a sandboxed iframe). */
  storageKey?: string | null;
  /** Storage backend. Defaults to `globalThis.localStorage` when present;
   *  pass `null` to opt out. */
  storage?: ThemeStorageLike | null;
  /** matchMedia override. Defaults to `globalThis.matchMedia`. Pass
   *  `null` to opt out (auto mode then resolves to dark by convention). */
  matchMedia?: MatchMediaLike | null;
}

const DEFAULT_KEY = "ws-theme-v1";

interface Persisted {
  mode?: ThemeMode;
  a11y?: boolean;
  look?: WsLook;
}

export interface ThemeController {
  getState(): ThemeState;
  getMode(): ThemeMode;
  setMode(mode: ThemeMode): void;
  cycleMode(): void;                // auto → light → dark → auto
  getA11y(): boolean;
  setA11y(v: boolean): void;
  toggleA11y(): void;
  getLook(): WsLook;
  setLook(look: WsLook): void;
  cycleLook(): void;                // aurora → fluent → liquid → aurora
  /** Subscribe to state changes. Fires synchronously on every set/toggle/cycle
   *  AND on system theme changes (when mode === "auto"). Returns an
   *  unsubscribe. */
  subscribe(fn: (state: ThemeState) => void): () => void;
  /** Stop listening to system theme changes and undo the last applyLook
   *  side effects. After destroy(), set/toggle/cycle become no-ops. */
  destroy(): void;
}

export function createThemeController(options: ThemeControllerOptions): ThemeController {
  const apply = options.apply;
  const target = options.target;
  const storageKey = options.storageKey === undefined ? DEFAULT_KEY : options.storageKey;
  const storage = resolveStorage(options.storage);
  const mql = resolveMatchMedia(options.matchMedia);

  const persisted = loadPersisted(storage, storageKey);
  let mode: ThemeMode = persisted.mode ?? options.initialMode ?? "auto";
  let a11y: boolean = persisted.a11y ?? options.initialA11y ?? false;
  let look: WsLook = persisted.look ?? options.initialLook ?? "aurora";

  let cleanup: () => void = () => {};
  let destroyed = false;
  const subscribers = new Set<(s: ThemeState) => void>();

  function resolveTheme(m: ThemeMode): WsTheme {
    if (m !== "auto") return m;
    return mql?.matches ? "light" : "dark";
  }

  function snapshot(): ThemeState {
    return { mode, resolved: resolveTheme(mode), a11y, look };
  }

  function commit(): void {
    if (destroyed) return;
    cleanup();
    cleanup = apply({ look, theme: resolveTheme(mode), a11y, target });
    save();
    const s = snapshot();
    for (const fn of subscribers) fn(s);
  }

  function save(): void {
    if (!storage || !storageKey) return;
    try {
      storage.setItem(storageKey, JSON.stringify({ mode, a11y, look } satisfies Persisted));
    } catch { /* quota / SSR / sandboxed — silent */ }
  }

  // System-theme listener (only fires the subscribers when mode === "auto").
  const onSystemChange = (): void => {
    if (mode === "auto") commit();
  };
  if (mql && typeof mql.addEventListener === "function") {
    mql.addEventListener("change", onSystemChange);
  }

  // Apply once at construction so the document reflects the initial state
  // immediately (consumer doesn't have to call set*() to bootstrap).
  commit();

  return {
    getState: snapshot,
    getMode: () => mode,
    setMode(next) { if (destroyed || next === mode) return; mode = next; commit(); },
    cycleMode() {
      const next: ThemeMode = mode === "auto" ? "light" : mode === "light" ? "dark" : "auto";
      this.setMode(next);
    },
    getA11y: () => a11y,
    setA11y(v) { if (destroyed || v === a11y) return; a11y = v; commit(); },
    toggleA11y() { this.setA11y(!a11y); },
    getLook: () => look,
    setLook(next) { if (destroyed || next === look) return; look = next; commit(); },
    cycleLook() {
      const order: WsLook[] = ["aurora", "fluent", "liquid"];
      const i = order.indexOf(look);
      this.setLook(order[(i + 1) % order.length]!);
    },
    subscribe(fn) {
      subscribers.add(fn);
      // Fire once immediately so the subscriber sees the current state
      // without needing to call getState() separately.
      fn(snapshot());
      return () => { subscribers.delete(fn); };
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (mql && typeof mql.removeEventListener === "function") {
        mql.removeEventListener("change", onSystemChange);
      }
      cleanup();
      subscribers.clear();
    },
  };
}

function resolveStorage(s: ThemeStorageLike | null | undefined): ThemeStorageLike | null {
  if (s === null) return null;
  if (s !== undefined) return s;
  // Best-effort access to globalThis.localStorage. SSR / sandboxed iframes
  // throw on first read of the property, hence the try/catch.
  try {
    const ls = (globalThis as { localStorage?: ThemeStorageLike }).localStorage;
    return ls ?? null;
  } catch { return null; }
}

function resolveMatchMedia(m: MatchMediaLike | null | undefined): MediaQueryLike | null {
  if (m === null) return null;
  const fn = m ?? (globalThis as { matchMedia?: MatchMediaLike }).matchMedia;
  if (typeof fn !== "function") return null;
  try { return fn("(prefers-color-scheme: light)"); } catch { return null; }
}

function loadPersisted(storage: ThemeStorageLike | null, key: string | null): Persisted {
  if (!storage || !key) return {};
  try {
    const raw = storage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Persisted;
    const out: Persisted = {};
    if (parsed.mode === "light" || parsed.mode === "dark" || parsed.mode === "auto") out.mode = parsed.mode;
    if (typeof parsed.a11y === "boolean") out.a11y = parsed.a11y;
    if (parsed.look === "aurora" || parsed.look === "fluent" || parsed.look === "liquid") out.look = parsed.look;
    return out;
  } catch { return {}; }
}
