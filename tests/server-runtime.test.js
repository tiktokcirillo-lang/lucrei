import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("server runtime dependencies", () => {
  it("loads Firebase Admin without experimental CommonJS-to-ESM support", () => {
    const result = spawnSync(
      process.execPath,
      [
        "--no-experimental-require-module",
        "-e",
        "require('firebase-admin/auth')",
      ],
      { encoding: "utf8" },
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });
});
