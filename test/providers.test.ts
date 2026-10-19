import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, defaults, projectReply, Provider, validateEndpoint } from '../src/providers';
import { clue } from './fixtures';
import { createServer } from 'node:http';

const key = 'fixture-provider-key-123456789';
const signal = () => new AbortController().signal;
const providers = Object.keys(defaults) as Provider[];

test('Gemini request sends the schema and auth header, and decodes only non-thought content', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\//);
    assert.equal((options.headers as Record<string, string>)['x-goog-api-key'], key);
    const body = JSON.parse(options.body as string);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');
    assert.equal(body.generationConfig.responseJsonSchema.additionalProperties, false);
    assert.match(body.systemInstruction.parts[0].text, /clue level/);
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [
      { thought: true, text: 'hidden reasoning must never be displayed' }, { text: JSON.stringify(clue) }
    ] } }] });
  });
  try { assert.deepEqual(await analyze('gemini', 'fixture-model', key, { source: 'print(1)' }, signal()), clue); }
  finally { fetchMock.mock.restore(); }
});

test('missing keys and known key material are rejected before network access', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async () => { throw new Error('must not call'); });
  try {
    for (const provider of providers.filter(value => value !== 'ollama' && value !== 'custom')) {
      await assert.rejects(analyze(provider, 'fixture-model', '', {}, signal()), /API key/);
    }
    await assert.rejects(analyze('gemini', 'fixture-model', key, { source: key }, signal()), /appears in the code/);
    await assert.rejects(analyze('gemini', 'bad model?', key, {}, signal()), /model name/);
    await assert.rejects(analyze('custom', 'model', 'bad\nheader-key', {}, signal()), /saved API key/);
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally { fetchMock.mock.restore(); }
});

test('provider failures do not expose raw response bodies or credentials', async () => {
  for (const status of [400, 401, 403, 404, 429, 500]) {
    const fetchMock = mock.method(globalThis, 'fetch', async () => new Response(key, { status }));
    try {
      await assert.rejects(analyze('gemini', 'fixture-model', key, {}, signal()), error => {
        assert.ok(error instanceof Error); assert.ok(!error.message.includes(key)); return true;
      });
    } finally { fetchMock.mock.restore(); }
  }
});

test('blocked, truncated, missing and malformed model results remain failures', async () => {
  for (const body of [{ promptFeedback: { blockReason: 'SAFETY' } }, { candidates: [{ finishReason: 'MAX_TOKENS' }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not JSON' }] } }] }, {}]) {
    const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json(body));
    try { await assert.rejects(analyze('gemini', 'fixture-model', key, {}, signal()), /incomplete or blocked/); }
    finally { fetchMock.mock.restore(); }
  }
});

function responseFor(provider: Provider, value: unknown): object {
  const text = JSON.stringify(value);
  if (provider === 'openai') return { status: 'completed', output: [{ type: 'reasoning', summary: [] }, { type: 'message', content: [{ type: 'output_text', text }] }] };
  if (provider === 'anthropic') return { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: 'private' }, { type: 'text', text }] };
  if (provider === 'ollama') return { done: true, done_reason: 'stop', message: { content: text, thinking: 'private' } };
  if (provider !== 'gemini') return { choices: [{ finish_reason: 'stop', message: { content: text, reasoning: 'not shown' } }] };
  return { candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] };
}


function schemaFor(provider: Provider, body: any): any {
  if (provider === 'gemini') return body.generationConfig.responseJsonSchema;
  if (provider === 'openai') return body.text.format.schema;
  if (provider === 'anthropic') return body.output_config.format.schema;
  if (provider === 'ollama') return body.format;
  if (body.response_format.type === 'json_object') return JSON.parse(body.messages[0].content.split('Return a JSON object matching this schema: ')[1]);
  return body.response_format.json_schema.schema;
}

