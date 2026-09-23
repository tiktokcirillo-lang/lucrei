const ALLOWED_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS_LIMIT = 1024;
const MAX_REQUEST_SIZE = 4_000_000;
const MAX_MESSAGES = 4;

export function isValidContent(content) {
  if (typeof content === "string") return content.length <= 10_000;
  if (!Array.isArray(content) || content.length === 0 || content.length > 4) return false;

  let imageCount = 0;
  return content.every((part) => {
    if (part?.type === "text") {
      return typeof part.text === "string" && part.text.length <= 10_000;
    }

    if (part?.type === "image") {
      imageCount += 1;
      const source = part.source;
      return (
        imageCount <= 1 &&
        source?.type === "base64" &&
        ["image/jpeg", "image/png", "image/webp"].includes(source.media_type) &&
        typeof source.data === "string" &&
        source.data.length <= 3_500_000
      );
    }

    return false;
  });
}

export function isValidMessages(messages) {
  return (
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.length <= MAX_MESSAGES &&
    messages.every(
      (message) =>
        ["user", "assistant"].includes(message?.role) && isValidContent(message.content)
    )
  );
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.VITE_FIREBASE_API_KEY || !process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: "Service unavailable" });
  }

  const requestSize = Number(req.headers["content-length"] ?? 0);
  if (requestSize > MAX_REQUEST_SIZE) {
    return res.status(413).json({ error: "Request too large" });
  }

  // Verify Firebase Auth ID token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const idToken = authHeader.slice(7);
  try {
    const verifyRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.VITE_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!verifyRes.ok) throw new Error("Token invalid");
    const { users } = await verifyRes.json();
    if (!users?.length) throw new Error("User not found");
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Validate and sanitize request body — prevent model/token abuse
  const { messages } = req.body ?? {};
  if (!isValidMessages(messages)) {
    return res.status(400).json({ error: "Invalid messages" });
  }

  if (JSON.stringify(messages).length > MAX_REQUEST_SIZE) {
    return res.status(413).json({ error: "Request too large" });
  }

  const safeBody = {
    model: ALLOWED_MODEL,
    max_tokens: MAX_TOKENS_LIMIT,
    messages,
  };

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(safeBody),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch {
    return res.status(502).json({ error: "AI provider unavailable" });
  }
}
