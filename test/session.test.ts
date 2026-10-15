import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LearningSession } from '../src/session';
import { checkSource, validateReply } from '../src/teaching';
import { clue, run } from './fixtures';

test('first clue is validated without a premature fix', () => {
  assert.deepEqual(validateReply(clue, run, 'clue'), clue);
  for (const invalid of [{ ...clue, replacement: 'fixed code' }, { ...clue, extra: true },
    { ...clue, line: 0 }, { ...clue, line: 99 }, { ...clue, message: '' },
    { ...clue, level: 'inline', inlineHint: 'add something', line: 2 }]) {
    assert.throws(() => validateReply(invalid, run, 'clue'));
  }
});

test('source checks stop credential files, blank and oversized context', () => {
  assert.doesNotThrow(() => checkSource(run.source, 'example.py'));
  assert.throws(() => checkSource(' ', 'example.py'));
  assert.throws(() => checkSource('x'.repeat(12_001), 'example.py'));
  assert.throws(() => checkSource('API_KEY=example', '/project/.env.local'));
  assert.throws(() => checkSource('private data', '/project/server.pem'));
});

test('successful identical runs reuse the prior response; clarification is distinct context', () => {
  const session = new LearningSession();
  const fingerprint = session.fingerprint(run, 'gemini', 'fixture-model', true);
  assert.equal(session.isDuplicate(fingerprint), false);
  session.apply(run, clue, fingerprint, true);
  assert.equal(session.isDuplicate(session.fingerprint({ ...run, version: 2 }, 'gemini', 'fixture-model', true)), true);
  session.clarification = 'I expected 1 through 5';
  assert.equal(session.isDuplicate(session.fingerprint(run, 'gemini', 'fixture-model', false)), false);
  assert.equal(session.retries, 0);
});

test('transport context excludes local file paths and document versions', () => {
  const context = JSON.parse(JSON.stringify(new LearningSession().context(run, true)));
  assert.equal(context.uri, undefined); assert.equal(context.version, undefined);
  assert.equal(context.source, run.source); assert.equal(context.allowedLevel, 'clue');
});
