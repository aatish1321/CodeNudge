import * as vscode from 'vscode';
import { projectReply } from './providers';
import { configuration, checkKnownKeys, keyName } from './settings';
import { newProject, ProjectData, ProjectView, restoreProject, validateCoach, validatePlan } from './project';
import { checkSource, RunSnapshot } from './teaching';
import type { ProjectSnapshot, WorkspaceContext } from './workspace';

export class ProjectMode implements vscode.Disposable {
  private data: ProjectData = newProject();
  private working = false;
  private error = '';
  private ready = false;
  private pending?: AbortController;
  private generation = 0;
  private snapshot?: ProjectSnapshot;
  private run?: RunSnapshot;
  private lastRequest?: { operation: 'plan' | 'hint' | 'review'; text: string };
  private initialized: Promise<void>;
  private saveFailed = false;

  constructor(private context: vscode.ExtensionContext, private workspace: WorkspaceContext, private changed: (celebrate?: boolean) => void) {
    this.initialized = (async () => {
      const saved = restoreProject(context.workspaceState.get('codingBuddy.project'));
      try { await checkKnownKeys(context, JSON.stringify(saved)); this.data = saved; }
      catch { this.error = 'Saved project context contains a provider key and was not loaded. Start a new idea.'; }
      this.changed();
    })();
  }

  get view(): ProjectView {
    const status = this.working ? (this.lastRequest?.operation === 'plan' ? 'Sketching a small plan together…' : 'Thinking about your next discovery…')
      : this.data.phase === 'idea' ? 'Big idea? Tiny first steps.' : this.data.phase === 'choice' ? 'Your features, or a little inspiration?'
      : this.data.phase === 'features' ? 'Tell me what matters most.' : this.data.phase === 'plan' ? 'Look over the plan. You decide when to start.'
      : this.data.phase === 'done' ? 'You marked every step done. Look what you built!' : 'One small step. Your code. Your discovery.';
    return { ...this.data, working: this.working, error: this.error, status, ready: this.ready };
  }

  observe(run: RunSnapshot): void {
    if (this.snapshot) this.cancel('A new run arrived. Check your attempt again when you are ready.');
    this.run = run.sourceConfirmed !== false ? run : undefined;
  }

  sourceChanged(uri: string): void {
    this.run = undefined;
    if (this.snapshot?.sources.some(source => vscode.Uri.file(source.path).toString() === uri)) this.cancel('Code changed while Buddy was thinking. Save it, then ask again.');
  }

  cancel(reason = 'Request stopped. You can retry when ready.'): void {
    this.generation++; this.pending?.abort(); this.pending = undefined; this.snapshot = undefined;
    if (this.working) { this.working = false; this.error = reason; this.changed(); }
  }

  private message(role: 'buddy' | 'learner', text: string): void {
    this.data.messages = [...this.data.messages.slice(-7), { role, text }];
  }

  private async save(): Promise<void> {
    await checkKnownKeys(this.context, JSON.stringify(this.data));
    try { await this.context.workspaceState.update('codingBuddy.project', JSON.parse(JSON.stringify(this.data))); this.saveFailed = false; }
    catch { this.saveFailed = true; throw new Error('Could not save project progress. Your source files are unchanged; try again.'); }
  }

  async handle(action: string, input?: string): Promise<void> {
    await this.initialized;
    if (!vscode.workspace.isTrusted) { this.error = 'Trust this folder before planning or sharing code with Buddy.'; this.changed(); return; }
    if (!vscode.workspace.workspaceFolders?.length) { this.error = 'Open a folder in VS Code first so your project progress can stay with it.'; this.changed(); return; }
    if (this.working) return;
    try {
      this.error = '';
      const text = input?.trim();
      if (text && text.length > 2_000) throw new Error('Keep each message under 2,000 characters.');
      if (text) await checkKnownKeys(this.context, text);
      if (action === 'clarify' && text) {
        if (this.data.phase === 'idea') {
          this.data.idea = text; this.data.phase = 'choice'; this.message('learner', text);
          this.message('buddy', 'Do you already have features in mind, or shall I suggest a small plan?');
        } else if (['choice', 'features', 'plan'].includes(this.data.phase)) {
          const features = `${this.data.features}\n${text}`.trim(); this.message('learner', text);
          if (features.length > 4_000) throw new Error('Keep your feature notes under 4,000 characters. Shorten or combine them before refining further.');
          this.data.features = features;
          await this.ask('plan', text); return;
        } else if (this.data.phase === 'building') { this.message('learner', text); await this.ask('hint', text); return; }
      } else if (action === 'projectFeatures' && this.data.phase === 'choice') {
        this.data.phase = 'features'; this.message('buddy', 'Which features matter most? Mention any language or tools you want to practise, too.');
      } else if (action === 'projectSuggest' && ['choice', 'features', 'plan'].includes(this.data.phase)) {
        await this.ask('plan', 'Suggest a small, achievable first version.'); return;
      } else if (action === 'projectStart' && this.data.phase === 'plan' && this.data.plan) {
        this.data.phase = 'building'; this.data.current = 0; this.ready = false; this.lastRequest = undefined;
        this.message('buddy', 'Let’s start with one small step. Try your own approach, then tell me what happened.');
      } else if ((action === 'projectHint' || action === 'projectReview') && this.data.phase === 'building') {
        if (text) this.message('learner', text);
        await this.ask(action === 'projectHint' ? 'hint' : 'review', text ?? (action === 'projectHint' ? 'Give me one conceptual nudge.' : 'Review my attempt against this task’s check.')); return;
      } else if (action === 'projectDone' && this.data.phase === 'building' && this.data.plan) {
        this.data.current++; this.ready = false; this.lastRequest = undefined;
        const finished = this.data.current === this.data.plan.tasks.length;
        if (finished) this.data.phase = 'done';
        this.message('buddy', finished ? 'You marked every task done! Try the whole project once more and enjoy what you built.' : 'Marked done by you. Here’s your next small step.');
        await this.save(); this.changed(finished); return;
      } else if (action === 'projectRetry' && this.saveFailed) {
        await this.save(); this.changed(); return;
      } else if (action === 'projectRetry' && this.lastRequest) {
        await this.ask(this.lastRequest.operation, this.lastRequest.text); return;
      } else if (action === 'projectReset') {
        const answer = await vscode.window.showWarningMessage('Start a new project plan? This replaces Buddy’s saved plan and progress. Your code files stay as they are.', { modal: true }, 'Start new plan');
        if (answer !== 'Start new plan') return;
        this.data = newProject(); this.ready = false; this.run = undefined; this.lastRequest = undefined;
      } else return;
      await this.save();
    } catch (error) { this.error = (error as Error).message; }
    this.changed();
  }

