import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { loadConfig } from "./src/config.js";
import { getHeadroomMetrics } from "./src/api.js";
import { formatDetailedReport, formatStatusline } from "./src/statusline.js";
import { registerHeadroomCommands } from "./src/commands.js";
import type { HeadroomMetrics, HeadroomStatusConfig } from "./src/types.js";

export default function headroomStatusExtension(pi: ExtensionAPI): void {
  let config: HeadroomStatusConfig = loadConfig(process.cwd());
  let metrics: HeadroomMetrics = {
    online: false,
    totalRequests: 0,
    tokensSaved: 0,
    tokensBefore: 0,
    tokensAfter: 0,
    savingsPct: 0,
    costSavedUsd: 0,
    schemaTokensSaved: 0,
    messageTokensSaved: 0,
    source: "offline",
    lastChecked: 0,
  };

  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function refresh(ctx?: ExtensionContext): Promise<void> {
    try {
      metrics = await getHeadroomMetrics(config);
      if (ctx?.hasUI) {
        ctx.ui.setStatus("headroom", formatStatusline(metrics, config));
      }
    } catch {
      // Non-fatal probe failure
    }
  }

  function startPolling(ctx?: ExtensionContext): void {
    stopPolling();
    if (config.enabled && config.pollIntervalMs > 0) {
      pollTimer = setInterval(() => {
        void refresh(ctx);
      }, config.pollIntervalMs);
    }
  }

  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // 1. Session Lifecycle
  pi.on("session_start", async (_event, ctx: ExtensionContext) => {
    config = loadConfig(ctx.cwd || process.cwd());
    await refresh(ctx);
    startPolling(ctx);
  });

  pi.on("turn_end", async (_event, ctx: ExtensionContext) => {
    await refresh(ctx);
  });

  pi.on("agent_settled", async (_event, ctx: ExtensionContext) => {
    await refresh(ctx);
  });

  pi.on("session_shutdown", async () => {
    stopPolling();
  });

  // 2. Register Slash Commands
  registerHeadroomCommands(
    pi,
    () => ({ config, metrics }),
    (newConfig, newMetrics) => {
      config = newConfig;
      metrics = newMetrics;
    }
  );

  // 3. Register Custom Agent Tool
  pi.registerTool({
    name: "headroom_status",
    label: "Headroom Status",
    description:
      "Inspect real-time Headroom context-compression metrics, token savings, cost avoided, and proxy status.",
    promptSnippet: "Check Headroom context optimization stats and token savings",
    parameters: Type.Object({
      refresh: Type.Optional(
        Type.Boolean({
          description: "Force immediate re-probe against Headroom proxy",
        })
      ),
      detailed: Type.Optional(
        Type.Boolean({
          description: "Return full markdown breakdown instead of summary object",
        })
      ),
    }),
    async execute(_toolCallId, params) {
      if (params.refresh) {
        metrics = await getHeadroomMetrics(config);
      }

      if (params.detailed) {
        return {
          content: [
            {
              type: "text",
              text: formatDetailedReport(metrics, config),
            },
          ],
          details: metrics,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Headroom: ${metrics.online ? "Online" : "Offline"} | Savings: ${metrics.savingsPct.toFixed(1)}% (${metrics.tokensSaved.toLocaleString()} tokens saved / $${metrics.costSavedUsd.toFixed(2)})`,
          },
        ],
        details: metrics,
      };
    },
  });
}
