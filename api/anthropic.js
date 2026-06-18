const ALLOWED_MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS_LIMIT = 1024;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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
  const { model, max_tokens, messages } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Invalid messages" });
  }
  const safeBody = {
    model: ALLOWED_MODEL,
    max_tokens: Math.min(Number(max_tokens) || MAX_TOKENS_LIMIT, MAX_TOKENS_LIMIT),
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
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
