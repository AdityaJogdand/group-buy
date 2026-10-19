// One chat call to any OpenAI-compatible endpoint (Groq, Ollama, ...), answer forced into a JSON schema.
// Set LLM_BASE_URL, LLM_MODEL, LLM_API_KEY in .env.
export type ChatMessage = { role: 'user' | 'assistant'; content: string };

export async function llmJson<T>(system: string, messages: ChatMessage[], name: string, schema: object): Promise<T> {
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`LLM unavailable, try again (${res.status} ${data.error?.message ?? ''})`.trim());
  return JSON.parse(data.choices[0].message.content) as T;
}
