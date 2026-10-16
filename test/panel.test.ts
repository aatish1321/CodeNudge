import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import type { ProjectView } from '../src/project';

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
    mode: undefined as 'debug' | 'project' | undefined, project: undefined as ProjectView | undefined,
    retries: 0, hasIssue: false, messages: [] as { role: string; text: string; category?: string }[], proposalId: '', confetti: true, animateCharacter: true, celebration: 0 };
  const render = () => listeners.message({ data: state });
  return { element, state, render, sent, timers, listeners, classes, reduce: () => { reducedMotion = true; } };
}

function project(phase: ProjectView['phase'] = 'idea'): ProjectView {
  return { version: 1, phase, idea: 'A tiny score keeper', features: '', current: 0, messages: [], working: false, error: '', status: 'Let’s build it.', ready: false,
    plan: phase === 'idea' || phase === 'choice' || phase === 'features' ? null : { title: 'Score keeper', tasks: [
      { title: 'Keep a score', prompt: 'Think about where the current score lives.', check: 'Start with zero points.' },
      { title: 'Add points', prompt: 'How can the score change?', check: 'Add a point and see the score change.' }
    ] } };
}

function descendants(element: Element): Element[] { return element.children.flatMap(child => [child, ...descendants(child)]); }
function action(ui: ReturnType<typeof panel>, name: string): Element {
  const button = descendants(ui.element('project')).find(child => child.dataset.action === name);
  assert.ok(button, `Expected ${name} button`); return button;
}

test('Project mode asks for an idea, offers features or generated plan, and starts an approved plan', () => {
  const ui = panel(); ui.state.mode = 'project'; ui.state.project = project(); ui.render();
  assert.equal(ui.element('project').hidden, false);
  assert.ok(descendants(ui.element('project')).some(child => child.textContent === 'What would you like to build?'));
  ui.state.project.phase = 'choice'; ui.render();
  for (const name of ['projectFeatures', 'projectSuggest']) {
    const button = action(ui, name); assert.equal(button.disabled, false);
    ui.listeners.click({ target: { closest: () => button } });
    assert.equal((ui.sent.at(-1) as { action: string }).action, name);
  }
  ui.state.project.phase = 'features'; ui.render();
  assert.equal(ui.element('clarification').disabled, false);
  assert.ok(descendants(ui.element('project')).some(child => child.textContent === 'A little more detail'));
  assert.ok(descendants(ui.element('project')).some(child => child.textContent.startsWith('Reply to Buddy below.')));
  ui.state.project = project('plan'); ui.render();
  assert.equal(action(ui, 'projectStart').disabled, false);
  assert.ok(descendants(ui.element('project')).some(child => child.className === 'project-plan' && child.children.length === 2));
});

test('Project tasks and conversation render as literal text and Debug issue controls stay hidden', () => {
  const ui = panel(); ui.state.mode = 'project'; const data = project('plan');
  data.plan!.title = '<img src=x onerror=alert(1)>';
  data.plan!.tasks[0].prompt = '<script>literal task</script>';
  data.messages.push({ role: 'buddy', text: '<button>literal message</button>' });
  ui.state.project = data; ui.state.messages = [{ role: 'buddy', text: 'Debug clue' }];
  ui.state.hasIssue = true; ui.state.proposalId = 'debug-fix'; ui.state.retries = 6; ui.render();
  assert.ok(descendants(ui.element('project')).some(child => child.textContent === '<img src=x onerror=alert(1)>' && child.children.length === 0));
  assert.ok(descendants(ui.element('project')).some(child => child.textContent === '<script>literal task</script>' && child.children.length === 0));
  assert.equal(ui.element('messages').children[0].children[1].textContent, '<button>literal message</button>');
  assert.equal(ui.element('learningTrail').hidden, true); assert.equal(ui.element('fixActions').hidden, true);
  assert.equal(ui.element('file').textContent, ''); assert.equal(ui.element('progress').textContent, '');
  assert.equal(ui.element('status').textContent, data.status);
});

