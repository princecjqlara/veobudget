const fs = require('node:fs');
const path = require('node:path');

const output = path.join(__dirname, 'dist');
fs.mkdirSync(output, {recursive: true});
for (const name of ['ad-budget-calculator.html', 'ad-budget-conservative.html', 'ad-budget-suno.html', 'budget-model.js', 'budget-planner.js', 'budget-planner.css']) {
  fs.copyFileSync(path.join(__dirname, name), path.join(output, name));
}
fs.copyFileSync(path.join(output, 'ad-budget-calculator.html'), path.join(output, 'index.html'));
console.log('Built all three calculator pages and shared assets in dist/. No dependencies or database required.');
