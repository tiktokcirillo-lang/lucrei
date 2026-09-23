import { describe, expect, it } from "vitest";
import { isValidContent, isValidMessages } from "./anthropic";

describe("Anthropic request validation", () => {
  it("accepts the receipt scanner payload", () => {
    expect(
      isValidMessages([
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: "abc123",
              },
            },
            { type: "text", text: "Extraia os itens deste cupom." },
          ],
        },
      ])
    ).toBe(true);
  });

  it("rejects unsupported content and multiple images", () => {
    expect(isValidContent([{ type: "tool", name: "unexpected" }])).toBe(false);
    expect(
      isValidContent([
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "a" } },
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "b" } },
      ])
    ).toBe(false);
  });

  it("rejects oversized and invalid conversations", () => {
    expect(isValidMessages([])).toBe(false);
    expect(isValidMessages([{ role: "system", content: "no" }])).toBe(false);
    expect(isValidContent("x".repeat(10_001))).toBe(false);
  });
});
