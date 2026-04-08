const { chromium } = require('playwright');

function parseLog(entry) {
  const granularity =
    entry.match(/resolvedEvolutionGranularity:\s*'([^']+)'/)?.[1] ||
    entry.match(/resolvedEvolutionGranularity:\s*"([^"]+)"/)?.[1] ||
    'unknown';
  const len = Number(entry.match(/chartDataLength:\s*(\d+)/)?.[1] ?? -1);
  const branch =
    entry.match(/renderBranch:\s*'([^']+)'/)?.[1] ||
    entry.match(/renderBranch:\s*"([^"]+)"/)?.[1] ||
    'unknown';
  return { granularity, len, branch };
}

async function run() {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
  const context = browser.contexts()[0] || (await browser.newContext());
  const page = context.pages()[0] || (await context.newPage());
  const logs = [];

  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('[EvolutionChart]')) logs.push(text);
  });

  await page.goto('http://localhost:3001/dashboard/applications', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  if (page.url().includes('/auth/login')) {
    throw new Error(`NOT_AUTHENTICATED: sessão atual não está logada (${page.url()})`);
  }

  await page.getByText('Evolução temporal de aplicações').waitFor({ timeout: 15000 });

  async function check(label) {
    const before = logs.length;
    await page.getByLabel('Granularidade da evolução temporal').click();
    await page.getByRole('option', { name: label, exact: true }).click();
    await page.waitForTimeout(2500);

    const raw = [...logs.slice(before)].reverse().find((l) => l.includes('[EvolutionChart]')) || '';
    const parsed = parseLog(raw);
    const chartVisible = await page.locator('svg.recharts-surface').first().isVisible().catch(() => false);
    const emptyVisible = await page
      .getByText('Sem dados de evolução para exibir.')
      .isVisible()
      .catch(() => false);

    return {
      mode: label,
      resolvedEvolutionGranularity: parsed.granularity,
      chartDataLength: parsed.len,
      renderBranch: parsed.branch,
      chartVisible,
      emptyVisible,
      rawLog: raw,
    };
  }

  const mes = await check('Mês');
  const ano = await check('Ano');
  const auto = await check('Auto');

  console.log('[EVOLUTION_RUNTIME_RESULTS]', JSON.stringify({ mes, ano, auto }, null, 2));
  await browser.close();
}

run().catch((err) => {
  console.error('[EVOLUTION_RUNTIME_ERROR]', err?.message || String(err));
  process.exit(1);
});

