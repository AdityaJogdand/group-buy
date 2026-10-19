// One chat call to any OpenAI-compatible endpoint (Groq, Ollama, ...), answer forced into a JSON schema.
// Set LLM_BASE_URL, LLM_MODEL, LLM_API_KEY in .env.
export type ChatMessage = { role: 'user' | 'assistant'; content: string };

// Free tiers rate-limit per minute (Groq: 8K tokens/min). Groq's retry-after (~3s) is optimistic while the
// token budget refills over ~60s, so back off 2, 4, 8, 16, 30s (~1 min total) before giving up.
export async function llmJson<T>(system: string, messages: ChatMessage[], name: string, schema: object, attempt = 0): Promise<T> {
  const { LLM_BASE_URL: base, LLM_MODEL: model, LLM_API_KEY: key } = process.env;
  if (!base || !model) throw new Error('LLM_BASE_URL / LLM_MODEL missing');
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(key && { Authorization: `Bearer ${key}` }) },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [{ role: 'system', content: system }, ...messages],
        response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } },
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) {
    throw new Error('LLM unavailable, try again', { cause: e });
  }
  if (res.status === 429 && attempt < 5) {
    const wait = Math.min(Math.max(Number(res.headers.get('retry-after')) || 0, 2 ** (attempt + 1)), 30);
    await new Promise(r => setTimeout(r, wait * 1000));
    return llmJson(system, messages, name, schema, attempt + 1);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`LLM unavailable, try again (${res.status} ${data.error?.message ?? ''})`.trim());
  return JSON.parse(data.choices[0].message.content) as T;
}
