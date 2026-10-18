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
  for (const route of ['.qa/desktop.png', 'verify-model.cjs', '.git/config', 'README.md']) {
    assert.equal((await fetch(origin + route)).status, 404, 'Only exported pages should be served');
  }
  assert.equal((await fetch(origin, {method: 'HEAD'})).status, 200);
  console.log('Static hosting checks passed: root, original URL, current build, and output isolation.');
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
