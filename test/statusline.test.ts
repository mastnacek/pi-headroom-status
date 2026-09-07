import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatCost,
  formatDetailedReport,
  formatStatusline,
  formatTokens,
  formatUptime,
} from "../src/statusline.js";
import type { HeadroomMetrics, HeadroomStatusConfig } from "../src/types.js";

describe("statusline formatting", () => {
  const sampleConfig: HeadroomStatusConfig = {
    enabled: true,
    host: "127.0.0.1",
    port: 8787,
    pollIntervalMs: 10000,
    format: "normal",
    showDollars: true,
    showTokens: true,
    showOffline: true,
    prefix: "⚡",
  };

  const sampleMetrics: HeadroomMetrics = {
    online: true,
    version: "0.37.0",
    uptimeSeconds: 3600,
    totalRequests: 5,
    tokensSaved: 18346,
    tokensBefore: 52837,
    tokensAfter: 34491,
    savingsPct: 34.7,
    costSavedUsd: 0.1835,
    schemaTokensSaved: 17614,
    messageTokensSaved: 732,
    activeModel: "claude-fable-5-1",
    source: "http",
    lastChecked: Date.now(),
  };

  it("formats tokens correctly", () => {
    assert.equal(formatTokens(0), "0");
    assert.equal(formatTokens(500), "500");
    assert.equal(formatTokens(18346), "18.3k");
    assert.equal(formatTokens(1250000), "1.25M");
  });

  it("formats cost correctly", () => {
    assert.equal(formatCost(0), "$0.00");
    assert.equal(formatCost(0.1835), "$0.18");
    assert.equal(formatCost(0.0042), "$0.0042");
  });

  it("formats uptime correctly", () => {
    assert.equal(formatUptime(45), "45s");
    assert.equal(formatUptime(125), "2m 5s");
    assert.equal(formatUptime(3665), "1h 1m");
  });

  it("renders statusline when online in normal format", () => {
    const text = formatStatusline(sampleMetrics, sampleConfig);
    assert.match(text, /Headroom:/);
    assert.match(text, /34\.7%/);
    assert.match(text, /-18\.3k/);
    assert.match(text, /\$0\.18/);
  });

  it("renders statusline in compact format", () => {
    const compactConfig: HeadroomStatusConfig = { ...sampleConfig, format: "compact" };
    const text = formatStatusline(sampleMetrics, compactConfig);
    assert.match(text, /34\.7%/);
    assert.doesNotMatch(text, /Headroom:/);
  });

  it("renders statusline in detailed format", () => {
    const detailedConfig: HeadroomStatusConfig = { ...sampleConfig, format: "detailed" };
    const text = formatStatusline(sampleMetrics, detailedConfig);
    assert.match(text, /v0\.37\.0/);
    assert.match(text, /5 reqs/);
  });

  it("renders offline statusline when proxy is down", () => {
    const offlineMetrics: HeadroomMetrics = {
      ...sampleMetrics,
      online: false,
      source: "offline",
    };
    const text = formatStatusline(offlineMetrics, sampleConfig);
    assert.match(text, /Headroom: offline/);
  });

  it("returns empty string when disabled", () => {
    const disabledConfig: HeadroomStatusConfig = { ...sampleConfig, enabled: false };
    assert.equal(formatStatusline(sampleMetrics, disabledConfig), "");
  });

  it("formats detailed markdown report", () => {
    const report = formatDetailedReport(sampleMetrics, sampleConfig);
    assert.match(report, /Headroom Context Optimization Status/);
    assert.match(report, /18,346/);
    assert.match(report, /Tool Schemas Pruned/);
  });
});
