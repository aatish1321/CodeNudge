import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/providers';
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
