import { replySchema, teachingPolicy } from './teaching';

export type Provider = 'gemini';
export const defaults: Record<Provider, string> = { gemini: 'gemini-3.5-flash-lite' };

export async function analyze(provider: Provider, model: string, key: string, context: object, signal: AbortSignal): Promise<unknown> {
  if (!key) throw new Error('Add your API key using the key button first.');
  if (!/^[a-zA-Z0-9._/-]{1,100}$/.test(model)) throw new Error('Check the model name in Coding Buddy settings.');
  const input = JSON.stringify(context);
  if (key.length >= 8 && input.includes(key)) throw new Error('Your provider key appears in the code or output. Remove it before asking the buddy to read it.');
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    signal: AbortSignal.any([signal, AbortSignal.timeout(45_000)]),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: teachingPolicy }] },
      contents: [{ role: 'user', parts: [{ text: input }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: replySchema, maxOutputTokens: 8192 }
    })
  });
  if (!response.ok) {
    const reason = response.status === 401 || response.status === 403 ? 'Check your API key and model access.'
      : response.status === 429 ? 'Your provider limit has been reached. Check your quota, then retry.'
      : response.status === 400 || response.status === 404 ? 'Check that this model is available and supports structured output.'
      : 'The provider is unavailable. Try again shortly.';
    throw new Error(reason);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The provider returned an empty response. Try again.');
  const decoder = new TextDecoder();
  let text = '';
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      text += decoder.decode(part.value, { stream: true });
      if (text.length > 500_000) throw new Error('The provider response was too large. Try a smaller example.');
    }
    text += decoder.decode();
  } finally { await reader.cancel().catch(() => {}); }
  try {
    const body = JSON.parse(text);
    const candidate = body.candidates?.[0];
    if (body.promptFeedback?.blockReason || candidate?.finishReason !== 'STOP') throw new Error();
    const output = candidate.content?.parts?.filter((part: { thought?: boolean; text?: string }) => !part.thought && typeof part.text === 'string').map((part: { text: string }) => part.text).join('');
    if (!output) throw new Error();
    return JSON.parse(output);
  } catch { throw new Error('The AI response was incomplete or blocked. Try again or choose another model.'); }
}
