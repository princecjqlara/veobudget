const fs = require('node:fs');
const path = require('node:path');

const source = path.join(__dirname, 'ad-budget-calculator.html');
const output = path.join(__dirname, 'dist');
fs.mkdirSync(output, {recursive: true});
for (const name of ['index.html', 'ad-budget-calculator.html']) {
  fs.copyFileSync(source, path.join(output, name));
}
console.log('Built dist/index.html and the original calculator URL. No dependencies or database required.');
