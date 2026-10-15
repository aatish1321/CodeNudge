(() => {
  const vscode = acquireVsCodeApi();
  const input = document.getElementById('clarification');
  const history = document.getElementById('messages');
  document.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    if (action === 'clarify') {
      const text = input.value.trim();
      if (!text) return;
      vscode.postMessage({ action, text }); input.value = '';
    } else vscode.postMessage({ action });
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); document.getElementById('send').click(); }
  });
  window.addEventListener('message', event => {
    const state = event.data;
    if (state.type !== 'state') return;
    document.getElementById('provider').textContent = state.provider.toUpperCase();
    document.getElementById('model').textContent = `${state.model} · Connected code and results go to ${state.provider}.`;
    document.getElementById('keyButton').textContent = state.keyConfigured ? 'Update key' : 'Add key';
    document.getElementById('file').textContent = state.file || 'No file connected';
    document.getElementById('status').textContent = state.status;
    document.getElementById('working').hidden = !state.working;
    document.getElementById('send').disabled = state.working;
    history.replaceChildren(...state.messages.map(message => {
      const block = document.createElement('article'); block.className = `message ${message.role}`;
      const label = document.createElement('div'); label.className = 'message-label';
      label.textContent = message.role === 'learner' ? 'YOU' : `BUDDY${message.category && message.category !== 'unknown' ? ' · ' + message.category.toUpperCase() : ''}`;
      const text = document.createElement('p'); text.textContent = message.text;
      block.append(label, text); return block;
    }));
  });
  vscode.postMessage({ action: 'ready' });
})();
