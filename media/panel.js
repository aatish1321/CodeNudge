(() => {
  const vscode = acquireVsCodeApi();
  const input = document.getElementById('clarification');
  const history = document.getElementById('messages');
  let proposalId = '';
  let seenCelebration = null;
  let previousMessages = '';
  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'clarify') {
      const text = input.value.trim();
      if (!text) return;
      vscode.postMessage({ action, text }); input.value = '';
    } else vscode.postMessage({ action, proposalId });
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); document.getElementById('send').click(); }
  });
  window.addEventListener('message', event => {
    const state = event.data;
    if (state.type !== 'state') return;
    document.body.classList.toggle('has-messages', state.messages.length > 0 || !!state.file);
    document.body.classList.toggle('is-working', state.working);
    document.getElementById('buddyMood').textContent = !state.trusted ? 'Let’s get set up' : state.working ? 'Thinking with you…' : state.proposalId ? 'A little backup, if you need it' : 'Right here with you';
    document.getElementById('eyebrow').textContent = state.proposalId ? 'YOUR CODE. YOUR CALL.' : state.retries >= 3 ? 'ONE LINE AT A TIME.' : 'SMALL CLUES. BIG DISCOVERIES.';
    document.getElementById('learningTrail').hidden = !state.hasIssue;
    const stage = state.proposalId || state.retries >= 6 ? 'stageFix' : state.retries >= 3 ? 'stageInline' : 'stageClue';
    for (const id of ['stageClue', 'stageInline', 'stageFix']) document.getElementById(id).setAttribute('aria-current', id === stage ? 'step' : 'false');
    document.getElementById('setup').hidden = state.keyConfigured || !state.trusted;
    document.getElementById('trustPrompt').hidden = state.trusted;
    document.getElementById('file').textContent = state.file || '';
    document.getElementById('status').textContent = state.status;
    document.getElementById('working').hidden = !state.working;
    document.getElementById('send').disabled = state.working || !state.trusted;
    input.disabled = !state.trusted;
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
    document.getElementById('fixActions').hidden = !proposalId;
    document.getElementById('progress').textContent = proposalId ? 'A fix is ready for you to review.' : state.retries >= 3 ? `${state.retries} attempts. Let’s narrow this down.` : '';
    const messages = JSON.stringify(state.messages);
    if (messages !== previousMessages) {
      previousMessages = messages;
      history.replaceChildren(...state.messages.map(message => {
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
  vscode.postMessage({ action: 'ready' });
})();