test('OpenAI and Groq use their own authenticated endpoint and strict schema', async () => {
  for (const provider of ['openai', 'groq'] as const) {
    const fetchMock = mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      assert.equal(url, provider === 'openai' ? 'https://api.openai.com/v1/responses' : 'https://api.groq.com/openai/v1/chat/completions');
      assert.equal((options.headers as Record<string, string>).Authorization, `Bearer ${key}`);
      assert.equal((options.headers as Record<string, string>)['x-goog-api-key'], undefined);
      if (provider === 'openai') {
        assert.equal(body.store, false); assert.equal(body.text.format.strict, true);
        assert.equal(body.text.format.schema.additionalProperties, false);
        assert.equal(JSON.parse(body.input).allowedLevel, 'clue');
      } else {
        assert.equal(body.stream, false); assert.equal(body.response_format.json_schema.strict, true);
        assert.equal(body.messages[0].role, 'system');
      }
      return Response.json(responseFor(provider, clue));
    });
    try {
      assert.deepEqual(await analyze(provider, 'fixture-model', key, { allowedLevel: 'clue' }, signal()), clue);
      assert.equal(fetchMock.mock.callCount(), 1);
    } finally { fetchMock.mock.restore(); }
  }
});

test('OpenAI and Groq refuse incomplete, blocked, or non-text results', async () => {
  const cases: [Provider, object][] = [
    ['openai', { status: 'incomplete', output: [] }],
    ['openai', { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] }],
    ['openai', { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'broken JSON' }] }] }],
    ['groq', { choices: [{ finish_reason: 'length', message: { content: JSON.stringify(clue) } }] }],
    ['groq', { choices: [{ finish_reason: 'stop', message: { refusal: 'no', content: JSON.stringify(clue) } }] }],
    ['groq', { choices: [{ finish_reason: 'stop', message: { content: null } }] }]
  ];
  for (const [provider, body] of cases) {
    const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json(body));
    try { await assert.rejects(analyze(provider, 'fixture-model', key, {}, signal()), /incomplete or blocked/); }
    finally { fetchMock.mock.restore(); }
  }
});

test('failed requests never retry or fall back to a different provider', async () => {
  for (const provider of providers) {
    const fetchMock = mock.method(globalThis, 'fetch', async () => new Response('quota exceeded', { status: 429 }));
    try {
      await assert.rejects(analyze(provider, 'fixture-model', key, {}, signal()), /quota/);
      assert.equal(fetchMock.mock.callCount(), 1);
    } finally { fetchMock.mock.restore(); }
  }
});

test('oversized and interrupted responses do not become usable guidance', async () => {
  let fetchMock = mock.method(globalThis, 'fetch', async () => new Response('x'.repeat(500_001)));
  try { await assert.rejects(analyze('openai', 'fixture-model', key, {}, signal()), /too large/); }
  finally { fetchMock.mock.restore(); }
  fetchMock = mock.method(globalThis, 'fetch', async () => { throw new DOMException('request expired', 'TimeoutError'); });
  try { await assert.rejects(analyze('groq', 'fixture-model', key, {}, signal()), { name: 'TimeoutError' }); }
  finally { fetchMock.mock.restore(); }
});

test('every provider requires the host-unlocked stage even when a diagnostic changes', async () => {
  for (const provider of providers) {
    for (const level of ['inline', 'fix']) for (const sameDiagnostic of [true, false]) {
      const fetchMock = mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
        const body = JSON.parse(options.body as string);
        const schema = schemaFor(provider, body);
        assert.deepEqual(schema.properties.level.enum, [level, 'none']);
        return Response.json(responseFor(provider, clue));
      });
      try { await analyze(provider, 'fixture-model', key, { allowedLevel: level, sameDiagnostic }, signal()); }
      finally { fetchMock.mock.restore(); }
    }
  }
});

