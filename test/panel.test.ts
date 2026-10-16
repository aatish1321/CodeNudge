import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

class Element {
  textContent = ''; value = ''; className = ''; hidden = false; disabled = false;
  scrollTop = 0; scrollHeight = 600;
  dataset: Record<string, string> = {};
  children: Element[] = [];
  attributes: Record<string, string> = {};
  addEventListener(): void {}
  replaceChildren(...children: Element[]): void { this.children = children; }
  append(...children: Element[]): void { this.children.push(...children); }
  setAttribute(key: string, value: string): void { this.attributes[key] = value; }
}

function panel() {
  const elements = new Map<string, Element>();
  const listeners: Record<string, (event: unknown) => void> = {};
  const sent: unknown[] = []; const timers: (() => void)[] = [];
  let reducedMotion = false;
  const classes = new Set<string>();
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id)!;
  };
  runInNewContext(readFileSync(resolve(__dirname, '../../media/panel.js'), 'utf8'), {
    acquireVsCodeApi: () => ({ postMessage: (value: unknown) => sent.push(value) }),
    document: { body: { classList: { toggle(name: string, active: boolean) { if (active) classes.add(name); else classes.delete(name); } } }, getElementById: element, createElement: () => new Element(), addEventListener: (name: string, callback: (event: unknown) => void) => { listeners[name] = callback; } },
    window: { addEventListener: (name: string, callback: (event: unknown) => void) => { listeners[name] = callback; } },
    matchMedia: () => ({ matches: reducedMotion }), setTimeout: (callback: () => void) => timers.push(callback)
  });
  const state = { type: 'state', trusted: true, provider: 'gemini', model: 'fixture-model', keyConfigured: false, file: 'example.py', status: 'Ready', working: false,
    retries: 0, hasIssue: false, messages: [] as { role: string; text: string; category?: string }[], proposalId: '', confetti: true, animateCharacter: true, celebration: 0 };
  const render = () => listeners.message({ data: state });
  return { element, state, render, sent, timers, listeners, classes, reduce: () => { reducedMotion = true; } };
}

test('shipped panel renders model text literally and preserves review controls', () => {
  const ui = panel();
  ui.state.messages = [{ role: 'buddy', text: '<script>do not execute</script>' }];
  ui.state.proposalId = 'proposal-1'; ui.state.working = true;
  ui.render();
  assert.equal(ui.element('messages').children[0].children[1].textContent, '<script>do not execute</script>');
  assert.equal(ui.element('fixActions').hidden, false);
  assert.equal(ui.element('send').disabled, true);
  ui.state.proposalId = ''; ui.render();
  assert.equal(ui.element('fixActions').hidden, true);
});

test('confetti fires once, obeys its setting and reduced motion, and does not replay on first render', () => {
  const ui = panel(); ui.render();
  assert.equal(ui.element('celebration').children.length, 0);
  ui.state.celebration = 1; ui.render();
  assert.equal(ui.element('celebration').children.length, 28);
  assert.equal(ui.classes.has('is-celebrating'), true);
  ui.timers.splice(0).forEach(callback => callback()); ui.render();
  assert.equal(ui.element('celebration').children.length, 0);
  assert.equal(ui.classes.has('is-celebrating'), false);
  ui.state.confetti = false; ui.state.celebration = 2; ui.render();
  assert.equal(ui.element('celebration').children.length, 0);
  ui.state.confetti = true; ui.reduce(); ui.state.celebration = 3; ui.render();
  assert.equal(ui.element('celebration').children.length, 0);
  const reopened = panel(); reopened.state.celebration = 9; reopened.render();
  assert.equal(reopened.element('celebration').children.length, 0);
});

