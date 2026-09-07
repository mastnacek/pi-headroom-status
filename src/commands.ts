import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import { exec } from "node:child_process";
import { saveConfig } from "./config.js";
import { getHeadroomMetrics } from "./api.js";
import {
  formatDetailedReport,
  formatSessionReport,
  formatStatusline,
  ANSI_BOLD,
  ANSI_CYAN,
  ANSI_GREEN,
  ANSI_DIM,
  ANSI_RESET,
} from "./statusline.js";
import type {
  HeadroomMetrics,
  HeadroomSessionMetrics,
  HeadroomStatusConfig,
} from "./types.js";

const COMMAND_DOCS = {
  session: "show savings and token reduction for current session only",
  status: "display detailed headroom metrics and compression statistics",
  savings: "show token reduction and cost savings breakdown",
  dashboard: "open Headroom web dashboard in browser",
  refresh: "force immediate re-probe and update statusline",
  scope: "switch statusline badge scope (session | lifetime)",
  "reset-session": "reset current session baseline counter to now",
  on: "enable statusline badge display",
  off: "disable statusline badge display",
  format: "set statusline format (compact | normal | detailed)",
  port: "configure proxy port (default: 8787)",
  help: "display command reference and help banner",
} as const;

export function buildHelpText(
  config: HeadroomStatusConfig,
  metrics: HeadroomMetrics,
): string {
  const statusBadge = metrics.online
    ? `${ANSI_BOLD}${ANSI_GREEN}● Online${ANSI_RESET} (:${config.port})`
    : `${ANSI_BOLD}${ANSI_DIM}○ Offline${ANSI_RESET}`;

  const enabledBadge = config.enabled
    ? `${ANSI_BOLD}${ANSI_GREEN}● Enabled${ANSI_RESET}`
    : `${ANSI_BOLD}${ANSI_DIM}○ Disabled${ANSI_RESET}`;

  const sessionSaved = metrics.session?.tokensSaved ?? 0;
  const sessionPct = (metrics.session?.savingsPct ?? 0).toFixed(1);
  const sessionCost = (metrics.session?.costSavedUsd ?? 0).toFixed(2);

  return [
    `${ANSI_BOLD}${ANSI_CYAN}⚡ pi-headroom-status${ANSI_RESET} — Context Optimization Statusline Suite`,
    `Real-time Headroom proxy monitoring, token savings tracking, and statusline badge.`,
    ``,
    `${ANSI_BOLD}Commands & Subcommands:${ANSI_RESET}`,
    `  /headroom session            — show savings and token reduction for current session`,
    `  /headroom status             — show full metrics, uptime, and compression report`,
    `  /headroom savings            — view detailed token savings & cost avoidance`,
    `  /headroom dashboard          — open web dashboard (http://${config.host}:${config.port}/dashboard)`,
    `  /headroom refresh            — force immediate stats probe & statusline update`,
    `  /headroom scope <type>       — switch badge scope (session | lifetime)`,
    `  /headroom reset-session      — reset session baseline counter to now`,
    `  /headroom on | off           — toggle statusline display (${enabledBadge})`,
    `  /headroom format <type>      — set badge format (compact | normal | detailed)`,
    `  /headroom port <number>      — set Headroom proxy port (current: ${config.port})`,
    `  /headroom help               — display this reference guide`,
    ``,
    `${ANSI_DIM}Tip: Append --global to any setting command to persist across all sessions.${ANSI_RESET}`,
    ``,
    `${ANSI_BOLD}Current Runtime Overview:${ANSI_RESET}`,
    `  • Proxy: ${statusBadge} | Statusline: ${enabledBadge} | Scope: ${ANSI_BOLD}${ANSI_CYAN}${config.scope}${ANSI_RESET} | Format: ${ANSI_BOLD}${ANSI_CYAN}${config.format}${ANSI_RESET}`,
    `  • Session Savings: ${ANSI_BOLD}${ANSI_GREEN}${sessionPct}%${ANSI_RESET} (${sessionSaved.toLocaleString()} tokens · $${sessionCost})`,
    `  • Lifetime Savings: ${ANSI_BOLD}${ANSI_GREEN}${metrics.savingsPct.toFixed(1)}%${ANSI_RESET} (${metrics.tokensSaved.toLocaleString()} tokens · $${metrics.costSavedUsd.toFixed(2)})`,
  ].join("\n");
}

export function openDashboard(host: string, port: number): void {
  const url = `http://${host}:${port}/dashboard`;
  let startCmd = `xdg-open "${url}"`;
  if (process.platform === "win32") {
    startCmd = `start "" "${url}"`;
  } else if (process.platform === "darwin") {
    startCmd = `open "${url}"`;
  }

  exec(startCmd);
}

