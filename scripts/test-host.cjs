const { mkdtempSync, existsSync, readFileSync, readdirSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const temporary = mkdtempSync(join(tmpdir(), 'coding-buddy-host-'));
const report = join(temporary, 'report.json');
let extensionPath = root;
if (process.argv.includes('--package')) {
  const installed = spawnSync('code', [`--user-data-dir=${join(temporary, 'user')}`, `--extensions-dir=${join(temporary, 'extensions')}`,
    '--install-extension', join(root, 'coding-buddy-0.0.1.vsix'), '--force'], { stdio: 'inherit', timeout: 60_000 });
  if (installed.error || installed.status !== 0) { console.error('Package installation failed.'); process.exit(1); }
  const folder = readdirSync(join(temporary, 'extensions')).find(name => name.startsWith('aatish1321.coding-buddy-'));
  if (!folder) { console.error('Installed extension was not found.'); process.exit(1); }
  extensionPath = join(temporary, 'extensions', folder);
}
const result = spawnSync('code', ['--new-window', '--wait', `--user-data-dir=${join(temporary, 'user')}`,
  `--extensions-dir=${join(temporary, 'extensions')}`, `--extensionDevelopmentPath=${extensionPath}`,
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
