const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, 'budget-model.js'), 'utf8');
let checks = 0;
for (const [profile, plannerId] of [['aggressive', 'aggressive'], ['conservative', 'conservative'], ['aggressive', 'suno']]) {
  const context = {document: {documentElement: {dataset: {plannerProfile: profile, plannerId}}}};
  vm.runInNewContext(source, context);
  const model = context.BudgetModel;
  const calendar = model.calendar;
  assert.equal(calendar.timeZone, 'Asia/Manila');checks++;
  for (const [instant, today, tomorrow] of [
    ['2026-10-20T15:59:59Z', '2026-10-20', '2026-10-21'],
    ['2026-10-20T16:00:00Z', '2026-10-21', '2026-10-22'],
    ['2026-12-31T15:59:59Z', '2026-12-31', '2027-01-01'],
    ['2026-12-31T16:00:00Z', '2027-01-01', '2027-01-02'],
    ['2028-02-28T16:00:00Z', '2028-02-29', '2028-03-01'],
    ['2026-02-28T15:59:59Z', '2026-02-28', '2026-03-01']
  ]) {
    const dates = calendar.getDates(new Date(instant));
    assert.equal(dates.today, today);checks++;
    assert.equal(dates.tomorrow, tomorrow);checks++;
  }
  for (const [date, days, expected] of [
    ['2026-10-20', 0, '2026-10-20'], ['2026-10-20', 2, '2026-10-22'],
    ['2026-10-20', -1, '2026-10-19'], ['2026-12-31', 2, '2027-01-02'],
    ['2028-02-28', 1, '2028-02-29'], ['2026-02-28', 1, '2026-03-01'],
    ['2026-04-30', 2, '2026-05-02']
  ]) {assert.equal(calendar.addDays(date, days), expected);checks++;}
  for (const invalid of ['2026-02-30', '2026-02-29', '2026-04-31', '2026-13-01', '', 'not a date']) {
    assert.equal(calendar.addDays(invalid, 0), null);checks++;
    assert.equal(calendar.format(invalid), '');checks++;
  }
  assert.equal(calendar.addDays('2026-10-20', 1.5), null);checks++;
  assert.equal(calendar.addDays('2026-10-20', 1e9), null);checks++;
  assert.equal(calendar.addDays('9999-12-31', 1), null);checks++;
  assert.match(calendar.format('2026-10-20', true), /Tuesday/);checks++;
  assert.match(calendar.format('2026-10-20'), /2026/);checks++;
  assert.equal(Object.hasOwn(model.defaults, 'planDate'), false);checks++;
  assert.equal(model.textFields.includes('planDate'), false);checks++;
  for (const saved of [
    {...model.defaults, currentBudget: 3100, planDate: '2026-02-30'},
    {currentBudget: 3100, activePeople: 5, planDate: '2000-01-01'}
  ]) {
    const migrated = model.migrateInputs(saved);
    assert.equal(migrated.currentBudget, 3100);checks++;
    assert.equal(Object.hasOwn(migrated, 'planDate'), false);checks++;
    assert.equal(model.calculate(migrated).errors.length, 0);checks++;
  }
  const today = calendar.getDates(new Date('2026-10-20T12:00:00Z')).today;
  const projection = model.estimateProfitPlateau(model.defaults);
  assert.equal(calendar.addDays(today, projection.daysToPlateau), profile === 'conservative' ? '2026-10-20' : '2026-10-22');checks++;
}
console.log('Philippine calendar checks passed: ' + checks + ' assertions across midnight, leap days, year boundaries, forecasts, and old saved inputs.');
