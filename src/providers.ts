import { replySchema, teachingPolicy } from './teaching';
import { projectCoachSchema, projectPlanSchema, projectPolicy } from './project';

export type Provider = 'gemini' | 'openai' | 'groq' | 'anthropic' | 'openrouter' | 'deepseek' | 'mistral' | 'ollama' | 'custom';
export const defaults: Record<Provider, string> = { gemini: 'gemini-3.5-flash-lite', openai: 'gpt-6-luna', groq: 'openai/gpt-oss-120b',
  anthropic: 'claude-sonnet-4-6', openrouter: 'openai/gpt-oss-120b', deepseek: 'deepseek-flash', mistral: 'mistral-large-latest', ollama: 'qwen3:8b', custom: 'local-model' };
export const providerLabels: Record<Provider, string> = { gemini: 'Google Gemini', openai: 'OpenAI', groq: 'Groq', anthropic: 'Anthropic Claude',
  openrouter: 'OpenRouter', deepseek: 'DeepSeek', mistral: 'Mistral', ollama: 'Ollama (local)', custom: 'Custom OpenAI-compatible' };
export interface Connection { endpoint?: string; format?: 'json_schema' | 'json_object' }
export const defaultEndpoints = { ollama: 'http://localhost:11434/api/chat', custom: 'http://localhost:1234/v1/chat/completions' };
export const modelPattern = /^[a-zA-Z0-9._/:@+-]{1,200}$/;
export const requiresKey = (provider: Provider): boolean => provider !== 'ollama' && provider !== 'custom';

export function validateEndpoint(value: unknown): string {
  try {
    if (typeof value !== 'string' || value.length > 2_000 || /\s/.test(value.trim())) throw new Error();
    const url = new URL(value.trim());
    const loopback = url.hostname === 'localhost' || url.hostname === '[::1]' || /^127\.\d+\.\d+\.\d+$/.test(url.hostname);
    if (url.username || url.password || url.search || url.hash || !(url.protocol === 'https:' || (url.protocol === 'http:' && loopback))) throw new Error();
    return url.toString();
  } catch { throw new Error('Use a full HTTPS endpoint, or HTTP on localhost/127.0.0.1/::1. Keep keys, query parameters and fragments out of the URL.'); }
}

export async function analyze(provider: Provider, model: string, key: string, context: object, signal: AbortSignal, connection: Connection = {}): Promise<unknown> {
  const { allowedLevel, sameDiagnostic } = context as { allowedLevel?: unknown; sameDiagnostic?: unknown };
  const level = allowedLevel === 'inline' || allowedLevel === 'fix' ? allowedLevel : 'clue';
  const schema = { ...replySchema, properties: { ...replySchema.properties,
    level: { type: 'string', enum: sameDiagnostic === true ? [level, 'none'] : level === 'fix' ? ['clue', 'inline', 'fix', 'none'] : level === 'inline' ? ['clue', 'inline', 'none'] : ['clue', 'none'],
      description: 'For status issue, never use none. A new issue uses clue; a continuing issue uses allowedLevel. Use none only for solved or needs_clarification.' },
    ...(level !== 'fix' ? { replacement: { type: 'null' }, explanation: { type: 'null' } } : {}),
    ...(level === 'clue' ? { inlineHint: { type: 'null' } } : {})
  } };
  return request(provider, model, key, context, signal, teachingPolicy, schema, connection);
}

export async function projectReply(provider: Provider, model: string, key: string, context: object, signal: AbortSignal, connection: Connection = {}): Promise<unknown> {
  const operation = (context as { operation?: string }).operation;
  return request(provider, model, key, context, signal, projectPolicy, operation === 'plan' ? projectPlanSchema : projectCoachSchema, connection);
}

async function request(provider: Provider, model: string, key: string, context: object, signal: AbortSignal, policy: string, schema: object, connection: Connection): Promise<unknown> {
  if (!key && requiresKey(provider)) throw new Error('Add your API key in CodeNudge settings first.');
  if (/[\r\n]/.test(key)) throw new Error('Check your saved API key in CodeNudge settings.');
  if (!modelPattern.test(model)) throw new Error('Check the model name in CodeNudge settings.');
  const input = JSON.stringify(context);
  if (key.length >= 8 && input.includes(key)) throw new Error('Your provider key appears in the code or output. Remove it before asking CodeNudge to read it.');
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
    case 'anthropic':
      url = 'https://api.anthropic.com/v1/messages';
      headers['x-api-key'] = key; headers['anthropic-version'] = '2023-06-01';
      payload = { model, system: policy, messages: [{ role: 'user', content: input }], max_tokens: 8192,
        output_config: { format: { type: 'json_schema', schema } } };
      break;
    case 'ollama':
      url = validateEndpoint(connection.endpoint ?? defaultEndpoints.ollama);
      if (key) headers.Authorization = `Bearer ${key}`;
      payload = { model, messages: [{ role: 'system', content: `${policy}\nReturn JSON matching this schema: ${JSON.stringify(schema)}` }, { role: 'user', content: input }],
        stream: false, format: schema, options: { num_predict: 8192 } };
      break;
    case 'groq': case 'openrouter': case 'deepseek': case 'mistral': case 'custom': {
      const endpoints = { groq: 'https://api.groq.com/openai/v1/chat/completions', openrouter: 'https://openrouter.ai/api/v1/chat/completions',
        deepseek: 'https://api.deepseek.com/chat/completions', mistral: 'https://api.mistral.ai/v1/chat/completions' };
      url = provider === 'custom' ? validateEndpoint(connection.endpoint ?? defaultEndpoints.custom) : endpoints[provider];
      if (key) headers.Authorization = `Bearer ${key}`;
      if (connection.format !== undefined && !['json_schema', 'json_object'].includes(connection.format)) throw new Error('Choose JSON schema or JSON object output in CodeNudge settings.');
      const jsonObject = provider === 'deepseek' || (provider === 'custom' && connection.format === 'json_object');
      payload = { model, messages: [{ role: 'system', content: jsonObject ? `${policy}\nReturn a JSON object matching this schema: ${JSON.stringify(schema)}` : policy }, { role: 'user', content: input }],
        stream: false, ...(provider === 'groq' ? { max_completion_tokens: 8192 } : { max_tokens: 8192 }),
        ...(provider === 'openrouter' ? { provider: { require_parameters: true } } : {}),
        response_format: jsonObject ? { type: 'json_object' } : { type: 'json_schema', json_schema: { name: 'buddy_response', strict: true, schema } } };
      break;
    }
    default: throw new Error('Choose a supported provider in CodeNudge settings.');
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    redirect: 'error',
    signal: AbortSignal.any([signal, AbortSignal.timeout(provider === 'ollama' || provider === 'custom' ? 120_000 : 45_000)]),
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
    } else if (provider === 'anthropic') {
      if (body.stop_reason !== 'end_turn' || body.error || !Array.isArray(body.content)) throw new Error();
      output = body.content.filter((part: { type: string; text?: string }) => part.type === 'text' && typeof part.text === 'string').map((part: { text: string }) => part.text).join('');
    } else if (provider === 'ollama') {
      if (body.done !== true || body.done_reason !== 'stop' || body.error || typeof body.message?.content !== 'string') throw new Error();
      output = body.message.content;
    } else {
      const choice = body.choices?.[0];
      if (choice?.finish_reason !== 'stop' || choice.message?.refusal || typeof choice.message?.content !== 'string') throw new Error();
      output = choice.message.content;
    }
    if (!output) throw new Error();
    return JSON.parse(output);
  } catch { throw new Error('The AI response was incomplete or blocked. Try again or choose another model.'); }
}
