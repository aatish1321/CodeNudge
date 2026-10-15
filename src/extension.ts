import * as vscode from 'vscode';
import { resolve } from 'node:path';
import { WorkspaceContext, ProjectSnapshot, sourcePath } from './workspace';
import { analyze } from './providers';
import { BuddyPanel, PanelState } from './panel';
import { LearningSession } from './session';
import { checkKnownKeys, chooseProvider, configuration, keyName, setKey } from './settings';
import { checkSource, GuidanceValidationError, RunSnapshot, TeachingReply, validateReply } from './teaching';
import { TerminalCapture } from './terminal';
import { EditorGuidance } from './editor';
import { openPlayground } from './playground';

export function activate(context: vscode.ExtensionContext): void {
  let session = new LearningSession();
  let linked: vscode.TextDocument | undefined;
  let latestRun: RunSnapshot | undefined;
  let pending: AbortController | undefined;
  let requestGeneration = 0;
  let requestCount = 0;
  let refreshGeneration = 0;
  const workspace = new WorkspaceContext();
  let activeSnapshot: ProjectSnapshot | undefined;
  let activeHint: { run: RunSnapshot; reply: Pick<TeachingReply, 'line' | 'inlineHint'> } | undefined;
  let suppressEditorSwitch = false;
  const memories = new Map<string, { session: LearningSession; run?: RunSnapshot; messages: PanelState['messages']; status: string; snapshot?: ProjectSnapshot; hint?: typeof activeHint }>();
  const state: PanelState = { trusted: vscode.workspace.isTrusted, provider: 'gemini', model: '', keyConfigured: false, file: '', status: 'Run your code. I’m right here if you get stuck.', working: false, retries: 0, messages: [], proposalId: '', confetti: true, celebration: 0 };
  const log = vscode.window.createOutputChannel('Coding Buddy');

  async function refresh(): Promise<void> {
    const mine = ++refreshGeneration;
    try {
      const config = configuration();
      const configured = !!await context.secrets.get(keyName(config.provider));
      if (mine !== refreshGeneration) return;
      state.provider = config.provider; state.model = config.model;
      state.keyConfigured = configured;
      state.trusted = vscode.workspace.isTrusted;
      if (!state.trusted) state.status = 'Trust this folder to enable code hints. Nothing is sent to AI until you do.';
      state.retries = session.retries;
      state.proposalId = guidance.proposalId;
      state.confetti = vscode.workspace.getConfiguration('codingBuddy').get('confetti', true);
      panel.update(state);
    } catch (error) { state.status = (error as Error).message; panel.update(state); }
  }

  function status(message: string): void { state.status = message; void refresh(); }
  function cancel(): void { requestGeneration++; pending?.abort(); pending = undefined; state.working = false; }
  function message(role: 'buddy' | 'learner', text: string, category?: string): void { state.messages = [...state.messages.slice(-7), { role, text, category }]; }

  function selectFile(document: vscode.TextDocument): void {
    if (linked?.uri.toString() === document.uri.toString()) return;
    if (state.working) session.clearCache();
    if (linked) memories.set(linked.uri.toString(), { session, run: latestRun, messages: state.messages, status: state.working ? 'Your progress is saved. Run again when you come back to this file.' : state.status, snapshot: activeSnapshot, hint: activeHint });
    cancel(); guidance.clear();
    const saved = memories.get(document.uri.toString());
    session = saved?.session ?? new LearningSession(); latestRun = saved?.run; activeSnapshot = saved?.snapshot; activeHint = saved?.hint;
    state.messages = saved?.messages ?? []; state.status = saved?.status ?? 'Watching this file and its project. Run your code when you’re ready.';
    linked = document; state.file = vscode.workspace.asRelativePath(document.uri, false);
    const mine = requestGeneration;
    if (latestRun && (document.isDirty || document.getText() !== latestRun.source)) {
      activeHint = undefined;
      state.messages = []; state.status = 'Your progress is saved. Save and run the changed code for a fresh hint.';
    } else if (saved?.snapshot) void workspace.current(saved.snapshot).then(async current => {
      if (mine !== requestGeneration) return;
      if (!current) { activeHint = undefined; state.messages = []; status('Your project changed. Run it again; your progress is saved.'); }
      else if (activeHint) {
        const hint = activeHint;
        const target = await vscode.workspace.openTextDocument(vscode.Uri.parse(hint.run.uri));
        if (mine !== requestGeneration || target.isDirty || target.getText() !== hint.run.source) return;
        activeHint = { ...hint, run: { ...hint.run, version: target.version } };
        guidance.showHint(activeHint.run, activeHint.reply);
      }
    }).catch(() => { if (mine === requestGeneration) status('That project file is unavailable. Open it and run again.'); });
    void refresh();
  }

  async function runAnalysis(run: RunSnapshot, attempt: boolean): Promise<void> {
    if (!vscode.workspace.isTrusted) { status('Trust this workspace before sharing coding context.'); return; }
    if (run.sourceConfirmed === false) { status('Reply “yes” if that result came from this file before I check it.'); return; }
    let mine = requestGeneration;
    try {
      checkSource(run.source, vscode.Uri.parse(run.uri).fsPath);
      if (!linked || linked.uri.toString() !== run.uri || linked.isClosed || linked.isDirty || linked.version !== run.version || linked.getText() !== run.source) {
        status('Save and run the current code, or share its result, before asking for a new hint.'); return;
      }
      const allowed = await workspace.allowed(linked.fileName);
      if (mine !== requestGeneration) return;
      if (!allowed) { status('Choose a source file inside the opened project. Hidden, credential, dependency, and generated files are excluded.'); return; }
      const snapshot = await workspace.collect(linked, run.startedAt, run.output);
      if (mine !== requestGeneration) return;
      run = { ...run, contextRevision: snapshot.revision, effortRevision: snapshot.effortRevision };
      latestRun = run;
      const config = configuration();
      const fingerprint = session.fingerprint(run, config.provider, config.model, attempt);
      if (session.isDuplicate(fingerprint)) { void refresh(); return; }
      if (state.working) return;
      const key = await context.secrets.get(keyName(config.provider));
      if (!key) { status('Add an API key in ⚙ settings, then run your code again.'); return; }
      await checkKnownKeys(context, JSON.stringify({ ...session.context(run, attempt), workspace: snapshot.data }));
      if (state.working || mine !== requestGeneration) return;
      pending = new AbortController(); mine = ++requestGeneration; state.working = true;
      activeSnapshot = snapshot;
      session.begin(run, fingerprint, attempt);
      const pendingHint = session.sameDiagnostic(run) ? session.lineHint(run) : undefined;
      if (pendingHint) { activeHint = { run, reply: pendingHint }; guidance.showHint(run, pendingHint); }
      status(run.exitCode === 0 ? 'Your code runs now. Checking whether the output matches your goal…' : 'Looking for a useful clue…');
      log.appendLine(`Analysis request ${++requestCount}: provider=${config.provider}; source=${run.reported ? 'learner-reported' : 'terminal'}`);
      const result = await analyze(config.provider, config.model, key, { ...session.context(run, attempt), workspace: { ...snapshot.data, currentFile: vscode.workspace.asRelativePath(linked.uri, false) } }, pending.signal);
      await checkKnownKeys(context, JSON.stringify(result));
      if (mine !== requestGeneration || !linked || linked.isClosed || linked.isDirty || linked.version !== run.version || linked.getText() !== run.source) return;
      const current = await workspace.current(snapshot);
      if (mine !== requestGeneration) return;
      if (!current) { session.clearCache(); status('Project code changed while Buddy was thinking. Save and run again.'); return; }
      let targetRun = run;
      const targetFile = result && typeof result === 'object' ? (result as { targetFile?: unknown }).targetFile : null;
      if ((result as { status?: unknown })?.status === 'issue' && typeof targetFile === 'string' && targetFile !== vscode.workspace.asRelativePath(linked.uri, false)) {
        const selected = snapshot.data.relatedFiles.find(file => file.path === targetFile && !file.truncated);
        const folder = vscode.workspace.getWorkspaceFolder(linked.uri);
        if (!selected || !folder) throw new Error('The AI referred to a file it did not fully read. Open that file and run again.');
        const uri = vscode.Uri.file(resolve(folder.uri.fsPath, targetFile));
        if (!await workspace.allowed(uri.fsPath)) throw new Error('That suggestion is outside the opened project. Your code is unchanged.');
        const target = await vscode.workspace.openTextDocument(uri);
        if (target.isDirty || target.getText() !== selected.source) throw new Error('The suggested file changed. Save and run the project again.');
        targetRun = { ...run, uri: uri.toString(), source: selected.source, version: target.version, language: target.languageId };
      }
      if (mine !== requestGeneration) return;
      const reply = validateReply(result, targetRun, session.allowedLevel(run, attempt), session.sameDiagnostic(run));
      const celebrate = session.apply(run, reply, fingerprint, attempt);
      message('buddy', reply.message, reply.category);
      if (celebrate) { guidance.clear(); activeHint = undefined; state.celebration++; }
      const hint = session.lineHint(run, reply);
      if (hint) {
        suppressEditorSwitch = true;
        try { await vscode.window.showTextDocument(vscode.Uri.parse(targetRun.uri), { preview: true, preserveFocus: true }); }
        finally { suppressEditorSwitch = false; }
        if (mine !== requestGeneration) return;
        activeHint = { run: targetRun, reply: hint };
        guidance.showHint(targetRun, hint);
      }
      if (reply.level === 'fix') {
        await guidance.showProposal(targetRun, reply);
        if (mine !== requestGeneration) return;
        message('buddy', reply.explanation ?? 'Review the proposed change before deciding.');
      }
      state.status = reply.status === 'needs_clarification' ? 'Your turn — tell the buddy what you expected.'
        : reply.status === 'solved' ? 'This result matches the stated goal. Nice work!'
        : run.reported ? 'Learner-shared result checked. Try your next change.' : 'Your turn. Try a change, save, and run again.';
    } catch (error) {
      if (mine === requestGeneration) {
        const cause = error as Error;
        if (cause instanceof GuidanceValidationError) log.appendLine(`Rejected guidance: ${cause.reason}; provider=${configuration().provider}`);
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
    selectFile(document);
    state.file = vscode.workspace.asRelativePath(document.uri, false);
    capture.connect(document, terminal); terminal.show();
    if (!terminal.shellIntegration) status('Connected. If capture is unavailable, enable VS Code shell integration or share the result manually. Run your code next.');
  }

  async function action(name: string, text?: string, proposalId?: string): Promise<void> {
    try {
      if (!vscode.workspace.isTrusted && ['connect', 'retry', 'pasteResult', 'shareResult', 'clarify', 'acceptFix', 'rejectFix'].includes(name)) {
        status('Trust this folder to enable code hints.'); return;
      }
      if (text) await checkKnownKeys(context, text);
      if (name === 'ready') log.appendLine('Sidebar scripts ready.');
      else if (name === 'trust') await vscode.commands.executeCommand('workbench.trust.manage');
      else if (name === 'settings') {
        const config = configuration();
        const automatic = vscode.workspace.getConfiguration('codingBuddy').get('autoWatch', true);
        const choice = await vscode.window.showQuickPick([
          { label: '$(beaker) Open test playground', action: 'playground' },
          { label: '$(sparkle) AI provider', description: config.provider, action: 'provider' },
          { label: '$(key) Add or update API key', action: 'setKey' },
          { label: '$(trash) Remove API key', action: 'removeKey' },
          { label: automatic ? '$(debug-pause) Pause automatic hints' : '$(play) Resume automatic hints', action: 'toggleWatching' },
          { label: state.confetti ? '$(star) Turn celebrations off' : '$(star) Turn celebrations on', action: 'toggleConfetti' },
          { label: '$(refresh) Retry last result', action: 'retry' },
          { label: '$(clear-all) Start a new issue', action: 'reset' },
          { label: '$(clippy) Share a run result', action: 'pasteResult' },
          { label: '$(terminal) Choose a specific file and terminal', description: 'Advanced', action: 'connect' },
          { label: '$(settings-gear) Models and all settings', action: 'openSettings' }
        ], { title: 'Coding Buddy settings', placeHolder: `${config.provider} · ${config.model} · Code and run results are sent to this provider` });
        if (choice) await action(choice.action);
      }
      else if (name === 'playground') await openPlayground(context.extensionUri);
      else if (name === 'openSettings') await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:aatish1321.coding-buddy');
      else if (name === 'removeKey') await vscode.commands.executeCommand('codingBuddy.removeKey');
      else if (name === 'toggleWatching') {
        const config = vscode.workspace.getConfiguration('codingBuddy');
        await config.update('autoWatch', !config.get('autoWatch', true), vscode.ConfigurationTarget.Global);
      }
      else if (name === 'pasteResult') {
        const output = await vscode.window.showInputBox({ title: 'Share a run result', prompt: 'Paste the result from your code, browser, or API test. Keep credentials out.', ignoreFocusOut: true });
        if (output?.trim()) await action('shareResult', output.slice(0, 2_000));
      }
      else if (name === 'provider') await chooseProvider();
      else if (name === 'setKey') { await setKey(context); await refresh(); }
      else if (name === 'connect') await connect();
      else if (name === 'disconnect') { cancel(); guidance.clear(); capture.disconnect(); linked = undefined; latestRun = undefined; session = new LearningSession(); state.file = ''; status('Hints paused. Resume automatic hints in settings.'); }
      else if (name === 'reset') { cancel(); guidance.clear(); activeHint = undefined; session = new LearningSession(); latestRun = undefined; state.messages = []; status('Fresh start. Run your code when you are ready.'); }
      else if (name === 'toggleConfetti') { const config = vscode.workspace.getConfiguration('codingBuddy'); await config.update('confetti', !config.get('confetti', true), vscode.ConfigurationTarget.Global); }
      else if (name === 'acceptFix') {
        if (!latestRun || !linked || linked.isDirty || linked.getText() !== latestRun.source || (activeSnapshot && !await workspace.current(activeSnapshot))) {
          guidance.clear(); throw new Error('Project code changed. Save and run again before reviewing a fresh suggestion.');
        }
        suppressEditorSwitch = true;
        try { await guidance.accept(proposalId ?? guidance.proposalId); } finally { suppressEditorSwitch = false; }
        status('Change accepted. Save your file and run it to check the result.');
      }
      else if (name === 'rejectFix') { guidance.reject(proposalId ?? guidance.proposalId); status('Your code is unchanged. Try your own approach and run again.'); }
      else if (name === 'retry' && latestRun) { session.clearCache(); await runAnalysis(latestRun, true); }
      else if (name === 'shareResult' && text?.trim()) {
        if (state.working) return;
        const document = vscode.window.activeTextEditor?.document ?? linked;
        if (!document || document.uri.scheme !== 'file') { status('Open and save the code file whose result you want to share.'); return; }
        checkSource(document.getText(), document.fileName);
        if (document.isDirty) { status('Save the code file before sharing its run result.'); return; }
        selectFile(document);
        latestRun = { uri: document.uri.toString(), version: document.version, language: document.languageId, source: document.getText(),
          command: 'Learner-shared run result', output: text.trim(), exitCode: null, truncated: false, reported: true };
        message('learner', `Run result I observed:\n${text.trim()}`);
        await runAnalysis(latestRun, true);
      }
      else if (name === 'clarify' && text?.trim()) {
        if (state.working) return;
        session.clarification = `${session.clarification}\n${text.trim()}`.trim().slice(-2_000);
        message('learner', text.trim());
        if (latestRun?.sourceConfirmed === false) {
          if (!/^(?:yes|yep|yeah|correct|it did|that’s right|that's right)\b/i.test(text.trim())) {
            status('Open the file you ran and run it again, or share the right result from settings.'); return;
          }
          latestRun = { ...latestRun, sourceConfirmed: true, reported: true };
        }
        if (latestRun && linked && !linked.isDirty && linked.version === latestRun.version) await runAnalysis(latestRun, false);
        else status('Context saved. Save and run the connected file so the buddy can check the result.');
      }
    } catch (error) { status((error as Error).message); }
  }

  const panel = new BuddyPanel(context.extensionUri, action);
  const guidance = new EditorGuidance(() => { void refresh(); });
  const capture = new TerminalCapture(run => {
    if (!vscode.workspace.isTrusted) { status('Trust this folder to enable code hints.'); return; }
    const document = vscode.workspace.textDocuments.find(document => document.uri.toString() === run.uri);
    if (!document) return;
    selectFile(document);
    const repeatedUncertain = latestRun?.sourceConfirmed === false && latestRun.uri === run.uri && latestRun.source === run.source && latestRun.output === run.output;
    if (!latestRun || latestRun.uri !== run.uri || latestRun.source !== run.source || latestRun.output !== run.output || latestRun.exitCode !== run.exitCode) {
      cancel(); guidance.clear(); activeHint = undefined; state.messages = [];
    }
    linked = document; state.file = vscode.workspace.asRelativePath(document.uri, false); latestRun = run;
    if (run.sourceConfirmed === false) {
      if (!repeatedUncertain) message('buddy', `Was that result from ${state.file}? Your terminal didn’t include a file name, so I want to check before giving you a clue.`);
      status('Reply “yes” if that result came from this file.'); return;
    }
    void runAnalysis(run, true);
  }, (message, clear) => {
    if (clear) { cancel(); guidance.clear(); activeHint = undefined; state.messages = []; latestRun = undefined; }
    status(message);
  }, (command, output, cwd) => workspace.resolveRun(command, output, cwd));
  if (!vscode.workspace.isTrusted || !vscode.workspace.getConfiguration('codingBuddy').get('autoWatch', true)) {
    capture.disconnect(); state.status = 'Automatic hints paused. Resume them in settings.';
  }
  const register = (name: string, handler: () => unknown) => context.subscriptions.push(vscode.commands.registerCommand(`codingBuddy.${name}`, handler));
  for (const name of ['connect','disconnect','settings','reset','retry','acceptFix','rejectFix','toggleConfetti']) register(name, () => action(name));
  register('openPlayground', () => action('playground'));
  register('setKey', () => action('setKey'));
  register('chooseProvider', () => action('provider'));
  register('removeKey', async () => { cancel(); guidance.clear(); session.clearCache(); await context.secrets.delete(keyName(configuration().provider)); status('API key removed.'); });
  context.subscriptions.push(log, capture, guidance,
    vscode.window.registerWebviewViewProvider('codingBuddy.panel', panel),
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (vscode.workspace.isTrusted && !suppressEditorSwitch && editor?.document.uri.scheme === 'file' && sourcePath(vscode.workspace.asRelativePath(editor.document.uri, false)) && vscode.workspace.getWorkspaceFolder(editor.document.uri)) selectFile(editor.document);
    }),
    vscode.workspace.onDidChangeTextDocument(event => { if (event.contentChanges.length && (linked?.uri.toString() === event.document.uri.toString() || activeSnapshot?.sources.some(source => source.path === event.document.uri.fsPath))) { if (state.working) session.clearCache(); cancel(); guidance.clear(); activeHint = undefined; status('Code changed. Save and run it again to check your idea.'); } }),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (!event.affectsConfiguration('codingBuddy')) return;
      cancel(); guidance.clear(); activeHint = undefined; session.clearCache();
      for (const saved of memories.values()) { saved.session.clearCache(); saved.hint = undefined; }
      if (event.affectsConfiguration('codingBuddy.autoWatch')) {
        if (vscode.workspace.isTrusted && vscode.workspace.getConfiguration('codingBuddy').get('autoWatch', true)) capture.watch();
        else capture.disconnect();
        status(vscode.workspace.getConfiguration('codingBuddy').get('autoWatch', true) ? 'Run your code. I’ll watch for a result automatically.' : 'Automatic hints paused.');
      } else status('Settings updated. Run your code when you’re ready.');
    }),
    context.secrets.onDidChange(() => {
      cancel(); guidance.clear(); activeHint = undefined; session.clearCache();
      for (const saved of memories.values()) { saved.session.clearCache(); saved.hint = undefined; }
      void refresh();
    }),
    vscode.workspace.onDidGrantWorkspaceTrust(() => {
      if (vscode.workspace.getConfiguration('codingBuddy').get('autoWatch', true)) { capture.watch(); status('Run your code. I’ll watch for a result automatically.'); }
      else status('Automatic hints paused. Resume them in settings.');
    }),
    { dispose: cancel });
  void refresh();
}
