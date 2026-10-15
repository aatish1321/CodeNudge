import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, Provider } from '../src/providers';
import { clue } from './fixtures';

const key = 'fixture-provider-key-123456789';
const signal = () => new AbortController().signal;

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
    await assert.rejects(analyze('gemini', 'fixture-model', '', {}, signal()), /API key/);
    await assert.rejects(analyze('gemini', 'fixture-model', key, { source: key }, signal()), /appears in the code/);
    await assert.rejects(analyze('gemini', 'bad model?', key, {}, signal()), /model name/);
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
  if (provider === 'groq') return { choices: [{ finish_reason: 'stop', message: { content: text, reasoning: 'not shown' } }] };
  return { candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] };
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
  for (const provider of ['gemini', 'openai', 'groq'] as const) {
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
