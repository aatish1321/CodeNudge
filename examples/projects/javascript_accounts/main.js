// Simulate an API client: valid -> Ada has 15 credits; missing -> account 99 not found;
// unavailable -> HTTP 503 error. Use the asynchronous local response, without network access.
const { loadAccount } = require('./service');

const scenario = process.argv[2] || 'valid';
if (!['valid', 'missing', 'unavailable'].includes(scenario)) {
  console.error('Choose valid, missing, or unavailable.');
  process.exitCode = 1;
} else {
  const accountId = scenario === 'missing' ? 99 : 7;
  const status = scenario === 'missing' ? 404 : scenario === 'unavailable' ? 503 : 200;
  const body = status === 200
    ? { account: { name: 'Ada', credits: '12', bonus: 3 } }
    : { error: status === 404 ? 'Account not found' : 'Service unavailable' };

  async function localFetch() {
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() { return body; },
    };
  }

  async function main() {
    const account = await loadAccount(localFetch, accountId);
    console.log(account.found
      ? `${account.name} has ${account.credits} credits.`
      : `Account ${accountId} was not found.`);
  }

  main().catch(error => {
    console.error(`Request failed: ${error.message}`);
    process.exitCode = 1;
  });
}
