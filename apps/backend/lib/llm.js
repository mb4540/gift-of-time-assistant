// Simple JSON chat helper (OpenAI)
import OpenAI from "openai";

const PROVIDER = process.env.LLM_PROVIDER || "openai";
const MODEL = process.env.LLM_MODEL || "gpt-4o-mini"; // change if you like

export async function chatJSON({ system, messages = [], schema }) {
  if (PROVIDER !== "openai") {
    throw new Error(`LLM_PROVIDER=${PROVIDER} not implemented in lib/llm.js`);
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.chat.completions.create({
    model: MODEL,
    messages: [
      ...(system ? [{ role: "system", content: system }] : []),
      ...messages,
    ],
    response_format: schema
      ? { type: "json_schema", json_schema: { name: "result", schema, strict: true } }
      : { type: "json_object" },
    temperature: 0.2,
  });
  const text = res.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(text); } catch { return { _raw: text }; }
}
