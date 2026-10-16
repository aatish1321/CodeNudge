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
    document.body.classList.toggle('has-messages', messages.length > 0 || (project ? !!project.idea : !!state.file));
    document.body.classList.toggle('is-working', working);
    document.body.classList.toggle('character-motion-off', state.animateCharacter === false);
    document.getElementById('buddyMood').textContent = !state.trusted ? 'Let’s get set up' : working ? 'Thinking with you…' : project ? (project.phase === 'done' ? 'Look what you built!' : 'One small step together') : state.proposalId ? 'A little backup, if you need it' : 'Right here with you';
    document.getElementById('eyebrow').textContent = project ? 'YOUR IDEA. YOUR DISCOVERY.' : state.proposalId ? 'YOUR CODE. YOUR CALL.' : state.retries >= 3 ? 'ONE LINE AT A TIME.' : 'SMALL CLUES. BIG DISCOVERIES.';
    document.getElementById('learningTrail').hidden = mode === 'project' || !state.hasIssue;
    const stage = state.proposalId || state.retries >= 6 ? 'stageFix' : state.retries >= 3 ? 'stageInline' : 'stageClue';
    for (const id of ['stageClue', 'stageInline', 'stageFix']) document.getElementById(id).setAttribute('aria-current', id === stage ? 'step' : 'false');
    document.getElementById('setup').hidden = state.keyConfigured || !state.trusted;
    document.getElementById('trustPrompt').hidden = state.trusted;
    document.getElementById('file').textContent = project ? '' : state.file || '';
    document.getElementById('status').textContent = project ? (!state.trusted ? 'Trust this folder to plan and build with Buddy.' : project.status) : state.status;
    document.getElementById('working').hidden = !working;
    document.getElementById('send').disabled = working || !state.trusted || (!!project && project.phase === 'done');
    input.disabled = !state.trusted || (!!project && (working || project.phase === 'done'));
    input.placeholder = !project ? 'What are you thinking?' : ({ idea: 'What would you like to build?', choice: 'Tell me the features you have in mind…', features: 'Add a little more detail…', plan: 'What would you change about this plan?', building: 'Share your thinking, a question or a run result…', done: 'Ready for another idea?' }[project.phase]);
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
    document.getElementById('progress').textContent = mode === 'project' ? '' : proposalId ? 'A fix is ready for you to review.' : state.retries >= 3 ? `${state.retries} attempts. Let’s narrow this down.` : '';
    const messageSignature = mode + JSON.stringify(messages);
    if (messageSignature !== previousMessages) {
      previousMessages = messageSignature;
      history.replaceChildren(...messages.map(message => {
      const block = document.createElement('article'); block.className = `message ${message.role}`;
      block.dataset.category = message.category || 'unknown';
      const label = document.createElement('div'); label.className = 'message-label';
      label.textContent = message.role === 'learner' ? 'YOUR THINKING' : `✦ BUDDY${message.category && message.category !== 'unknown' ? ' · ' + message.category.toUpperCase() : ''}`;
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
      const node = text('button', label, actions, 'primary'); node.dataset.action = action;
      node.disabled = !trusted || project.working; return node;
    };
    if (project.phase === 'idea') {
      text('h2', 'What would you like to build?');
      text('p', 'A tiny tool, a game, your first app? Tell me your idea below. We’ll break it into steps you can figure out.');
    } else if (project.phase === 'choice') {
      text('h2', 'How shall we shape it?'); text('p', project.idea);
      button('projectFeatures', 'I have features in mind'); button('projectSuggest', 'Suggest a plan');
    } else if (project.phase === 'features') {
      text('h2', 'A little more detail');
      text('p', 'Reply to Buddy below. Share your must-haves, or answer the question so we can shape your plan.');
    } else if (project.phase === 'plan' && project.plan) {
      text('span', 'YOUR BUILDING BLOCKS', section, 'eyebrow'); text('h2', project.plan.title);
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
      text('span', '✦ YOU BUILT THAT', section, 'eyebrow'); text('h2', 'From idea to something real.');
      text('p', project.plan ? project.plan.title : project.idea); text('p', 'You did the thinking and the building. Take a moment to enjoy it!');
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
