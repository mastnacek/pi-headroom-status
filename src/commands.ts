import type {
  ExtensionAPI,
  ExtensionCommandContext,
} from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import { exec } from "node:child_process";
import { DEFAULT_CONFIG, loadConfig, saveConfig } from "./config.js";
import { getHeadroomMetrics } from "./api.js";
import {
  formatDetailedReport,
  formatStatusline,
  ANSI_BOLD,
  ANSI_CYAN,
  ANSI_GREEN,
  ANSI_DIM,
  ANSI_YELLOW,
  ANSI_RESET,
} from "./statusline.js";
import type { HeadroomMetrics, HeadroomStatusConfig } from "./types.js";

const COMMAND_DOCS: Record<string, string> = {
  status: "display detailed headroom metrics and compression statistics",
  savings: "show token reduction and cost savings breakdown",
  dashboard: "open Headroom web dashboard in browser",
  refresh: "force immediate re-probe and update statusline",
  on: "enable statusline badge display",
  off: "disable statusline badge display",
  format: "set statusline format (compact | normal | detailed)",
  port: "configure proxy port (default: 8787)",
  help: "display command reference and help banner",
};

export function buildHelpText(
  config: HeadroomStatusConfig,
  metrics: HeadroomMetrics
): string {
  const statusBadge = metrics.online
    ? `${ANSI_BOLD}${ANSI_GREEN}● Online${ANSI_RESET} (:${config.port})`
    : `${ANSI_BOLD}${ANSI_DIM}○ Offline${ANSI_RESET}`;

  const enabledBadge = config.enabled
    ? `${ANSI_BOLD}${ANSI_GREEN}● Enabled${ANSI_RESET}`
    : `${ANSI_BOLD}${ANSI_DIM}○ Disabled${ANSI_RESET}`;

  return [
    `${ANSI_BOLD}${ANSI_CYAN}⚡ pi-headroom-status${ANSI_RESET} — Context Optimization Statusline Suite`,
    `Real-time Headroom proxy monitoring, token savings tracking, and statusline badge.`,
    ``,
    `${ANSI_BOLD}Commands & Subcommands:${ANSI_RESET}`,
    `  /headroom status             — show full metrics, uptime, and compression report`,
    `  /headroom savings            — view detailed token savings & cost avoidance`,
    `  /headroom dashboard          — open web dashboard (http://${config.host}:${config.port}/dashboard)`,
    `  /headroom refresh            — force immediate stats probe & statusline update`,
    `  /headroom on | off           — toggle statusline display (${enabledBadge})`,
    `  /headroom format <type>      — set badge format (compact | normal | detailed)`,
    `  /headroom port <number>      — set Headroom proxy port (current: ${config.port})`,
    `  /headroom help               — display this reference guide`,
    ``,
    `${ANSI_DIM}Tip: Append --global to any setting command to persist across all sessions.${ANSI_RESET}`,
    ``,
    `${ANSI_BOLD}Current Runtime Overview:${ANSI_RESET}`,
    `  • Proxy: ${statusBadge} | Statusline: ${enabledBadge} | Format: ${ANSI_BOLD}${ANSI_CYAN}${config.format}${ANSI_RESET}`,
    `  • Savings: ${ANSI_BOLD}${ANSI_GREEN}${metrics.savingsPct.toFixed(1)}%${ANSI_RESET} (${metrics.tokensSaved.toLocaleString()} tokens · $${metrics.costSavedUsd.toFixed(2)})`,
  ].join("\n");
}

export function openDashboard(host: string, port: number): void {
  const url = `http://${host}:${port}/dashboard`;
  const startCmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
      ? `open "${url}"`
      : `xdg-open "${url}"`;

  exec(startCmd, (err) => {
    if (err) {
      console.error("[pi-headroom-status] Failed to launch browser:", err);
    }
  });
}

