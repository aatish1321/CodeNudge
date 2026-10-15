import * as vscode from 'vscode';
import { basename } from 'node:path';
import { analyze } from './providers';
import { BuddyPanel, PanelState } from './panel';
import { LearningSession } from './session';
import { configuration, keyName, setKey } from './settings';
import { checkSource, RunSnapshot, validateReply } from './teaching';
import { TerminalCapture } from './terminal';

export function activate(context: vscode.ExtensionContext): void {
  let session = new LearningSession();
  let linked: vscode.TextDocument | undefined;
  let latestRun: RunSnapshot | undefined;
  let pending: AbortController | undefined;
  let requestGeneration = 0;
  let requestCount = 0;
  const state: PanelState = { provider: 'gemini', model: '', keyConfigured: false, file: '', status: 'Ready when you are.', working: false, retries: 0, messages: [] };
  const log = vscode.window.createOutputChannel('Coding Buddy');

  async function refresh(): Promise<void> {
    try {
      const config = configuration();
      state.provider = config.provider; state.model = config.model;
      state.keyConfigured = !!await context.secrets.get(keyName(config.provider));
      state.retries = session.retries;
      panel.update(state);
    } catch (error) { state.status = (error as Error).message; panel.update(state); }
  }

  function status(message: string): void { state.status = message; void refresh(); }
  function cancel(): void { requestGeneration++; pending?.abort(); pending = undefined; state.working = false; }
  function message(role: 'buddy' | 'learner', text: string, category?: string): void { state.messages = [...state.messages.slice(-7), { role, text, category }]; }

  async function runAnalysis(run: RunSnapshot, attempt: boolean): Promise<void> {
    if (!vscode.workspace.isTrusted) { status('Trust this workspace before sharing coding context.'); return; }
    let mine = requestGeneration;
    try {
      checkSource(run.source, vscode.Uri.parse(run.uri).fsPath);
      const config = configuration();
      const fingerprint = session.fingerprint(run, config.provider, config.model, attempt);
      if (session.isDuplicate(fingerprint)) { status('Same code and result — your previous hint is still here.'); return; }
      if (state.working) return;
      const key = await context.secrets.get(keyName(config.provider));
      if (!key) { status('Add your provider API key with the Add key button, then retry.'); return; }
      if (state.working || mine !== requestGeneration) return;
      pending = new AbortController(); mine = ++requestGeneration; state.working = true;
      status('Looking for a useful clue…');
      log.appendLine(`Analysis request ${++requestCount}: provider=${config.provider}; source=${run.reported ? 'learner-reported' : 'terminal'}`);
      const result = await analyze(config.provider, config.model, key, session.context(run, attempt), pending.signal);
      if (mine !== requestGeneration || !linked || linked.isClosed || linked.isDirty || linked.version !== run.version || linked.getText() !== run.source) return;
      const reply = validateReply(result, run, session.allowedLevel(run, attempt));
      session.apply(run, reply, fingerprint, attempt);
      message('buddy', reply.message, reply.category);
      state.status = reply.status === 'needs_clarification' ? 'Your turn — tell the buddy what you expected.' : 'Your turn. Try a change, save, and run again.';
    } catch (error) {
      if (mine === requestGeneration) {
        const cause = error as Error;
        state.status = cause.name === 'AbortError' || cause.name === 'TimeoutError' ? 'The request took too long. Try again when you are ready.'
          : cause instanceof TypeError ? 'Could not reach the provider. Check your connection and retry.' : cause.message;
      }
    } finally {
      if (mine === requestGeneration) { pending = undefined; state.working = false; await refresh(); }
    }
  }

  async function connect(): Promise<void> {
    const document = vscode.window.activeTextEditor?.document;
    if (!document || document.uri.scheme !== 'file') { status('Open a saved code file before connecting a terminal.'); return; }
    checkSource(document.getText(), document.fileName);
    if (document.isDirty) { status('Save this file first, then connect the terminal.'); return; }
    const terminals = vscode.window.terminals;
    const choice = terminals.length ? await vscode.window.showQuickPick(terminals.map(terminal => ({ label: terminal.name, terminal })),
      { title: 'Choose the terminal for this file', placeHolder: 'Only this terminal and its next code command will be watched.' }) : undefined;
    if (terminals.length && !choice) return;
    const terminal = choice?.terminal ?? vscode.window.createTerminal('Coding Buddy');
    cancel(); session = new LearningSession(); latestRun = undefined; linked = document;
    state.file = basename(document.fileName); state.messages = [];
    capture.connect(document, terminal); terminal.show();
    if (!terminal.shellIntegration) status('Connected. If capture is unavailable, enable VS Code shell integration or share the result manually. Run your code next.');
  }

  async function action(name: string, text?: string): Promise<void> {
    try {
      if (name === 'settings') await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:aatish1321.coding-buddy');
      else if (name === 'setKey') { await setKey(context); await refresh(); }
      else if (name === 'connect') await connect();
      else if (name === 'disconnect') { cancel(); capture.disconnect(); linked = undefined; latestRun = undefined; session = new LearningSession(); state.file = ''; status('Disconnected.'); }
      else if (name === 'reset') { cancel(); session = new LearningSession(); state.messages = []; status('Fresh start. Run your code when you are ready.'); }
      else if (name === 'retry' && latestRun) await runAnalysis(latestRun, true);
      else if (name === 'clarify' && text?.trim()) {
        if (state.working) return;
        session.clarification = `${session.clarification}\n${text.trim()}`.trim().slice(-2_000);
        message('learner', text.trim());
        if (latestRun && linked && !linked.isDirty && linked.version === latestRun.version) await runAnalysis(latestRun, false);
        else status('Context saved. Save and run the connected file so the buddy can check the result.');
      }
    } catch (error) { status((error as Error).message); }
  }

  const panel = new BuddyPanel(context.extensionUri, action);
  const capture = new TerminalCapture(run => { latestRun = run; void runAnalysis(run, true); }, status);
  const register = (name: string, handler: () => unknown) => context.subscriptions.push(vscode.commands.registerCommand(`codingBuddy.${name}`, handler));
  for (const name of ['connect','disconnect','settings','reset']) register(name, () => action(name));
  register('setKey', () => action('setKey'));
  register('removeKey', async () => { await context.secrets.delete(keyName(configuration().provider)); status('API key removed.'); });
  context.subscriptions.push(log, capture,
    vscode.window.registerWebviewViewProvider('codingBuddy.panel', panel),
    vscode.workspace.onDidChangeTextDocument(event => { if (linked && event.document.uri.toString() === linked.uri.toString() && event.contentChanges.length) { cancel(); status('Code changed. Save and run it again to check your idea.'); } }),
    vscode.workspace.onDidChangeConfiguration(event => { if (event.affectsConfiguration('codingBuddy')) { cancel(); session.clearCache(); status('Settings updated. Your next analysis uses the selected provider and model.'); } }),
    context.secrets.onDidChange(() => { void refresh(); }),
    { dispose: cancel });
  void refresh();
}
