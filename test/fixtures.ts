import { RunSnapshot, TeachingReply } from '../src/teaching';

export const run: RunSnapshot = {
  uri: 'file:///example.py', version: 1, language: 'python',
  source: '# Print 1 through 5\nfor n in range(1, 6)\n    print(n)\n',
  command: 'python3 example.py', output: 'SyntaxError: expected colon', exitCode: 1, truncated: false, reported: false
};

export const clue: TeachingReply = {
  targetFile: null,
  status: 'issue', relationship: 'new', category: 'syntax', intentSource: 'comment',
  expectedOutcome: 'Print 1 through 5', level: 'clue', message: 'This looks like a syntax issue. What marks the start of a loop body?',
  line: null, inlineHint: null, replacement: null, explanation: null
};
