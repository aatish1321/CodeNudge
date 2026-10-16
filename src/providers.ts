import { replySchema, teachingPolicy } from './teaching';
import { projectCoachSchema, projectPlanSchema, projectPolicy } from './project';

export type Provider = 'gemini' | 'openai' | 'groq';
export const defaults: Record<Provider, string> = { gemini: 'gemini-3.5-flash-lite', openai: 'gpt-6-luna', groq: 'openai/gpt-oss-120b' };

export async function analyze(provider: Provider, model: string, key: string, context: object, signal: AbortSignal): Promise<unknown> {
  const { allowedLevel, sameDiagnostic } = context as { allowedLevel?: unknown; sameDiagnostic?: unknown };
  const level = allowedLevel === 'inline' || allowedLevel === 'fix' ? allowedLevel : 'clue';
  const schema = { ...replySchema, properties: { ...replySchema.properties,
    level: { type: 'string', enum: sameDiagnostic === true ? [level, 'none'] : level === 'fix' ? ['clue', 'inline', 'fix', 'none'] : level === 'inline' ? ['clue', 'inline', 'none'] : ['clue', 'none'] },
    ...(level !== 'fix' ? { replacement: { type: 'null' }, explanation: { type: 'null' } } : {}),
    ...(level === 'clue' ? { inlineHint: { type: 'null' } } : {})
  } };
  return request(provider, model, key, context, signal, teachingPolicy, schema);
}

export async function projectReply(provider: Provider, model: string, key: string, context: object, signal: AbortSignal): Promise<unknown> {
  const operation = (context as { operation?: string }).operation;
  return request(provider, model, key, context, signal, projectPolicy, operation === 'plan' ? projectPlanSchema : projectCoachSchema);
}

async function request(provider: Provider, model: string, key: string, context: object, signal: AbortSignal, policy: string, schema: object): Promise<unknown> {
  if (!key) throw new Error('Add your API key in Buddy settings first.');
  if (!/^[a-zA-Z0-9._/-]{1,100}$/.test(model)) throw new Error('Check the model name in Coding Buddy settings.');
  const input = JSON.stringify(context);
  if (key.length >= 8 && input.includes(key)) throw new Error('Your provider key appears in the code or output. Remove it before asking the buddy to read it.');
  let url: string;
  let headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let payload: object;
  switch (provider) {
    case 'gemini':
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      headers['x-goog-api-key'] = key;
      payload = {
        systemInstruction: { parts: [{ text: policy }] },
        contents: [{ role: 'user', parts: [{ text: input }] }],
        generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, maxOutputTokens: 8192 }
      };
      break;
    case 'openai':
      url = 'https://api.openai.com/v1/responses';
      headers.Authorization = `Bearer ${key}`;
      payload = { model, instructions: policy, input, store: false, max_output_tokens: 8192,
        text: { format: { type: 'json_schema', name: 'buddy_response', strict: true, schema } } };
      break;
    case 'groq':
      url = 'https://api.groq.com/openai/v1/chat/completions';
      headers.Authorization = `Bearer ${key}`;
      payload = { model, messages: [{ role: 'system', content: policy }, { role: 'user', content: input }],
        stream: false, max_completion_tokens: 8192,
        response_format: { type: 'json_schema', json_schema: { name: 'buddy_response', strict: true, schema } } };
      break;
    default: throw new Error('Choose a supported provider in Coding Buddy settings.');
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    signal: AbortSignal.any([signal, AbortSignal.timeout(45_000)]),
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
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
    let output: string | undefined;
    if (provider === 'gemini') {
      const candidate = body.candidates?.[0];
      if (body.promptFeedback?.blockReason || candidate?.finishReason !== 'STOP') throw new Error();
      output = candidate.content?.parts?.filter((part: { thought?: boolean; text?: string }) => !part.thought && typeof part.text === 'string').map((part: { text: string }) => part.text).join('');
    } else if (provider === 'openai') {
      if (body.status !== 'completed' || body.error || !Array.isArray(body.output)) throw new Error();
      const parts = body.output.filter((item: { type: string }) => item.type === 'message').flatMap((item: { content: unknown[] }) => item.content);
      if (parts.some((part: { type: string }) => part.type === 'refusal')) throw new Error();
      output = parts.filter((part: { type: string; text?: string }) => part.type === 'output_text' && typeof part.text === 'string').map((part: { text: string }) => part.text).join('');
    } else {
      const choice = body.choices?.[0];
      if (choice?.finish_reason !== 'stop' || choice.message?.refusal || typeof choice.message?.content !== 'string') throw new Error();
      output = choice.message.content;
    }
    if (!output) throw new Error();
    return JSON.parse(output);
  } catch { throw new Error('The AI response was incomplete or blocked. Try again or choose another model.'); }
}