export function registerHeadroomCommands(
  pi: ExtensionAPI,
  getState: () => { config: HeadroomStatusConfig; metrics: HeadroomMetrics },
  updateState: (config: HeadroomStatusConfig, metrics: HeadroomMetrics) => void,
  computeSession?: (
    lifetime: HeadroomMetrics,
  ) => HeadroomSessionMetrics | undefined,
  resetSession?: (lifetime: HeadroomMetrics) => void,
): void {
  const getCompletions = async (
    prefix: string,
  ): Promise<AutocompleteItem[] | null> => {
    const tokens = prefix.split(/\s+/).filter(Boolean);
    const trailingSpace = /\s$/.test(prefix);
    const normalizedPrefix = tokens.join(" ").toLowerCase();

    // 2nd Token Completion
    if (tokens.length > 1 || (trailingSpace && tokens.length === 1)) {
      const cmd = tokens[0]?.toLowerCase();

      if (cmd === "format") {
        const formats = [
          {
            value: "format compact",
            label: "format compact",
            description: "Minimal percentage badge",
          },
          {
            value: "format normal",
            label: "format normal",
            description: "Standard percentage and token diff",
          },
          {
            value: "format detailed",
            label: "format detailed",
            description: "Full badge with version & requests",
          },
        ];
        const filtered = formats.filter((i) =>
          i.value.toLowerCase().startsWith(normalizedPrefix),
        );
        return filtered.length > 0 ? filtered : null;
      }

      if (cmd === "scope") {
        const scopes = [
          {
            value: "scope session",
            label: "scope session",
            description: "Show token savings for current Pi session",
          },
          {
            value: "scope lifetime",
            label: "scope lifetime",
            description: "Show total lifetime proxy savings",
          },
        ];
        const filtered = scopes.filter((i) =>
          i.value.toLowerCase().startsWith(normalizedPrefix),
        );
        return filtered.length > 0 ? filtered : null;
      }

      if (
        [
          "on",
          "off",
          "refresh",
          "dashboard",
          "status",
          "savings",
          "session",
          "reset-session",
        ].includes(cmd || "")
      ) {
        const flags = [
          {
            value: `${cmd} --global`,
            label: `${cmd} --global`,
            description: "Apply setting globally",
          },
        ];
        const filtered = flags.filter((i) =>
          i.value.toLowerCase().startsWith(normalizedPrefix),
        );
        return filtered.length > 0 ? filtered : null;
      }

      return null;
    }

    // 1st Token Completion (Subcommands from Dictionary)
    const typed = (tokens[0] ?? "").toLowerCase();
    const items: AutocompleteItem[] = [];
    for (const [value, description] of Object.entries(COMMAND_DOCS)) {
      if (value.toLowerCase().startsWith(typed)) {
        items.push({ value, label: value, description });
      }
    }

    return items.length > 0 ? items : null;
  };

  const commandHandler = async (
    args: string,
    ctx: ExtensionCommandContext,
  ): Promise<void> => {
    const trimmed = args.trim();
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    const isGlobal = tokens.some((t) => t.toLowerCase() === "--global");
    const cleanTokens = tokens.filter((t) => t.toLowerCase() !== "--global");

    const subcommand = (cleanTokens[0] ?? "").toLowerCase();
    const value = cleanTokens.slice(1).join(" ").trim();

    let { config, metrics } = getState();

    // Help banner (default on empty or help)
    if (!subcommand || ["help", "-h", "--help"].includes(subcommand)) {
      metrics = await getHeadroomMetrics(config);
      if (computeSession) metrics.session = computeSession(metrics);
      updateState(config, metrics);
      ctx.ui.notify(buildHelpText(config, metrics), "info");
      return;
    }

    switch (subcommand) {
      case "session": {
        metrics = await getHeadroomMetrics(config);
        if (computeSession) metrics.session = computeSession(metrics);
        updateState(config, metrics);
        ctx.ui.notify(formatSessionReport(metrics, config), "info");
        break;
      }

      case "reset-session": {
        metrics = await getHeadroomMetrics(config);
        if (resetSession) resetSession(metrics);
        if (computeSession) metrics.session = computeSession(metrics);
        updateState(config, metrics);
        if (ctx.hasUI) {
          ctx.ui.setStatus("headroom", formatStatusline(metrics, config));
        }
        ctx.ui.notify(
          "⚡ Headroom session baseline reset to current moment.",
          "info",
        );
        break;
      }

      case "status":
      case "savings": {
        metrics = await getHeadroomMetrics(config);
        if (computeSession) metrics.session = computeSession(metrics);
        updateState(config, metrics);
        ctx.ui.notify(formatDetailedReport(metrics, config), "info");
        break;
      }

      case "dashboard": {
        openDashboard(config.host, config.port);
        ctx.ui.notify(
          `Opening Headroom dashboard at http://${config.host}:${config.port}/dashboard ...`,
          "info",
        );
        break;
      }

      case "refresh": {
        metrics = await getHeadroomMetrics(config);
        if (computeSession) metrics.session = computeSession(metrics);
        updateState(config, metrics);
        if (ctx.hasUI) {
          ctx.ui.setStatus("headroom", formatStatusline(metrics, config));
        }
        const activePct =
          config.scope === "session" && metrics.session
            ? metrics.session.savingsPct
            : metrics.savingsPct;
        const activeTokens =
          config.scope === "session" && metrics.session
            ? metrics.session.tokensSaved
            : metrics.tokensSaved;
        ctx.ui.notify(
          `⚡ Headroom stats refreshed: ${activePct.toFixed(1)}% savings (${activeTokens.toLocaleString()} tokens saved)`,
          "info",
        );
        break;
      }

      case "scope": {
        if (value !== "session" && value !== "lifetime") {
          ctx.ui.notify(
            `Invalid scope "${value}". Choose: session | lifetime`,
            "warning",
          );
          return;
        }
        config = saveConfig(ctx.cwd, { scope: value }, isGlobal);
        metrics = await getHeadroomMetrics(config);
        if (computeSession) metrics.session = computeSession(metrics);
        updateState(config, metrics);
        if (ctx.hasUI) {
          ctx.ui.setStatus("headroom", formatStatusline(metrics, config));
        }
        ctx.ui.notify(
          `⚡ Headroom statusline scope set to "${value}"${isGlobal ? " (globally)" : ""}.`,
          "info",
        );
        break;
      }

      case "on": {
        config = saveConfig(ctx.cwd, { enabled: true }, isGlobal);
        metrics = await getHeadroomMetrics(config);
        if (computeSession) metrics.session = computeSession(metrics);
        updateState(config, metrics);
        if (ctx.hasUI) {
          ctx.ui.setStatus("headroom", formatStatusline(metrics, config));
        }
        ctx.ui.notify(
          `⚡ Headroom statusline enabled${isGlobal ? " (globally)" : ""}.`,
          "info",
        );
        break;
      }

      case "off": {
        config = saveConfig(ctx.cwd, { enabled: false }, isGlobal);
        updateState(config, metrics);
        if (ctx.hasUI) {
          ctx.ui.setStatus("headroom", "");
        }
        ctx.ui.notify(
          `⚡ Headroom statusline disabled${isGlobal ? " (globally)" : ""}.`,
          "info",
        );
        break;
      }

      case "format": {
        if (value !== "compact" && value !== "normal" && value !== "detailed") {
          ctx.ui.notify(
            `Invalid format "${value}". Choose: compact | normal | detailed`,
            "warning",
          );
          return;
        }
        config = saveConfig(ctx.cwd, { format: value }, isGlobal);
        metrics = await getHeadroomMetrics(config);
        if (computeSession) metrics.session = computeSession(metrics);
        updateState(config, metrics);
        if (ctx.hasUI) {
          ctx.ui.setStatus("headroom", formatStatusline(metrics, config));
        }
        ctx.ui.notify(
          `Format set to "${value}"${isGlobal ? " (globally)" : ""}.`,
          "info",
        );
        break;
      }

      case "port": {
        const portNum = parseInt(value, 10);
        if (Number.isNaN(portNum) || portNum <= 0 || portNum > 65535) {
          ctx.ui.notify(
            `Invalid port "${value}". Must be a number between 1 and 65535.`,
            "warning",
          );
          return;
        }
        config = saveConfig(ctx.cwd, { port: portNum }, isGlobal);
        metrics = await getHeadroomMetrics(config);
        if (computeSession) metrics.session = computeSession(metrics);
        updateState(config, metrics);
        if (ctx.hasUI) {
          ctx.ui.setStatus("headroom", formatStatusline(metrics, config));
        }
        ctx.ui.notify(
          `Headroom port set to ${portNum}${isGlobal ? " (globally)" : ""}.`,
          "info",
        );
        break;
      }

      default:
        ctx.ui.notify(
          `Unknown subcommand "${subcommand}". Use: /headroom help`,
          "warning",
        );
        break;
    }
  };

  pi.registerCommand("headroom", {
    description: "Manage Headroom context optimization and statusline display",
    getArgumentCompletions: getCompletions,
    handler: commandHandler,
  });

  pi.registerCommand("headroom-status", {
    description: "Alias for /headroom status",
    getArgumentCompletions: getCompletions,
    handler: commandHandler,
  });
}
