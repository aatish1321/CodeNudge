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
  const element = (id: string) => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id)!;
  };
  runInNewContext(readFileSync(resolve(__dirname, '../../media/panel.js'), 'utf8'), {
    acquireVsCodeApi: () => ({ postMessage: (value: unknown) => sent.push(value) }),
    document: { body: { classList: { toggle() {} } }, getElementById: element, createElement: () => new Element(), addEventListener: (name: string, callback: (event: unknown) => void) => { listeners[name] = callback; } },
    window: { addEventListener: (name: string, callback: (event: unknown) => void) => { listeners[name] = callback; } },
    matchMedia: () => ({ matches: reducedMotion }), setTimeout: (callback: () => void) => timers.push(callback)
  });
  const state = { type: 'state', provider: 'gemini', model: 'fixture-model', keyConfigured: false, file: 'example.py', status: 'Ready', working: false,
    retries: 0, messages: [] as { role: string; text: string }[], proposalId: '', confetti: true, celebration: 0 };
  const render = () => listeners.message({ data: state });
  return { element, state, render, sent, timers, listeners, reduce: () => { reducedMotion = true; } };
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
  ui.timers.splice(0).forEach(callback => callback()); ui.render();
  assert.equal(ui.element('celebration').children.length, 0);
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
