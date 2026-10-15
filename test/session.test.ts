import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LearningSession } from '../src/session';
import { checkSource, validateReply } from '../src/teaching';
import { clue, run } from './fixtures';

test('first clue is validated without a premature fix', () => {
  assert.deepEqual(validateReply(clue, run, 'clue'), clue);
  for (const invalid of [{ ...clue, replacement: 'fixed code' }, { ...clue, extra: true },
    { ...clue, line: 0 }, { ...clue, line: 99 }, { ...clue, message: '' }, { ...clue, relationship: 'none' },
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

test('three changed-code retries unlock inline guidance, then three more unlock a fix', () => {
  const session = new LearningSession();
  session.apply(run, clue, session.fingerprint(run, 'gemini', 'fixture', true), true);
  for (let retry = 1; retry <= 6; retry++) {
    const changed = { ...run, version: retry + 1, source: `${run.source}\n# changed attempt ${retry}` };
    const level = retry >= 6 ? 'fix' : retry >= 3 ? 'inline' : 'clue';
    assert.equal(session.allowedLevel(changed, true), level);
    const response = { ...clue, relationship: 'same' as const, level: level as 'clue' | 'inline' | 'fix',
      line: level === 'inline' ? 2 : null, inlineHint: level === 'inline' ? 'Look at the end of this line.' : null,
      replacement: level === 'fix' ? '# Print 1 through 5\nfor n in range(1, 6):\n    print(n)\n' : null,
      explanation: level === 'fix' ? 'The colon introduces the loop body.' : null };
    validateReply(response, changed, session.allowedLevel(changed, true));
    session.apply(changed, response, session.fingerprint(changed, 'gemini', 'fixture', true), true);
    assert.equal(session.retries, retry);
    assert.equal(session.isDuplicate(session.fingerprint(changed, 'gemini', 'fixture', true)), true);
    session.apply(changed, response, session.fingerprint(changed, 'gemini', 'fixture', false), false);
    assert.equal(session.retries, retry, 'clarification must not advance attempts');
  }
});

test('a new issue resets progression without causing an unchanged rerun request', () => {
  const session = new LearningSession();
  session.apply(run, clue, 'initial', true); session.retries = 2;
  const changed = { ...run, version: 2, source: `${run.source}\n# different issue` };
  assert.equal(session.allowedLevel(changed, true), 'inline');
  session.apply(changed, clue, session.fingerprint(changed, 'gemini', 'fixture', true), true);
  assert.equal(session.retries, 0);
  assert.equal(session.isDuplicate(session.fingerprint(changed, 'gemini', 'fixture', true)), true);
});

test('an unknown relationship cannot unlock the next help stage', () => {
  const session = new LearningSession(); session.apply(run, clue, 'initial', true); session.retries = 2;
  const changed = { ...run, source: `${run.source}\n# try` };
  assert.throws(() => session.apply(changed, { ...clue, relationship: 'unknown', level: 'inline', line: 2, inlineHint: 'Look here' }, 'next', true));
  assert.equal(session.retries, 2);
});

test('success requires clear intended behavior and sufficient observed evidence', () => {
  const solved = { ...clue, status: 'solved' as const, relationship: 'none' as const, level: 'none' as const, message: 'The output now matches the goal.' };
  const goodRun = { ...run, source: 'print(1)\n', output: '1\n', exitCode: 0 };
  for (const [observation, reply] of [
    [{ ...goodRun, exitCode: 1 }, solved], [{ ...goodRun, truncated: true }, solved],
    [{ ...goodRun, output: '' }, solved], [goodRun, { ...solved, intentSource: 'inferred' as const }],
    [goodRun, { ...solved, intentSource: 'clarified' as const }], [goodRun, { ...solved, expectedOutcome: null }]
  ] as const) {
    const session = new LearningSession(); session.apply(run, clue, 'initial', true);
    assert.throws(() => session.apply(observation, reply, 'solved', true));
    assert.ok(session.issue);
  }
  const session = new LearningSession(); session.apply(run, clue, 'initial', true); session.retries = 4;
  assert.equal(session.apply(goodRun, solved, 'solved', true), true);
  assert.equal(session.retries, 0); assert.equal(session.issue, '');
  assert.equal(session.apply(goodRun, solved, 'solved', true), false, 'do not celebrate the same solved issue again');
});

test('clarified external results may solve an issue, ordinary clarification never adds an attempt', () => {
  const session = new LearningSession(); session.apply(run, clue, 'initial', true);
  session.clarification = 'It should print all five numbers.';
  const changed = { ...run, source: `${run.source}\n# new attempt`, reported: true, exitCode: null };
  session.apply(changed, { ...clue, relationship: 'same' }, 'reported', true);
  assert.equal(session.retries, 1);
  session.apply(changed, { ...clue, relationship: 'same' }, 'clarified', false);
  assert.equal(session.retries, 1);
  const solved = { ...clue, status: 'solved' as const, level: 'none' as const, relationship: 'none' as const, intentSource: 'clarified' as const };
  assert.equal(session.apply({ ...changed, output: '1\n2\n3\n4\n5' }, solved, 'solved', true), true);
});

test('provider switches invalidate cached guidance while preserving the teaching stage', () => {
  const session = new LearningSession(); session.apply(run, clue, 'initial', true); session.retries = 4;
  session.clearCache();
  assert.equal(session.retries, 4);
  assert.equal(session.allowedLevel(run, true), 'inline');
  const gemini = session.fingerprint(run, 'gemini', 'model', true);
  const groq = session.fingerprint(run, 'groq', 'model', true);
  assert.notEqual(gemini, groq);
});

test('a result with an uncertain source cannot escalate or celebrate', () => {
  const session = new LearningSession();
  session.apply(run, clue, 'first', true);
  session.retries = 6;
  const uncertain = { ...run, source: `${run.source}\n# retry`, sourceConfirmed: false, output: '1\n2\n3\n4\n5', exitCode: 0 };
  assert.equal(session.allowedLevel(uncertain, true), 'clue');
  session.apply(uncertain, { ...clue, relationship: 'same' }, 'uncertain', true);
  assert.equal(session.retries, 6);
  assert.throws(() => session.apply(uncertain, { ...clue, status: 'solved', relationship: 'same',
    level: 'none', intentSource: 'comment', expectedOutcome: 'Print 1 through 5' }, 'solved', true));
});
