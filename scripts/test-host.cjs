const { mkdtempSync, mkdirSync, existsSync, readFileSync, readdirSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const temporary = mkdtempSync(join(tmpdir(), 'coding-buddy-host-'));
const report = join(temporary, 'report.json');
const workspace = join(temporary, 'workspace');
mkdirSync(workspace);
const restricted = process.argv.includes('--restricted');
if (restricted) {
  mkdirSync(join(temporary, 'user/User'), { recursive: true });
  writeFileSync(join(temporary, 'user/User/settings.json'), JSON.stringify({
    'security.workspace.trust.enabled': true, 'security.workspace.trust.startupPrompt': 'never'
  }));
}
let extensionPath = root;
if (process.argv.includes('--package')) {
  const installed = spawnSync('code', [`--user-data-dir=${join(temporary, 'user')}`, `--extensions-dir=${join(temporary, 'extensions')}`,
    '--install-extension', join(root, `coding-buddy-${require('../package.json').version}.vsix`), '--force'], { stdio: 'inherit', timeout: 60_000 });
  if (installed.error || installed.status !== 0) { console.error('Package installation failed.'); process.exit(1); }
  const folder = readdirSync(join(temporary, 'extensions')).find(name => name.startsWith('aatish1321.coding-buddy-'));
  if (!folder) { console.error('Installed extension was not found.'); process.exit(1); }
  extensionPath = join(temporary, 'extensions', folder);
}
const result = spawnSync('code', ['--new-window', '--wait', `--user-data-dir=${join(temporary, 'user')}`,
  `--extensions-dir=${join(temporary, 'extensions')}`, `--extensionDevelopmentPath=${extensionPath}`,
  `--extensionTestsPath=${join(root, restricted ? 'out/test/trust-host.js' : 'out/test/host.js')}`, ...(!restricted ? ['--disable-workspace-trust'] : []), '--skip-welcome',
  '--skip-release-notes', '--disable-gpu', workspace],
  { stdio: 'inherit', timeout: 120_000, env: { ...process.env, CODING_BUDDY_TEST_REPORT: report, CODING_BUDDY_NODE: process.execPath } });
if (result.error || result.status !== 0 || !existsSync(report)) {
  console.error(`VS Code host verification did not pass. Test artifacts: ${temporary}`);
  if (result.error) console.error(result.error.message);
  process.exitCode = 1;
} else {
  const evidence = JSON.parse(readFileSync(report, 'utf8'));
  if (!evidence.passed) process.exitCode = 1;
  console.log(`VS Code host checks passed: ${evidence.checks.join(', ')}`);
}
