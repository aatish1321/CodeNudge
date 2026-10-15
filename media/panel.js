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
    document.getElementById('setup').hidden = state.keyConfigured;
    document.getElementById('file').textContent = state.file || '';
    document.getElementById('status').textContent = state.status;
    document.getElementById('working').hidden = !state.working;
    document.getElementById('send').disabled = state.working;
    if (seenCelebration !== null && state.celebration > seenCelebration && state.confetti && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const celebration = document.getElementById('celebration');
      celebration.replaceChildren(...Array.from({ length: 28 }, () => {
        const piece = document.createElement('span'); piece.className = 'confetti-piece'; return piece;
      }));
      setTimeout(() => celebration.replaceChildren(), 2500);
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
      const label = document.createElement('div'); label.className = 'message-label';
      label.textContent = message.role === 'learner' ? 'YOU' : `BUDDY${message.category && message.category !== 'unknown' ? ' · ' + message.category.toUpperCase() : ''}`;
      const text = document.createElement('p'); text.textContent = message.text;
      block.append(label, text); return block;
      }));
      const conversation = document.getElementById('conversation');
      conversation.scrollTop = conversation.scrollHeight;
    }
  });
  vscode.postMessage({ action: 'ready' });
})();
