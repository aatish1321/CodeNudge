import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LearningSession } from '../src/session';
import { checkSource, diagnostic, GuidanceValidationError, validateReply } from '../src/teaching';
import { clue, run } from './fixtures';

test('first clue is validated without a premature fix', () => {
  assert.deepEqual(validateReply(clue, run, 'clue'), clue);
  for (const invalid of [{ ...clue, replacement: 'fixed code' }, { ...clue, extra: true },
    { ...clue, line: 0 }, { ...clue, line: 99 }, { ...clue, message: '' }, { ...clue, relationship: 'none' },
    { ...clue, level: 'inline', inlineHint: 'add something', line: 2 }]) {
    assert.throws(() => validateReply(invalid, run, 'clue'));
  }
});

test('rejected guidance supplies a safe diagnostic code without echoing model text', () => {
  assert.throws(() => validateReply({ ...clue, line: 999, message: 'private model content' }, run, 'clue'), error => {
    assert.ok(error instanceof GuidanceValidationError);
    assert.equal(error.reason, 'line_out_of_range');
    assert.ok(!error.message.includes('private model content'));
    return true;
  });
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

test('same terminal diagnostic survives model new labels and produces an arrow on the third changed retry', () => {
  const session = new LearningSession();
  const failed = { ...run, output: 'File "/example.py", line 2\nSyntaxError: invalid syntax' };
  session.begin(failed, 'initial', true);
  session.apply(failed, clue, 'initial', true);
  for (let retry = 1; retry <= 3; retry++) {
    const current = { ...failed, source: `${run.source}\n# attempt ${retry}`, version: retry + 1 };
    const fingerprint = `retry-${retry}`;
    session.begin(current, fingerprint, true);
    assert.equal(session.retries, retry, 'local evidence counts the attempt before a provider can fail');
    const pendingHint = session.lineHint(current);
    assert.equal(pendingHint?.line, retry === 3 ? 2 : undefined);
    const response = validateReply({ ...clue, message: `A differently phrased clue ${retry}` }, current,
      session.allowedLevel(current, true), session.sameDiagnostic(current));
    assert.equal(response.relationship, 'same');
    session.apply(current, response, fingerprint, true);
    assert.equal(session.retries, retry, 'the response must neither reset nor double-count');
  }
  assert.equal(session.lineHint(failed)?.line, 2);
  assert.ok(session.lineHint(failed)?.inlineHint);
});

test('failed analysis is cached and explicit retry does not count the same edit twice', () => {
  const session = new LearningSession();
  const failed = { ...run, output: 'File "/example.py", line 2\nSyntaxError: invalid syntax' };
  session.apply(failed, clue, 'initial', true);
  const changed = { ...failed, source: `${run.source}\n# retry` };
  session.begin(changed, 'failed-request', true);
  assert.equal(session.isDuplicate('failed-request'), true);
  assert.equal(session.retries, 1);
  session.clearCache();
  assert.equal(session.isDuplicate('failed-request'), false);
  session.begin(changed, 'failed-request', true);
  assert.equal(session.retries, 1);
});

test('success drops irrelevant model edit fields and never replays a syntax clue against clean output', () => {
  const current = { ...run, exitCode: 0, output: '1\n2\n3\n4\n5\n', sourceConfirmed: true };
  const stale = validateReply(clue, current, 'clue');
  assert.equal(stale.status, 'needs_clarification');
  assert.equal(stale.category, 'unknown');
  assert.match(stale.message, /Your code runs now/);
  assert.equal(stale.inlineHint, null);
  const solved = validateReply({ ...clue, status: 'solved', relationship: 'same', level: 'inline',
    line: 2, inlineHint: 'outdated hint', replacement: 'unsolicited code', explanation: 'irrelevant' }, current, 'clue');
  assert.equal(solved.level, 'none');
  assert.equal(solved.replacement, null);
  assert.equal(solved.inlineHint, null);
  const session = new LearningSession(); session.apply(run, clue, 'initial', true);
  assert.equal(session.apply(current, solved, 'done', true), true);
  assert.equal(session.issue, '');
});

test('running successfully does not turn a logic error into success or hide errors actually in output', () => {
  const logic = { ...clue, category: 'logic' as const, message: 'Does this include the last number?' };
  const current = { ...run, exitCode: 0, output: '1\n2\n3\n4' };
  assert.equal(validateReply(logic, current, 'clue').status, 'issue');
  assert.equal(validateReply(clue, { ...current, output: 'SyntaxError: recorded error' }, 'clue').status, 'issue');
});

test('helper-only content changes count attempts while identical saved content does not', () => {
  const session = new LearningSession();
  const first = { ...run, contextRevision: 'helper-v1', output: 'Traceback (most recent call last):\n  File "/example.py", line 2\n  File "/helper.py", line 10\nKeyError: qty' };
  session.begin(first, 'initial', true); session.apply(first, { ...clue, category: 'runtime' }, 'initial', true);
  assert.equal(diagnostic(first).line, null, 'a helper line must not decorate the entry file');
  for (let index = 1; index <= 3; index++) {
    const changed = { ...first, contextRevision: `helper-v${index + 1}` };
    session.begin(changed, `attempt-${index}`, true);
    assert.equal(session.retries, index);
    session.apply(changed, { ...clue, category: 'runtime', relationship: 'same' }, `attempt-${index}`, true);
    session.begin({ ...changed, version: 99 }, `saved-${index}`, true);
    assert.equal(session.retries, index);
  }
});

test('diagnostic identity follows the throwing frame, not the entry-point call site', () => {
  const python = { ...run, output: 'Traceback (most recent call last):\n  File "/example.py", line 2\n  File "/helper.py", line 20\nValueError: invalid' };
  assert.match(diagnostic(python).key, /ValueError:\/helper.py:20$/);
  assert.equal(diagnostic(python).line, null);
  const js = { ...run, uri: 'file:///example.js', output: 'TypeError: invalid\n    at load (file:///service.js:20:7)\n    at main (/example.js:2:3)' };
  assert.match(diagnostic(js).key, /TypeError:\/service.js:20$/);
  assert.equal(diagnostic(js).line, null);
});

test('live-model early answers become thinking prompts without another provider request', () => {
  const early = validateReply({ ...clue, category: 'runtime', message: 'The data uses the key "qty". Which name should be used?' }, run, 'clue');
  assert.doesNotMatch(early.message, /qty/);
  assert.match(early.message, /Runtime clue/);
  const inline = validateReply({ ...clue, relationship: 'same', category: 'runtime', level: 'inline', line: 2,
    message: 'Look at the input.', inlineHint: '→ replace item["quantity"] with item["qty"]' }, run, 'inline');
  assert.doesNotMatch(inline.inlineHint!, /replace|qty/);
  assert.equal(inline.line, 2);
  const syntax = validateReply({ ...clue, message: 'Use a colon instead of a semicolon.' }, run, 'clue');
  assert.doesNotMatch(syntax.message, /colon/);
  const fixed = { ...clue, relationship: 'same' as const, level: 'fix' as const,
    replacement: 'print(1)\n', explanation: 'Replace the bad statement.', message: 'Replace the statement.' };
  assert.equal(validateReply(fixed, run, 'fix').message, fixed.message);
});

test('a useful conceptual question is preserved even with an apostrophe', () => {
  const message = "Check the key used for each item's quantity. Does it match the field name in the orders data?";
  assert.equal(validateReply({ ...clue, category: 'runtime', message }, run, 'clue').message, message);
});