  private async ask(operation: 'plan' | 'hint' | 'review', text: string): Promise<void> {
    this.lastRequest = { operation, text }; this.working = true; this.ready = false; this.error = '';
    const mine = ++this.generation;
    const pending = this.pending = new AbortController(); this.changed();
    try {
      await this.save();
      const config = configuration();
      const key = await this.context.secrets.get(keyName(config.provider));
      if (!key) throw new Error('Add your provider API key in the gear menu, then Retry.');
      let code: object = { note: 'No source supplied. Ask the learner what they tried or how they tested it.' };
      let hasEvidence = false;
      if (operation !== 'plan') {
        const document = vscode.window.activeTextEditor?.document;
        if (document?.uri.scheme === 'file') {
          if (!await this.workspace.allowed(document.fileName)) throw new Error('Open a saved source file inside this folder. Hidden, credential and generated files are not shared.');
          checkSource(document.getText(), document.fileName);
          if (document.isDirty) throw new Error('Save your code before asking Buddy to read your attempt.');
          const run = this.run?.uri === document.uri.toString() && this.run.version === document.version && this.run.source === document.getText() ? this.run : undefined;
          const snapshot = await this.workspace.collect(document, run?.startedAt, run?.output ?? '');
          if (mine !== this.generation) return;
          this.snapshot = snapshot;
          code = { currentFile: vscode.workspace.asRelativePath(document.uri, false), language: document.languageId, source: document.getText(), workspace: snapshot.data,
            run: run ? { output: run.output, exitCode: run.exitCode, truncated: run.truncated, reported: run.reported } : null };
          hasEvidence = !!run && run.exitCode === 0 && !run.truncated && !!run.output.trim();
        }
      }
      const input = { operation, idea: this.data.idea, features: this.data.features, plan: this.data.plan,
        currentTask: this.data.plan?.tasks[this.data.current] ?? null, question: text, conversation: this.data.messages.slice(-6),
        ...(operation !== 'plan' ? { code } : {}) };
      await checkKnownKeys(this.context, JSON.stringify(input));
      if (mine !== this.generation || !vscode.workspace.isTrusted) return;
      const reply = await projectReply(config.provider, config.model, key, input, pending.signal);
      await checkKnownKeys(this.context, JSON.stringify(reply));
      if (mine !== this.generation) return;
      if (this.snapshot && !await this.workspace.current(this.snapshot)) throw new Error('Project code changed while Buddy was thinking. Save it, then ask again.');
      if (mine !== this.generation || !vscode.workspace.isTrusted) return;
      if (operation === 'plan') {
        const result = validatePlan(reply);
        if (result.kind === 'plan') { this.data.plan = result.plan; this.data.phase = 'plan'; this.data.current = 0; }
        else this.data.phase = 'features';
        this.message('buddy', result.message);
      } else {
        const result = validateCoach(reply, operation, hasEvidence);
        this.ready = result.ready; this.message('buddy', result.message);
      }
      await this.save();
    } catch (error) {
      if (mine === this.generation) this.error = pending.signal.aborted ? 'Request stopped. You can retry when ready.' : (error as Error).message;
    } finally {
      if (mine === this.generation) { this.working = false; this.pending = undefined; this.snapshot = undefined; this.changed(); }
    }
  }

  dispose(): void { this.cancel(); }
}
