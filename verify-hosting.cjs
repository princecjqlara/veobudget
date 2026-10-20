const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');

const server = spawn(process.execPath, [path.join(__dirname, 'preview.cjs'), '--port', '0'], {
  cwd: __dirname, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
});
let errors = '';
server.stderr.on('data', chunk => {errors += chunk.toString();});
const ready = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('Preview startup timed out. ' + errors)), 10000);
  let output = '';
  server.stdout.on('data', chunk => {
    output += chunk.toString();
    const match = output.match(/Local: (http:\/\/127\.0\.0\.1:\d+\/)/);
    if (match) {clearTimeout(timer);resolve(match[1]);}
  });
  server.on('error', error => {clearTimeout(timer);reject(error);});
  server.on('exit', code => {clearTimeout(timer);reject(new Error('Preview exited: ' + code + '. ' + errors));});
});

(async () => {
  const origin = await ready;
  const source = fs.readFileSync(path.join(__dirname, 'ad-budget-calculator.html'), 'utf8');
  const response = await fetch(origin);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /text\/html; charset=utf-8/);
  assert.equal(await response.text(), source, 'Deployed root must contain the latest calculator');
  for (const route of ['index.html', 'ad-budget-calculator.html']) {
    const page = await fetch(origin + route);
    assert.equal(page.status, 200);
    assert.equal(await page.text(), source);
  }
  const conservativeSource = fs.readFileSync(path.join(__dirname, 'ad-budget-conservative.html'), 'utf8');
  const conservative = await fetch(origin + 'ad-budget-conservative.html');
  assert.equal(conservative.status, 200);
  assert.equal(await conservative.text(), conservativeSource, 'Page 2 must contain the conservative calculator');
  assert.match(conservativeSource, /data-planner-profile="conservative"/);
  assert.match(source, /data-planner-profile="aggressive"/);
  const sunoSource = fs.readFileSync(path.join(__dirname, 'ad-budget-suno.html'), 'utf8');
  const suno = await fetch(origin + 'ad-budget-suno.html');
  assert.equal(suno.status, 200);
  assert.equal(await suno.text(), sunoSource, 'Page 3 must contain the Suno calculator');
  assert.match(sunoSource, /data-planner-profile="aggressive"/);
  assert.match(sunoSource, /data-planner-id="suno"/);
  assert.match(sunoSource, /<h1>Suno ad budget\.<\/h1>/);
  for (const html of [source, conservativeSource, sunoSource]) {
    assert.match(html, /href="ad-budget-calculator.html"/);
    assert.match(html, /href="ad-budget-conservative.html"/);
    assert.match(html, /href="ad-budget-suno.html"/);
    assert.equal((html.match(/aria-current="page"/g) || []).length, 1);
    assert.doesNotMatch(html, /id="planDate"/);
    for (const id of ['current-ph-date', 'result-max-budget', 'result-days-to-max', 'result-max-date', 'result-next-profit-budget', 'result-capacity-ceiling']) {
      assert.equal((html.match(new RegExp('id="' + id + '"', 'g')) || []).length, 1, 'Every page must show one profit growth-stop estimate: ' + id);
    }
    for (const asset of [...html.matchAll(/(?:src|href)="(budget-[^"]+)"/g)].map(match => match[1])) {
      const response = await fetch(origin + asset);
      assert.equal(response.status, 200, 'Shared asset must be served: ' + asset);
      assert.match(response.headers.get('content-type'), asset.endsWith('.css') ? /text\/css/ : /text\/javascript/);
      assert.equal(await response.text(), fs.readFileSync(path.join(__dirname, asset), 'utf8'));
    }
  }
  for (const route of ['.qa/desktop.png', 'verify-model.cjs', '.git/config', 'README.md']) {
    assert.equal((await fetch(origin + route)).status, 404, 'Only exported pages should be served');
  }
  assert.equal((await fetch(origin, {method: 'HEAD'})).status, 200);
  assert.equal((await fetch(origin + 'ad-budget-conservative.html', {method: 'HEAD'})).status, 200);
  assert.equal((await fetch(origin + 'ad-budget-suno.html', {method: 'HEAD'})).status, 200);
  assert.equal((await fetch(origin, {method: 'POST'})).status, 405);
  console.log('Static hosting checks passed: all three pages, navigation, shared assets, current build, and output isolation.');
  if (process.argv.includes('--browser')) {
    await new Promise((resolve, reject) => {
      const check = spawn(process.execPath, [path.join(__dirname, 'verify-browser.cjs')], {
        cwd: __dirname, env: {...process.env, CALCULATOR_URL: origin}, stdio: 'inherit', windowsHide: true
      });
      check.on('error', reject);
      check.on('exit', code => code === 0 ? resolve() : reject(new Error('Browser check exited with code ' + code)));
    });
  }
})().catch(error => {console.error(error);process.exitCode = 1;}).finally(() => {
  server.kill();server.unref();process.exit(process.exitCode || 0);
});
