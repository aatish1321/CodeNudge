import { hash, Level, RunSnapshot, TeachingReply } from './teaching';

export class LearningSession {
  retries = 0;
  issue = '';
  clarification = '';
  expectedOutcome = '';
  previousHint = '';
  private lastRequest = '';
  private lastSource = '';

  private level(retries: number): Level { return retries >= 6 ? 'fix' : retries >= 3 ? 'inline' : 'clue'; }

  allowedLevel(run: RunSnapshot, attempt: boolean): Level {
    const changedRetry = !!this.issue && attempt && run.source !== this.lastSource;
    return this.level(this.retries + (changedRetry ? 1 : 0));
  }

  context(run: RunSnapshot, attempt: boolean): object {
    return { ...run, uri: undefined, version: undefined, allowedLevel: this.allowedLevel(run, attempt),
      previousIssue: this.issue, previousHint: this.previousHint,
      expectedOutcome: this.expectedOutcome, clarification: this.clarification };
  }

  fingerprint(run: RunSnapshot, provider: string, model: string, _attempt: boolean): string {
    return hash(JSON.stringify([run.uri, run.source, run.command, run.output, run.exitCode, run.truncated,
      this.clarification, provider, model]));
  }

  isDuplicate(fingerprint: string): boolean { return this.lastRequest === fingerprint; }

  apply(run: RunSnapshot, reply: TeachingReply, fingerprint: string, attempt: boolean): boolean {
    if (reply.status === 'issue') {
      if (reply.relationship === 'unknown' && reply.level !== this.level(this.retries)) {
        throw new Error('I need to understand whether this is the same issue before giving more specific help. Clarify what happened.');
      }
      if (reply.relationship === 'new' || !this.issue) this.retries = 0;
      else if (reply.relationship === 'same' && attempt && run.source !== this.lastSource) this.retries = Math.min(6, this.retries + 1);
      this.issue = `${reply.category}: ${reply.message}`;
      this.lastSource = run.source;
    }
    this.lastRequest = fingerprint;
    this.previousHint = reply.message;
    if (reply.expectedOutcome) this.expectedOutcome = reply.expectedOutcome;
    return false;
  }

  clearCache(): void { this.lastRequest = ''; }
}
