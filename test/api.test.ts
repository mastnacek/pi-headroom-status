import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getHeadroomMetrics } from "../src/api.js";
import { DEFAULT_CONFIG } from "../src/config.js";

describe("api metrics extraction", () => {
  it("extracts metrics from mock HTTP responses", async () => {
    const mockFetch = (async (url: string | URL | Request) => {
      const u = url.toString();
      if (u.endsWith("/health")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "healthy",
            version: "0.37.0",
            uptime_seconds: 120,
          }),
        } as Response;
      }
      if (u.endsWith("/stats")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            summary: {
              compression: {
                total_tokens_removed: 2000,
                total_tokens_before: 10000,
                tool_schema_tokens_saved: 1500,
              },
              cost: {
                total_saved_usd: 0.05,
              },
            },
            requests: { total: 4 },
          }),
        } as Response;
      }
      throw new Error(`Unexpected url ${u}`);
    }) as typeof fetch;

    const mockDiskEmpty = () => ({
      totalRequests: 0,
      tokensSaved: 0,
      tokensBefore: 0,
      tokensAfter: 0,
      costSavedUsd: 0,
    });

    const metrics = await getHeadroomMetrics(DEFAULT_CONFIG, mockFetch, mockDiskEmpty);
    assert.equal(metrics.online, true);
    assert.equal(metrics.version, "0.37.0");
    assert.equal(metrics.uptimeSeconds, 120);
    assert.equal(metrics.tokensSaved, 2000);
    assert.equal(metrics.tokensBefore, 10000);
    assert.equal(metrics.savingsPct, 20.0);
    assert.equal(metrics.costSavedUsd, 0.05);
    assert.equal(metrics.schemaTokensSaved, 1500);
    assert.equal(metrics.source, "http");
  });

  it("handles offline gracefully", async () => {
    const mockFailingFetch = (async () => {
      throw new Error("Connection refused");
    }) as typeof fetch;

    const mockDiskEmpty = () => ({
      totalRequests: 0,
      tokensSaved: 0,
      tokensBefore: 0,
      tokensAfter: 0,
      costSavedUsd: 0,
    });

    const metrics = await getHeadroomMetrics(DEFAULT_CONFIG, mockFailingFetch, mockDiskEmpty);
    assert.equal(metrics.online, false);
    assert.match(metrics.error || "", /Connection refused/);
  });
});
