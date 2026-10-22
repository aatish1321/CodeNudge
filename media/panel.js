(() => {
  const vscode = acquireVsCodeApi();
  const input = document.getElementById('clarification');
  const history = document.getElementById('messages');
  let proposalId = '';
  let seenCelebration = null;
  let previousMessages = '';
  let mode = 'debug';
  let projectSignature = '';
  const drafts = { debug: '', project: '' };
  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;
    if (action === 'clarify') {
      if (input.disabled || document.getElementById('send').disabled) return;
      const text = input.value.trim();
      if (!text || text.length > 2000) return;
      vscode.postMessage({ action, text }); input.value = ''; drafts[mode] = '';
    } else vscode.postMessage({ action, proposalId });
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); document.getElementById('send').click(); }
  });
  window.addEventListener('message', event => {
    const state = event.data;
    if (state.type !== 'state') return;
    const nextMode = state.mode === 'project' ? 'project' : 'debug';
    if (nextMode !== mode) {
      drafts[mode] = input.value; mode = nextMode; input.value = drafts[mode];
    }
    const project = mode === 'project' ? state.project : null;
    const messages = project ? project.messages : state.messages;
    const working = project ? project.working : state.working;
    document.getElementById('modeDebug').setAttribute('aria-pressed', mode === 'debug' ? 'true' : 'false');
    document.getElementById('modeProject').setAttribute('aria-pressed', mode === 'project' ? 'true' : 'false');
    document.body.classList.toggle('is-working', working);
    document.body.classList.toggle('character-motion-off', state.animateCharacter === false);
    document.getElementById('buddyMood').textContent = !state.trusted ? 'Trust this folder to begin' : working ? 'Thinking it through' : project ? (project.phase === 'done' ? 'Project complete' : 'One task at a time') : state.proposalId ? 'A fix to review' : state.hasIssue ? (state.retries >= 3 ? 'Let’s look closer' : 'A clue to start') : 'Ready when you are';
    document.getElementById('learningTrail').hidden = mode === 'project' || !state.hasIssue;
    document.getElementById('learningSummary').hidden = mode === 'project' || !state.hasIssue;
    const stage = state.proposalId || state.retries >= 6 ? 'stageFix' : state.retries >= 3 ? 'stageInline' : 'stageClue';
    for (const id of ['stageClue', 'stageInline', 'stageFix']) document.getElementById(id).setAttribute('aria-current', id === stage ? 'step' : 'false');
    document.getElementById('learningSummary').setAttribute('data-stage', stage);
    const effort = state.retries >= 6 ? 3 : state.retries % 3;
    for (let index = 1; index <= 3; index++) document.getElementById(`effortPip${index}`).setAttribute('data-filled', index <= effort ? 'true' : 'false');
    document.getElementById('setup').hidden = state.keyConfigured || !state.trusted;
    document.getElementById('trustPrompt').hidden = state.trusted;
    document.getElementById('file').textContent = project ? '' : state.file || '';
    document.getElementById('file').setAttribute('title', project ? '' : state.file || '');
    document.getElementById('status').textContent = project ? (!state.trusted ? 'Trust this folder to plan and build with CodeNudge.' : project.status) : state.status;
    document.getElementById('working').hidden = !working;
    document.getElementById('send').disabled = working || !state.trusted || (!!project && project.phase === 'done');
    input.disabled = !state.trusted || (!!project && (working || project.phase === 'done'));
    input.placeholder = !project ? 'A question, or what you’ve tried…' : ({ idea: 'What would you like to build?', choice: 'Tell me the features you have in mind…', features: 'Add a little more detail…', plan: 'What would you change about this plan?', building: 'Share your thinking, a question or a run result…', done: 'Ready for another idea?' }[project.phase]);
    renderProject(project, state.trusted);
    if (seenCelebration !== null && state.celebration > seenCelebration && state.confetti && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.body.classList.toggle('is-celebrating', true);
      const celebration = document.getElementById('celebration');
      celebration.replaceChildren(...Array.from({ length: 28 }, () => {
        const piece = document.createElement('span'); piece.className = 'confetti-piece'; return piece;
      }));
      setTimeout(() => { celebration.replaceChildren(); document.body.classList.toggle('is-celebrating', false); }, 2500);
    }
    seenCelebration = state.celebration;
    proposalId = state.proposalId;
    document.getElementById('fixActions').hidden = mode === 'project' || !proposalId;
    document.getElementById('progress').textContent = mode === 'project' || !state.hasIssue ? '' : proposalId ? 'Your change is ready to review.' : state.retries >= 6 ? 'Review unlocked. Checking the current problem.' : state.retries >= 3 ? `${state.retries - 3}/3 more changed runs to a reviewed fix` : `${state.retries}/3 changed runs to an inline hint`;
    const messageSignature = mode + JSON.stringify(messages);
    if (messageSignature !== previousMessages) {
      previousMessages = messageSignature;
      history.replaceChildren(...messages.map(message => {
      const block = document.createElement('article'); block.className = `message ${message.role}`;
      block.dataset.category = message.category || 'unknown';
      const label = document.createElement('div'); label.className = 'message-label';
      label.textContent = message.role === 'learner' ? 'Your note' : `NUDGE${message.category && message.category !== 'unknown' ? ' / ' + message.category.toUpperCase() : ''}`;
      const text = document.createElement('p'); text.textContent = message.text;
      block.append(label, text); return block;
      }));
      const conversation = document.getElementById('conversation');
      conversation.scrollTop = conversation.scrollHeight;
    }
  });
  function renderProject(project, trusted) {
    const section = document.getElementById('project');
    section.hidden = !project;
    if (!project) { projectSignature = ''; return; }
    const signature = JSON.stringify([project, trusted]);
    if (signature === projectSignature) return;
    projectSignature = signature;
    section.replaceChildren();
    const text = (tag, content, parent = section, className = '') => {
      const node = document.createElement(tag); node.textContent = content; node.className = className; parent.append(node); return node;
    };
    const actions = document.createElement('div'); actions.className = 'project-actions';
    const button = (action, label) => {
      const node = text('button', label, actions, ['projectSuggest', 'projectStart', 'projectHint', 'projectReset'].includes(action) ? 'primary' : 'secondary'); node.dataset.action = action;
      node.disabled = !trusted || project.working; return node;
    };
    if (project.phase === 'idea') {
      text('h2', 'What would you like to build?');
      text('p', 'Describe your idea below. We’ll work out a small plan, then you’ll build it one task at a time.');
    } else if (project.phase === 'choice') {
      text('h2', 'Choose a starting point'); text('p', project.idea);
      button('projectFeatures', 'I have features in mind'); button('projectSuggest', 'Suggest a plan');
    } else if (project.phase === 'features') {
      text('h2', 'What should it do?');
      text('p', 'Share the features you want in your note below, or answer the question to refine the plan.');
    } else if (project.phase === 'plan' && project.plan) {
      text('span', 'PROPOSED PLAN', section, 'eyebrow'); text('h2', project.plan.title);
      const list = document.createElement('ol'); list.className = 'project-plan';
      for (const task of project.plan.tasks) {
        const item = document.createElement('li'); text('h3', task.title, item); text('p', task.prompt, item);
        text('p', 'Try it: ' + task.check, item, 'task-check'); list.append(item);
      }
      section.append(list); text('p', 'Want to change anything? Tell me below before we start.');
      button('projectStart', 'Start building');
    } else if (project.phase === 'building' && project.plan) {
      const task = project.plan.tasks[project.current];
      text('span', `STEP ${project.current + 1} OF ${project.plan.tasks.length}`, section, 'eyebrow');
      if (task) {
        text('h2', task.title); text('p', task.prompt); text('p', 'Try it: ' + task.check, section, 'task-check');
      }
      if (project.ready) text('p', 'Looks on track—try the check, then mark done when you’re happy.', section, 'task-check');
      button('projectHint', 'Nudge me'); button('projectReview', 'Check my attempt'); button('projectDone', 'Mark done');
      const remaining = project.plan.tasks.slice(project.current + 1);
      if (remaining.length) {
        const details = document.createElement('details'); text('summary', 'Coming up', details);
        const list = document.createElement('ol'); list.setAttribute('start', String(project.current + 2));
        for (const next of remaining) text('li', next.title, list);
        details.append(list); section.append(details);
      }
    } else if (project.phase === 'done') {
      text('span', 'PROJECT COMPLETE', section, 'eyebrow'); text('h2', 'You built it.');
      text('p', project.plan ? project.plan.title : project.idea); text('p', 'Your tasks are complete. Run through the finished project and see how far you’ve come.');
      button('projectReset', 'New idea');
    }
    if (project.error) { text('p', project.error, section, 'project-error').setAttribute('role', 'alert'); button('projectRetry', 'Try again'); }
    if (project.phase !== 'idea' && project.phase !== 'done') {
      const cancel = button('projectCancel', 'Cancel project'); cancel.className = 'text-button'; cancel.disabled = !trusted;
    }
    section.append(actions);
  }
  vscode.postMessage({ action: 'ready' });
})();