test('each provider schema prevents locked edit fields before the fix stage', async () => {
  for (const provider of providers) {
    for (const level of ['clue', 'inline'] as const) {
      const fetchMock = mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
        const body = JSON.parse(options.body as string);
        const schema = schemaFor(provider, body);
        assert.equal(schema.properties.replacement.type, 'null');
        assert.equal(schema.properties.explanation.type, 'null');
        assert.match(schema.properties.level.description, /For status issue, never use none/);
        assert.ok(!schema.properties.level.enum.includes('fix'));
        if (level === 'clue') {
          assert.equal(schema.properties.inlineHint.type, 'null');
          assert.ok(!schema.properties.level.enum.includes('inline'));
        }
        return Response.json(responseFor(provider, clue));
      });
      try { await analyze(provider, 'fixture-model', key, { allowedLevel: level }, signal()); }
      finally { fetchMock.mock.restore(); }
    }
  }
});

test('all providers reuse secure transport with separate project planning and coaching schemas', async () => {
  for (const provider of providers) for (const operation of ['plan', 'hint', 'review']) {
    const response = operation === 'plan' ? { kind: 'question', title: '', tasks: [], message: 'Browser or terminal?' } : { message: 'What happens with one entry?', ready: false };
    const fetchMock = mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      const schema = schemaFor(provider, body);
      assert.equal(schema.additionalProperties, false);
      assert.equal(!!schema.properties.tasks, operation === 'plan');
      assert.equal(schema.properties.replacement, undefined);
      const policy = provider === 'gemini' ? body.systemInstruction.parts[0].text : provider === 'openai' ? body.instructions : provider === 'anthropic' ? body.system : body.messages[0].content;
      assert.match(policy, /Never write the project/);
      return Response.json(responseFor(provider, response));
    });
    try { assert.deepEqual(await projectReply(provider, 'fixture-model', key, { operation, idea: 'A tracker' }, signal()), response); }
    finally { fetchMock.mock.restore(); }
  }
});

test('new hosted providers use their own authentication, endpoint and documented output format', async () => {
  const endpoints = { anthropic: 'https://api.anthropic.com/v1/messages', openrouter: 'https://openrouter.ai/api/v1/chat/completions',
    deepseek: 'https://api.deepseek.com/chat/completions', mistral: 'https://api.mistral.ai/v1/chat/completions' };
  for (const provider of Object.keys(endpoints) as (keyof typeof endpoints)[]) {
    const fetchMock = mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
      assert.equal(url, endpoints[provider]); assert.equal(options.redirect, 'error');
      const headers = options.headers as Record<string, string>;
      const body = JSON.parse(options.body as string);
      if (provider === 'anthropic') {
        assert.equal(headers['x-api-key'], key); assert.equal(headers['anthropic-version'], '2023-06-01');
        assert.equal(headers.Authorization, undefined); assert.equal(body.max_tokens, 8192);
      } else assert.equal(headers.Authorization, `Bearer ${key}`);
      assert.equal(schemaFor(provider, body).properties.replacement.type, 'null');
      if (provider === 'deepseek') assert.equal(body.response_format.type, 'json_object');
      if (provider === 'openrouter') assert.equal(body.provider.require_parameters, true);
      return Response.json(responseFor(provider, clue));
    });
    try { assert.deepEqual(await analyze(provider, defaults[provider], key, {}, signal()), clue); }
    finally { fetchMock.mock.restore(); }
  }
});

test('Claude and Ollama reject refused, truncated, incomplete and malformed envelopes', async () => {
  const cases: [Provider, object][] = [
    ['anthropic', { stop_reason: 'refusal', content: [{ type: 'text', text: JSON.stringify(clue) }] }],
    ['anthropic', { stop_reason: 'max_tokens', content: [{ type: 'text', text: JSON.stringify(clue) }] }],
    ['anthropic', { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: JSON.stringify(clue) }] }],
    ['ollama', { done: false, done_reason: 'stop', message: { content: JSON.stringify(clue) } }],
    ['ollama', { done: true, done_reason: 'length', message: { content: JSON.stringify(clue) } }],
    ['ollama', { done: true, done_reason: 'stop', message: { content: 'bad JSON' } }]
  ];
  for (const [provider, body] of cases) {
    const fetchMock = mock.method(globalThis, 'fetch', async () => Response.json(body));
    try { await assert.rejects(analyze(provider, defaults[provider], key, {}, signal()), /incomplete or blocked/); }
    finally { fetchMock.mock.restore(); }
  }
});

