// Backend DTOs consumed by the dashboard.
//
// Source of truth: ../ariaflow-server/openapi.yaml. This file is the
// frontend's typed view of those payloads; gaps in the backend
// contract are tracked in BACKEND_GAPS_REQUESTED_BY_FRONTEND.md.
//
// Most fields are still `unknown` — the migration ports app.js with
// `@ts-nocheck` first; precise field-level typing happens during the
// planned split into typed component modules.

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

// Generic wrapper used by `_fetch()` in app.ts.
export interface ApiEnvelope<T = unknown> {
  ok?: boolean;
  error?: string;
  data?: T;
  [k: string]: unknown;
}

// GET /api/status — top-level snapshot driving most of the dashboard.
export interface StatusResponse {
  active?: DownloadItem[];
  waiting?: DownloadItem[];
  stopped?: DownloadItem[];
  global?: GlobalStat | null;
  session_id?: string | null;
  session_closed_at?: string | null;
  [k: string]: unknown;
}

export interface DownloadItem {
  gid?: string;
  status?: DownloadStatus;
  totalLength?: string | number;
  completedLength?: string | number;
  uploadLength?: string | number;
  downloadSpeed?: string | number;
  uploadSpeed?: string | number;
  numSeeders?: string | number;
  connections?: string | number;
  errorCode?: string;
  errorMessage?: string;
  files?: DownloadFile[];
  bittorrent?: { info?: { name?: string } };
  [k: string]: unknown;
}

export interface DownloadFile {
  path?: string;
  length?: string | number;
  completedLength?: string | number;
  uris?: { uri?: string; status?: string }[];
  [k: string]: unknown;
}

export type DownloadStatus =
  | 'active'
  | 'waiting'
  | 'paused'
  | 'error'
  | 'complete'
  | 'removed'
  | string;

export interface GlobalStat {
  downloadSpeed?: string | number;
  uploadSpeed?: string | number;
  numActive?: string | number;
  numWaiting?: string | number;
  numStopped?: string | number;
  [k: string]: unknown;
}

// GET /api/lifecycle — converged/queued/missing summary.
export interface LifecycleResponse {
  items?: LifecycleItem[];
  summary?: Record<string, number>;
  [k: string]: unknown;
}

export interface LifecycleItem {
  name?: string;
  url?: string;
  status?: string;
  reason?: string;
  [k: string]: unknown;
}

// GET /api/declaration — the user's declared download list.
export interface DeclarationResponse {
  items?: DeclarationItem[];
  [k: string]: unknown;
}

export interface DeclarationItem {
  name?: string;
  url?: string;
  enabled?: boolean;
  [k: string]: unknown;
}

// GET /api/bandwidth — measured + configured caps.
export interface BandwidthResponse {
  measured?: { download?: number; upload?: number };
  caps?: { download?: number | string; upload?: number | string };
  [k: string]: unknown;
}
