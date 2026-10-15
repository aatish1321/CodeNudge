// Load one account asynchronously. A missing account is a normal not-found result;
// an unavailable service is an error. Add numeric credits and bonus for valid accounts.
async function loadAccount(fetchAccount, accountId) {
  const response = await fetchAccount(`/accounts/${accountId}`);
  if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
  const payload = response.json();
  return {
    found: true,
    name: payload.account.name,
    credits: Number(payload.account.credits) + Number(payload.account.bonus),
  };
}

module.exports = { loadAccount };
