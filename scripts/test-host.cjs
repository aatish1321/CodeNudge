const { mkdtempSync, existsSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const temporary = mkdtempSync(join(tmpdir(), 'coding-buddy-host-'));
const report = join(temporary, 'report.json');
const result = spawnSync('code', ['--new-window', '--wait', `--user-data-dir=${join(temporary, 'user')}`,
  `--extensions-dir=${join(temporary, 'extensions')}`, `--extensionDevelopmentPath=${root}`,
  `--extensionTestsPath=${join(root, 'out/test/host.js')}`, '--disable-workspace-trust', '--skip-welcome',
  '--skip-release-notes', '--disable-gpu', join(root, 'examples')],
  { stdio: 'inherit', timeout: 90_000, env: { ...process.env, CODING_BUDDY_TEST_REPORT: report } });
if (result.error || result.status !== 0 || !existsSync(report)) {
  console.error(`VS Code host verification did not pass. Test artifacts: ${temporary}`);
  if (result.error) console.error(result.error.message);
  process.exitCode = 1;
} else {
  const evidence = JSON.parse(readFileSync(report, 'utf8'));
  if (!evidence.passed) process.exitCode = 1;
  console.log(`VS Code host checks passed: ${evidence.checks.join(', ')}`);
}
