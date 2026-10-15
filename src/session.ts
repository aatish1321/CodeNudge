import { diagnostic, hash, Level, RunSnapshot, TeachingReply } from './teaching';

export class LearningSession {
  retries = 0;
  issue = '';
  clarification = '';
  expectedOutcome = '';
  previousHint = '';
  private lastRequest = '';
  private lastSource = '';
  private lastDiagnostic = '';

  private level(retries: number): Level { return retries >= 6 ? 'fix' : retries >= 3 ? 'inline' : 'clue'; }

  allowedLevel(run: RunSnapshot, attempt: boolean): Level {
    if (run.sourceConfirmed === false) return 'clue';
    const changedRetry = !!this.issue && attempt && run.source !== this.lastSource;
    return this.level(this.retries + (changedRetry ? 1 : 0));
  }

  context(run: RunSnapshot, attempt: boolean): object {
    return { ...run, uri: undefined, version: undefined, allowedLevel: this.allowedLevel(run, attempt),
      previousIssue: this.issue, previousHint: this.previousHint, sameDiagnostic: this.sameDiagnostic(run),
      expectedOutcome: this.expectedOutcome, clarification: this.clarification };
  }

  fingerprint(run: RunSnapshot, provider: string, model: string, _attempt: boolean): string {
    return hash(JSON.stringify([run.uri, run.source, run.command, run.output, run.exitCode, run.truncated,
      run.sourceConfirmed, this.clarification, provider, model]));
  }

  isDuplicate(fingerprint: string): boolean { return this.lastRequest === fingerprint; }
  sameDiagnostic(run: RunSnapshot): boolean { return !!this.issue && !!this.lastDiagnostic && diagnostic(run).key === this.lastDiagnostic; }

  lineHint(run: RunSnapshot, reply?: TeachingReply): Pick<TeachingReply, 'line' | 'inlineHint'> | undefined {
    const line = reply?.line ?? diagnostic(run).line;
    if (this.retries < 3 || (reply && reply.status !== 'issue') || line === null) return;
    return { line, inlineHint: reply?.inlineHint ?? 'Compare this line with the clue. Which part needs another look?' };
  }

  begin(run: RunSnapshot, fingerprint: string, attempt: boolean): void {
    this.lastRequest = fingerprint;
    if (this.issue && attempt && run.sourceConfirmed !== false && run.source !== this.lastSource &&
      this.sameDiagnostic(run)) {
      this.retries = Math.min(6, this.retries + 1);
      this.lastSource = run.source;
    }
  }

  apply(run: RunSnapshot, reply: TeachingReply, fingerprint: string, attempt: boolean): boolean {
    let celebrate = false;
    if (reply.status === 'solved') {
      if (run.sourceConfirmed === false || run.truncated || !run.output.trim() || (!run.reported && run.exitCode !== 0) ||
        !reply.expectedOutcome?.trim() || !['comment', 'clarified'].includes(reply.intentSource) ||
        (reply.intentSource === 'clarified' && !this.clarification.trim()) ||
        ['new', 'unknown'].includes(reply.relationship)) {
        throw new Error('I cannot confirm the result yet. Explain what you expected, then share or run the result again.');
      }
      celebrate = !!this.issue;
      this.issue = ''; this.retries = 0; this.lastSource = run.source; this.lastDiagnostic = '';
    }
    if (reply.status === 'issue') {
      const key = diagnostic(run).key;
      const sameDiagnostic = !!this.issue && !!key && key === this.lastDiagnostic;
      if (!sameDiagnostic && reply.relationship === 'unknown' && reply.level !== this.level(this.retries)) {
        throw new Error('I need to understand whether this is the same issue before giving more specific help. Clarify what happened.');
      }
      const newIssue = !this.issue || (reply.relationship === 'new' && !sameDiagnostic);
      if (newIssue) this.retries = 0;
      else if ((reply.relationship === 'same' || sameDiagnostic) && attempt && run.sourceConfirmed !== false && run.source !== this.lastSource) this.retries = Math.min(6, this.retries + 1);
      if (newIssue) this.issue = `${reply.category}: ${reply.message}`;
      this.lastSource = run.source;
      this.lastDiagnostic = key;
    }
    this.lastRequest = fingerprint;
    this.previousHint = reply.message;
    if (reply.expectedOutcome) this.expectedOutcome = reply.expectedOutcome;
    return celebrate;
  }

  clearCache(): void { this.lastRequest = ''; }
}
