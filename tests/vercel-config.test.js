import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Vercel routing", () => {
  it("keeps SPA deep links without capturing server API functions", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8"));
    const fallback = config.rewrites.find(
      (rewrite) => rewrite.destination === "/index.html"
    );
    const source = new RegExp(`^${fallback.source}$`);

    expect(source.test("/login")).toBe(true);
    expect(source.test("/produtos/123")).toBe(true);
    expect(source.test("/api/health")).toBe(false);
    expect(source.test("/api/stripe-webhook")).toBe(false);
  });
});
