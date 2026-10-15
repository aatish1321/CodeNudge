import { hash, Level, RunSnapshot, TeachingReply } from './teaching';

export class LearningSession {
  retries = 0;
  issue = '';
  clarification = '';
  expectedOutcome = '';
  previousHint = '';
  private lastRequest = '';

  allowedLevel(_run: RunSnapshot, _attempt: boolean): Level { return 'clue'; }

  context(run: RunSnapshot, attempt: boolean): object {
    return { ...run, uri: undefined, version: undefined, allowedLevel: this.allowedLevel(run, attempt),
      previousIssue: this.issue, previousHint: this.previousHint,
      expectedOutcome: this.expectedOutcome, clarification: this.clarification };
  }

  fingerprint(run: RunSnapshot, provider: string, model: string, attempt: boolean): string {
    return hash(JSON.stringify([run.uri, run.source, run.command, run.output, run.exitCode, run.truncated,
      this.clarification, provider, model, this.allowedLevel(run, attempt)]));
  }

  isDuplicate(fingerprint: string): boolean { return this.lastRequest === fingerprint; }

  apply(run: RunSnapshot, reply: TeachingReply, fingerprint: string, _attempt: boolean): boolean {
    this.lastRequest = fingerprint;
    this.previousHint = reply.message;
    if (reply.expectedOutcome) this.expectedOutcome = reply.expectedOutcome;
    if (reply.status === 'issue') this.issue = `${reply.category}: ${reply.message}`;
    return false;
  }

  clearCache(): void { this.lastRequest = ''; }
}