test('the composer sends clarification and the gear opens settings without sending typed text', () => {
  const ui = panel(); ui.render();
  for (const action of ['clarify', 'settings']) {
    const button = new Element(); button.dataset.action = action;
    ui.element('clarification').value = '  expected five numbers  ';
    ui.listeners.click({ target: { closest: () => button } });
    const message = ui.sent.at(-1) as { action: string; text: string };
    assert.equal(message.action, action);
    assert.equal(message.text, action === 'clarify' ? 'expected five numbers' : undefined);
    assert.equal(ui.element('clarification').value, action === 'clarify' ? '' : '  expected five numbers  ');
  }
});

test('new clues scroll into view and status updates preserve the reading position', () => {
  const ui = panel(); ui.render();
  ui.state.messages = [{ role: 'buddy', text: 'Try following this value.' }]; ui.render();
  assert.equal(ui.element('conversation').scrollTop, 600);
  ui.element('conversation').scrollTop = 40;
  ui.state.status = 'Checking your goal'; ui.render();
  assert.equal(ui.element('conversation').scrollTop, 40);
  ui.state.messages.push({ role: 'buddy', text: 'Which operation consumes it?' }); ui.render();
  assert.equal(ui.element('conversation').scrollTop, 600);
});

test('Restricted Mode shows a trust action and disables the composer until trust is granted', () => {
  const ui = panel();
  ui.state.trusted = false; ui.render();
  assert.equal(ui.element('trustPrompt').hidden, false);
  assert.equal(ui.element('send').disabled, true);
  assert.equal(ui.element('clarification').disabled, true);
  assert.equal(ui.element('setup').hidden, true);
  const button = new Element(); button.dataset.action = 'trust';
  ui.listeners.click({ target: { closest: () => button } });
  assert.equal((ui.sent.at(-1) as {action: string}).action, 'trust');
  ui.state.trusted = true; ui.render();
  assert.equal(ui.element('trustPrompt').hidden, true);
  assert.equal(ui.element('send').disabled, false);
  assert.equal(ui.element('clarification').disabled, false);
});

test('buddy mood and help trail follow actual issue stages and disappear after resolution', () => {
  const ui = panel(); ui.render();
  assert.equal(ui.element('learningTrail').hidden, true);
  ui.state.hasIssue = true;
  ui.state.messages = [{ role: 'buddy', text: 'What kind of value is in this list?', category: 'runtime' }];
  ui.render();
  assert.equal(ui.element('learningTrail').hidden, false);
  assert.equal(ui.element('stageClue').attributes['aria-current'], 'step');
  assert.equal(ui.element('messages').children[0].dataset.category, 'runtime');
  ui.state.working = true; ui.render();
  assert.equal(ui.element('buddyMood').textContent, 'Thinking with you…');
  assert.equal(ui.classes.has('is-working'), true);
  ui.state.working = false; ui.state.retries = 3; ui.render();
  assert.equal(ui.element('stageInline').attributes['aria-current'], 'step');
  assert.equal(ui.element('stageClue').attributes['aria-current'], 'false');
  ui.state.retries = 6; ui.state.proposalId = 'review'; ui.render();
  assert.equal(ui.element('stageFix').attributes['aria-current'], 'step');
  assert.equal(ui.element('eyebrow').textContent, 'YOUR CODE. YOUR CALL.');
  ui.state.hasIssue = false; ui.state.retries = 0; ui.state.proposalId = ''; ui.render();
  assert.equal(ui.element('learningTrail').hidden, true);
  assert.equal(ui.classes.has('is-working'), false);
});

test('character motion can pause while thinking without turning off the separate celebration setting', () => {
  const ui = panel(); ui.render();
  assert.equal(ui.classes.has('character-motion-off'), false);
  ui.state.working = true; ui.state.animateCharacter = false; ui.render();
  assert.equal(ui.classes.has('is-working'), true);
  assert.equal(ui.classes.has('character-motion-off'), true);
  assert.equal(ui.state.confetti, true);
  ui.state.animateCharacter = true; ui.render();
  assert.equal(ui.classes.has('character-motion-off'), false);
});
