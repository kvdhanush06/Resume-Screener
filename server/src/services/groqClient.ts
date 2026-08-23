import { CONFIG } from "../config.js";

export function isGroqConfigured(): boolean {
  return typeof CONFIG.GROQ_API_KEY === "string" && CONFIG.GROQ_API_KEY.trim().length > 0;
}

export function parseJsonSafely<T>(raw: string, fallback: T): T {
  try {
    const trimmed = raw.trim();
    const jsonMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    return JSON.parse(jsonMatch ? jsonMatch[1] : trimmed) as T;
  } catch {
    return fallback;
  }
}

export async function callGroqChatCompletion(
  systemPrompt: string,
  userPrompt: string,
  model = CONFIG.GROQ_MODEL
): Promise<string | null> {
  if (!isGroqConfigured()) return null;
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${CONFIG.GROQ_API_KEY}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content : null;
  } catch {
    return null;
  }
}