test('Project building exposes learner-led help, checks and completion without requiring AI approval', () => {
  const ui = panel(); ui.state.mode = 'project'; ui.state.project = project('building'); ui.render();
  for (const name of ['projectHint', 'projectReview', 'projectDone']) assert.equal(action(ui, name).disabled, false);
  assert.ok(descendants(ui.element('project')).some(child => child.textContent === 'STEP 1 OF 2'));
  assert.ok(descendants(ui.element('project')).some(child => child.textContent === 'Coming up'));
  ui.state.project.ready = true; ui.render();
  assert.ok(descendants(ui.element('project')).some(child => child.textContent.startsWith('Looks on track')));
  ui.state.project.phase = 'done'; ui.render();
  assert.equal(action(ui, 'projectReset').disabled, false);
  assert.equal(ui.element('clarification').disabled, true); assert.equal(ui.element('send').disabled, true);
  assert.equal(ui.element('buddyMood').textContent, 'Look what you built!');
});

test('Project work and Restricted Mode disable actions while mode switches remain available', () => {
  const ui = panel(); ui.state.mode = 'project'; ui.state.project = project('building'); ui.state.project.working = true; ui.render();
  assert.equal(ui.classes.has('is-working'), true);
  for (const name of ['projectHint', 'projectReview', 'projectDone']) assert.equal(action(ui, name).disabled, true);
  assert.equal(ui.element('clarification').disabled, true); assert.equal(ui.element('send').disabled, true);
  const disabled = action(ui, 'projectDone'); const sent = ui.sent.length;
  ui.listeners.click({ target: { closest: () => disabled } }); assert.equal(ui.sent.length, sent);
  assert.equal(ui.element('modeDebug').disabled, false); assert.equal(ui.element('modeProject').disabled, false);
  ui.state.project.working = false; ui.state.trusted = false; ui.render();
  assert.equal(action(ui, 'projectDone').disabled, true); assert.equal(ui.element('trustPrompt').hidden, false);
  assert.equal(ui.element('status').textContent, 'Trust this folder to plan and build with Buddy.');
  ui.state.trusted = true; ui.render(); assert.equal(ui.element('status').textContent, ui.state.project.status);
});

test('Project and Debug mode preserve separate unsent drafts and restore the Debug conversation', () => {
  const ui = panel(); ui.state.messages = [{ role: 'buddy', text: 'Existing Debug clue' }]; ui.state.hasIssue = true; ui.render();
  ui.element('clarification').value = 'My Debug question';
  ui.state.mode = 'project'; ui.state.project = project('building'); ui.render();
  assert.equal(ui.element('clarification').value, '');
  ui.element('clarification').value = 'My project idea';
  ui.state.mode = 'debug'; ui.render();
  assert.equal(ui.element('clarification').value, 'My Debug question'); assert.equal(ui.element('project').hidden, true);
  assert.equal(ui.element('messages').children[0].children[1].textContent, 'Existing Debug clue');
  assert.equal(ui.element('learningTrail').hidden, false); assert.equal(ui.element('status').textContent, 'Ready');
  ui.state.mode = 'project'; ui.render(); assert.equal(ui.element('clarification').value, 'My project idea');
});

test('Project errors offer retry and text submission keeps the existing bounded clarification contract', () => {
  const ui = panel(); ui.state.mode = 'project'; ui.state.project = project('plan'); ui.state.project.error = '<script>provider error</script>'; ui.render();
  const retry = action(ui, 'projectRetry'); assert.equal(retry.disabled, false);
  const error = descendants(ui.element('project')).find(child => child.attributes.role === 'alert');
  assert.equal(error!.textContent, '<script>provider error</script>');
  const button = new Element(); button.dataset.action = 'clarify'; ui.element('clarification').value = 'Add a reset button';
  ui.listeners.click({ target: { closest: () => button } });
  assert.equal((ui.sent.at(-1) as { action: string; text: string }).text, 'Add a reset button');
  const sent = ui.sent.length; ui.element('clarification').value = 'x'.repeat(2001);
  ui.listeners.click({ target: { closest: () => button } }); assert.equal(ui.sent.length, sent);
});

test('Project plan and task controls follow conversation history so new-task scrolling keeps actions visible', () => {
  const html = readFileSync(resolve(__dirname, '../../src/panel.ts'), 'utf8');
  assert.ok(html.indexOf('id="messages"') < html.indexOf('id="project"'));
  assert.ok(html.indexOf('id="project"') < html.indexOf('id="fixActions"'));
});

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
