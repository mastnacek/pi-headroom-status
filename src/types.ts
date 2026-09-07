export interface HeadroomStatusConfig {
  /** Enable statusline display */
  enabled: boolean;
  /** Headroom proxy host (default: 127.0.0.1) */
  host: string;
  /** Headroom proxy port (default: 8787) */
  port: number;
  /** Polling interval in milliseconds (default: 10000, 0 disables background polling) */
  pollIntervalMs: number;
  /** Display format: compact | normal | detailed */
  format: "compact" | "normal" | "detailed";
  /** Include estimated USD savings in statusline */
  showDollars: boolean;
  /** Include token savings in statusline */
  showTokens: boolean;
  /** Show badge when proxy is offline */
  showOffline: boolean;
  /** Icon/prefix before statusline text (default: ⚡) */
  prefix: string;
}

export interface HeadroomHealthResponse {
  service?: string;
  status?: string;
  ready?: boolean;
  version?: string;
  uptime_seconds?: number;
}

export interface HeadroomSavingsEvent {
  v?: number;
  ts?: string;
  before?: number;
  after?: number;
  saved?: number;
  cost_usd?: number;
  model?: string;
  client?: string;
  source?: string;
  pid?: number;
}

export interface HeadroomMetrics {
  online: boolean;
  version?: string;
  uptimeSeconds?: number;
  totalRequests: number;
  tokensSaved: number;
  tokensBefore: number;
  tokensAfter: number;
  savingsPct: number;
  costSavedUsd: number;
  schemaTokensSaved: number;
  messageTokensSaved: number;
  activeModel?: string;
  source: "http" | "events" | "offline";
  lastChecked: number;
  error?: string;
}
