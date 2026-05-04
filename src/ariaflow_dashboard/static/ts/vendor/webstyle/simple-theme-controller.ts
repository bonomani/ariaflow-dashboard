/**
 * webstyle — simple theme controller.
 *
 * Stripped-down sibling of theme-controller.ts: the user only picks the
 * mode (light / dark / auto). The look is auto-detected from the platform
 * and frozen for the controller's lifetime — windows → fluent,
 * everything else → liquid. No a11y axis.
 *
 * Use this when the host app wants OS-native styling out of the box and
 * doesn't expose a look picker or accessibility toggle in its UI.
 *
 * Usage:
 *   import { applyLook } from "@bonomani/webstyle/looks";
 *   import { createSimpleThemeController } from "@bonomani/webstyle/simple-theme-controller";
 *
 *   const theme = createSimpleThemeController({ apply: applyLook });
 *   document.querySelector("#theme-btn").addEventListener("click", theme.cycleMode);
 */
import type { WsLook, WsTheme } from "./looks.ts";
import {
  detectPlatform,
  type ApplyLookFn,
  type MatchMediaLike,
  type MediaQueryLike,
  type ThemeMode,
  type ThemeStorageLike,
  type WsPlatform,
} from "./theme-controller.ts";

/** Platform → look for the simple controller. Windows gets Fluent (matches
 *  the structural defaults Windows users live with); everything else gets
 *  Liquid (the macOS-leaning glass surface that also reads well on Linux). */
export function simpleLookForPlatform(p: WsPlatform = detectPlatform()): WsLook {
  return p === "windows" ? "fluent" : "liquid";
}

export interface SimpleThemeState {
  mode: ThemeMode;
  resolved: WsTheme;
  look: WsLook;
}

export interface SimpleThemeControllerOptions {
  apply: ApplyLookFn;
  target?: HTMLElement;
  initialMode?: ThemeMode;          // default "auto"
  storageKey?: string | null;       // default "ws-simple-theme-v1"
  storage?: ThemeStorageLike | null;
  matchMedia?: MatchMediaLike | null;
}

export interface SimpleThemeController {
  getState(): SimpleThemeState;
  getMode(): ThemeMode;
  setMode(mode: ThemeMode): void;
  cycleMode(): void;                // auto → light → dark → auto
  getLook(): WsLook;
  subscribe(fn: (state: SimpleThemeState) => void): () => void;
  destroy(): void;
}

const DEFAULT_KEY = "ws-simple-theme-v1";

interface Persisted { mode?: ThemeMode }

export function createSimpleThemeController(
  options: SimpleThemeControllerOptions,
): SimpleThemeController {
  const apply = options.apply;
  const target = options.target;
  const storageKey = options.storageKey === undefined ? DEFAULT_KEY : options.storageKey;
  const storage = resolveStorage(options.storage);
  const mql = resolveMatchMedia(options.matchMedia);
  const look = simpleLookForPlatform();

  const persisted = loadPersisted(storage, storageKey);
  let mode: ThemeMode = persisted.mode ?? options.initialMode ?? "auto";

  let cleanup: () => void = () => {};
  let destroyed = false;
  const subscribers = new Set<(s: SimpleThemeState) => void>();

  function resolveTheme(m: ThemeMode): WsTheme {
    if (m !== "auto") return m;
    return mql?.matches ? "light" : "dark";
  }

  function snapshot(): SimpleThemeState {
    return { mode, resolved: resolveTheme(mode), look };
  }

  function commit(): void {
    if (destroyed) return;
    cleanup();
    cleanup = apply({ look, theme: resolveTheme(mode), target });
    save();
    const s = snapshot();
    for (const fn of subscribers) fn(s);
  }

  function save(): void {
    if (!storage || !storageKey) return;
    try {
      storage.setItem(storageKey, JSON.stringify({ mode } satisfies Persisted));
    } catch { /* quota / SSR / sandboxed — silent */ }
  }

  const onSystemChange = (): void => { if (mode === "auto") commit(); };
  if (mql && typeof mql.addEventListener === "function") {
    mql.addEventListener("change", onSystemChange);
  }

  commit();

  return {
    getState: snapshot,
    getMode: () => mode,
    setMode(next) { if (destroyed || next === mode) return; mode = next; commit(); },
    cycleMode() {
      const next: ThemeMode = mode === "auto" ? "light" : mode === "light" ? "dark" : "auto";
      this.setMode(next);
    },
    getLook: () => look,
    subscribe(fn) {
      subscribers.add(fn);
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
    if (parsed.mode === "light" || parsed.mode === "dark" || parsed.mode === "auto") {
      return { mode: parsed.mode };
    }
    return {};
  } catch { return {}; }
}
