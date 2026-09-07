import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import type { HeadroomStatusConfig } from "./types.js";

export const DEFAULT_CONFIG: HeadroomStatusConfig = {
  enabled: true,
  host: "127.0.0.1",
  port: 8787,
  pollIntervalMs: 10000,
  format: "normal",
  scope: "session",
  showDollars: true,
  showTokens: true,
  showOffline: true,
  prefix: "⚡",
};

export const GLOBAL_CONFIG_PATH = join(
  homedir(),
  ".pi",
  "agent",
  "headroom-status.json",
);

export function getProjectConfigPath(cwd: string): string {
  return resolve(cwd, ".pi", "headroom-status.json");
}

export function loadConfig(cwd: string): HeadroomStatusConfig {
  const candidates = [
    getProjectConfigPath(cwd),
    resolve(cwd, ".pi", "headroom-config.json"),
    GLOBAL_CONFIG_PATH,
    join(homedir(), ".pi", "agent", "headroom-config.json"),
  ];

  let config = { ...DEFAULT_CONFIG };

  // Read global first, then override with project config if exists
  for (let i = candidates.length - 1; i >= 0; i--) {
    const file = candidates[i];
    if (file && existsSync(file)) {
      try {
        const raw = readFileSync(file, "utf8");
        const parsed = JSON.parse(raw);
        // Map legacy headroom-config.json format if detected
        if (parsed.proxy) {
          if (parsed.proxy.host) parsed.host = parsed.proxy.host;
          if (parsed.proxy.port) parsed.port = parsed.proxy.port;
        }
        config = { ...config, ...parsed };
      } catch {
        // Non-fatal parse fallback
      }
    }
  }

  return config;
}

export function saveConfig(
  cwd: string,
  updates: Partial<HeadroomStatusConfig>,
  isGlobal = false,
): HeadroomStatusConfig {
  const current = loadConfig(cwd);
  const next = { ...current, ...updates };

  const targetPath = isGlobal ? GLOBAL_CONFIG_PATH : getProjectConfigPath(cwd);
  try {
    mkdirSync(dirname(targetPath), { recursive: true });
    const tempPath = `${targetPath}.${Date.now()}.tmp`;
    writeFileSync(tempPath, JSON.stringify(next, null, 2), "utf8");
    try {
      renameSync(tempPath, targetPath);
    } catch {
      writeFileSync(targetPath, JSON.stringify(next, null, 2), "utf8");
    }
  } catch (err) {
    console.error(
      "[pi-headroom-status] Failed to save config:",
      targetPath,
      err,
    );
  }

  return next;
}