test('optional custom/Ollama tokens authenticate only the chosen request without entering its body', async () => {
  for (const provider of ['ollama', 'custom'] as const) {
    const fetchMock = mock.method(globalThis, 'fetch', async (_url: string, options: RequestInit) => {
      assert.equal((options.headers as Record<string, string>).Authorization, `Bearer ${key}`);
      assert.ok(!String(options.body).includes(key));
      return Response.json(responseFor(provider, clue));
    });
    try { assert.deepEqual(await analyze(provider, 'model:tag', key, {}, signal()), clue); }
    finally { fetchMock.mock.restore(); }
  }
});

test('custom endpoints allow HTTPS or loopback HTTP and reject credentials, ambiguous targets and unsafe schemes', async () => {
  for (const endpoint of ['https://models.example/v1/chat/completions', 'http://localhost:1234/v1/chat/completions', 'http://127.0.0.1:11434/api/chat', 'http://[::1]:1234/v1/chat/completions']) {
    assert.equal(validateEndpoint(endpoint), endpoint);
  }
  const fetchMock = mock.method(globalThis, 'fetch', async () => { throw new Error('must not call'); });
  try {
    for (const endpoint of ['http://models.example/v1/chat/completions', 'http://localhost.evil.example/api/chat', 'https://user:password@models.example/api',
      'https://models.example/api?key=secret', 'https://models.example/api#secret', 'https://models.\nexample/api', 'file:///etc/passwd', 'ftp://localhost/api', 'broken', '']) {
      assert.throws(() => validateEndpoint(endpoint), /HTTPS/);
      await assert.rejects(analyze('custom', 'model:tag', '', {}, signal(), { endpoint }), /HTTPS/);
    }
    assert.equal(fetchMock.mock.callCount(), 0);
  } finally { fetchMock.mock.restore(); }
});

test('real loopback HTTP works without keys for Ollama/custom, preserves stage schemas, and refuses redirects', async () => {
  let redirected = false; const requests: any[] = [];
  const server = createServer(async (req, res) => {
    if (req.url === '/redirect') { res.writeHead(307, { Location: '/unexpected' }); res.end(); return; }
    if (req.url === '/unexpected') { redirected = true; res.end(); return; }
    let text = ''; for await (const part of req) text += part;
    const body = JSON.parse(text); requests.push(body);
    assert.equal(req.headers.authorization, undefined);
    const input = JSON.parse(body.messages[1].content);
    const reply = input.operation === 'plan' ? { kind: 'question', title: '', tasks: [], message: 'Browser or terminal?' } : clue;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(responseFor(req.url === '/api/chat' ? 'ollama' : 'custom', reply)));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;
  try {
    for (const provider of ['ollama', 'custom'] as const) {
      const endpoint = base + (provider === 'ollama' ? '/api/chat' : '/v1/chat/completions');
      assert.deepEqual(await analyze(provider, 'model:8b', '', { allowedLevel: 'inline', sameDiagnostic: true }, signal(), { endpoint }), clue);
      assert.deepEqual(schemaFor(provider, requests.at(-1)).properties.level.enum, ['inline', 'none']);
      assert.equal(schemaFor(provider, requests.at(-1)).properties.replacement.type, 'null');
    }
    const endpoint = base + '/v1/chat/completions';
    await projectReply('custom', 'model:8b', '', { operation: 'plan' }, signal(), { endpoint, format: 'json_object' });
    assert.equal(requests.at(-1).response_format.type, 'json_object');
    assert.ok(schemaFor('custom', requests.at(-1)).properties.tasks);
    await assert.rejects(analyze('custom', 'model:8b', key, {}, signal(), { endpoint: base + '/redirect' }));
    assert.equal(redirected, false, 'credentials and code must not follow a redirect');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