export function registerHeadroomCommands(
  pi: ExtensionAPI,
  getState: () => { config: HeadroomStatusConfig; metrics: HeadroomMetrics },
  updateState: (config: HeadroomStatusConfig, metrics: HeadroomMetrics) => void
): void {
  const getCompletions = async (
    prefix: string
  ): Promise<AutocompleteItem[] | null> => {
    const tokens = prefix.split(/\s+/).filter(Boolean);
    const trailingSpace = /\s$/.test(prefix);
    const normalizedPrefix = tokens.join(" ").toLowerCase();

    // 2nd Token Completion
    if (tokens.length > 1 || (trailingSpace && tokens.length === 1)) {
      const cmd = tokens[0]?.toLowerCase();

      if (cmd === "format") {
        const formats = [
          { value: "format compact", label: "format compact", description: "Minimal percentage badge" },
          { value: "format normal", label: "format normal", description: "Standard percentage and token diff" },
          { value: "format detailed", label: "format detailed", description: "Full badge with version & requests" },
        ];
        const filtered = formats.filter((i) =>
          i.value.toLowerCase().startsWith(normalizedPrefix)
        );
        return filtered.length > 0 ? filtered : null;
      }

      if (["on", "off", "refresh", "dashboard", "status", "savings"].includes(cmd || "")) {
        const flags = [
          { value: `${cmd} --global`, label: `${cmd} --global`, description: "Apply setting globally" },
        ];
        const filtered = flags.filter((i) =>
          i.value.toLowerCase().startsWith(normalizedPrefix)
        );
        return filtered.length > 0 ? filtered : null;
      }

      return null;
    }

    // 1st Token Completion (Subcommands from Dictionary)
    const typed = (tokens[0] ?? "").toLowerCase();
    const items = Object.entries(COMMAND_DOCS)
      .filter(([key]) => key.toLowerCase().startsWith(typed))
      .map(([value, description]) => ({ value, label: value, description }));

    return items.length > 0 ? items : null;
  };

  const commandHandler = async (
    args: string,
    ctx: ExtensionCommandContext
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
      updateState(config, metrics);
      ctx.ui.notify(buildHelpText(config, metrics), "info");
      return;
    }

    switch (subcommand) {
      case "status":
      case "savings": {
        metrics = await getHeadroomMetrics(config);
        updateState(config, metrics);
        ctx.ui.notify(formatDetailedReport(metrics, config), "info");
        break;
      }

      case "dashboard": {
        openDashboard(config.host, config.port);
        ctx.ui.notify(
          `Opening Headroom dashboard at http://${config.host}:${config.port}/dashboard ...`,
          "info"
        );
        break;
      }

      case "refresh": {
        metrics = await getHeadroomMetrics(config);
        updateState(config, metrics);
        if (ctx.hasUI) {
          ctx.ui.setStatus("headroom", formatStatusline(metrics, config));
        }
        ctx.ui.notify(
          `⚡ Headroom stats refreshed: ${metrics.savingsPct.toFixed(1)}% savings (${metrics.tokensSaved.toLocaleString()} tokens saved)`,
          "info"
        );
        break;
      }

      case "on": {
        config = saveConfig(ctx.cwd, { enabled: true }, isGlobal);
        metrics = await getHeadroomMetrics(config);
        updateState(config, metrics);
        if (ctx.hasUI) {
          ctx.ui.setStatus("headroom", formatStatusline(metrics, config));
        }
        ctx.ui.notify(`⚡ Headroom statusline enabled${isGlobal ? " (globally)" : ""}.`, "info");
        break;
      }

      case "off": {
        config = saveConfig(ctx.cwd, { enabled: false }, isGlobal);
        updateState(config, metrics);
        if (ctx.hasUI) {
          ctx.ui.setStatus("headroom", "");
        }
        ctx.ui.notify(`⚡ Headroom statusline disabled${isGlobal ? " (globally)" : ""}.`, "info");
        break;
      }

      case "format": {
        const validFormats: Array<HeadroomStatusConfig["format"]> = [
          "compact",
          "normal",
          "detailed",
        ];
        if (!validFormats.includes(value as any)) {
          ctx.ui.notify(
            `Invalid format "${value}". Choose: compact | normal | detailed`,
            "warning"
          );
          return;
        }
        config = saveConfig(
          ctx.cwd,
          { format: value as HeadroomStatusConfig["format"] },
          isGlobal
        );
        updateState(config, metrics);
        if (ctx.hasUI) {
          ctx.ui.setStatus("headroom", formatStatusline(metrics, config));
        }
        ctx.ui.notify(`Format set to "${value}"${isGlobal ? " (globally)" : ""}.`, "info");
        break;
      }

      case "port": {
        const portNum = parseInt(value, 10);
        if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
          ctx.ui.notify(`Invalid port "${value}". Must be a number between 1 and 65535.`, "warning");
          return;
        }
        config = saveConfig(ctx.cwd, { port: portNum }, isGlobal);
        metrics = await getHeadroomMetrics(config);
        updateState(config, metrics);
        if (ctx.hasUI) {
          ctx.ui.setStatus("headroom", formatStatusline(metrics, config));
        }
        ctx.ui.notify(`Headroom port set to ${portNum}${isGlobal ? " (globally)" : ""}.`, "info");
        break;
      }

      default:
        ctx.ui.notify(
          `Unknown subcommand "${subcommand}". Use: /headroom help`,
          "warning"
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
