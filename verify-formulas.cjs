const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Fraction {
  constructor(numerator, denominator = 1n) {
    assert.notEqual(denominator, 0n);
    if (denominator < 0n) {numerator = -numerator;denominator = -denominator;}
    let divisor = numerator < 0n ? -numerator : numerator;
    let remainder = denominator;
    while (remainder) [divisor, remainder] = [remainder, divisor % remainder];
    this.numerator = numerator / divisor;
    this.denominator = denominator / divisor;
  }
  static from(value) {
    if (value instanceof Fraction) return value;
    const [coefficient, exponent = '0'] = String(value).split('e');
    const [integer, decimals = ''] = coefficient.split('.');
    const scale = decimals.length - Number(exponent);
    return scale >= 0
      ? new Fraction(BigInt(integer + decimals), 10n ** BigInt(scale))
      : new Fraction(BigInt(integer + decimals) * 10n ** BigInt(-scale));
  }
  plus(value) {const other = Fraction.from(value);return new Fraction(this.numerator * other.denominator + other.numerator * this.denominator, this.denominator * other.denominator);}
  minus(value) {const other = Fraction.from(value);return new Fraction(this.numerator * other.denominator - other.numerator * this.denominator, this.denominator * other.denominator);}
  times(value) {const other = Fraction.from(value);return new Fraction(this.numerator * other.numerator, this.denominator * other.denominator);}
  dividedBy(value) {const other = Fraction.from(value);return new Fraction(this.numerator * other.denominator, this.denominator * other.numerator);}
  min(value) {const other = Fraction.from(value);return this.numerator * other.denominator <= other.numerator * this.denominator ? this : other;}
  max(value) {const other = Fraction.from(value);return this.numerator * other.denominator >= other.numerator * this.denominator ? this : other;}
  floor() {return this.numerator / this.denominator - (this.numerator < 0n && this.numerator % this.denominator !== 0n ? 1n : 0n);}
  ceil() {return this.numerator / this.denominator + (this.numerator > 0n && this.numerator % this.denominator !== 0n ? 1n : 0n);}
  valueOf() {return Number(this.numerator) / Number(this.denominator);}
}

function referencePlan(inputs) {
  const percent = key => Fraction.from(inputs[key]).dividedBy(100);
  const reference = Fraction.from(inputs.currentBudget || inputs.startingBudget);
  const base = percent('baseStepPct').dividedBy(reference.dividedBy(inputs.taperBudget).plus(1)).max(percent('minStepPct')).min(percent('maxStepPct'));
  const safePerPerson = Fraction.from(inputs.maxPerPerson).times(Fraction.from(1).minus(percent('reservePct')));
  const maximumTeamProjects = safePerPerson.times(inputs.activePeople).floor();
  const maximumDailyBudget = Fraction.from(Fraction.from(maximumTeamProjects).times(inputs.yesterdayCPA).dividedBy(inputs.rounding).floor()).times(inputs.rounding);
  const baseline = safePerPerson.min(inputs.rampPerPerson);
  const holding = inputs.day <= inputs.rampDays && inputs.yesterdayResult !== 'PROFIT';
  const allowed = holding ? baseline : safePerPerson;
  const wholeCapacity = allowed.times(inputs.activePeople).floor();
  const spendingCeiling = Fraction.from(wholeCapacity).times(inputs.yesterdayCPA);
  const currentBudgetCeiling = Fraction.from(spendingCeiling.dividedBy(inputs.rounding).floor()).times(inputs.rounding);
  let candidate;
  if (inputs.yesterdayResult === 'PROFIT') {
    const teamBoost = percent('peopleBoostPct').times(Math.max(0, inputs.activePeople - 1)).min(percent('maxPeopleBoostPct'));
    const dayBoost = percent('dayBoostPct').times(inputs.day - 1).min(percent('maxDayBoostPct'));
    const increase = reference.times(base).times(teamBoost.plus(1)).times(percent('profitLiftPct').plus(1)).times(dayBoost.plus(1));
    const capacityAllowance = spendingCeiling.minus(reference).max(0).times(percent('capacityFillPct'));
    candidate = reference.plus(increase).plus(capacityAllowance);
  } else {
    const afterFirstCut = reference.times(Fraction.from(1).minus(base));
    candidate = inputs.yesterdayResult === 'LOSS' ? afterFirstCut.times(Fraction.from(1).minus(base)) : afterFirstCut;
  }
  const budget = Fraction.from(candidate.min(spendingCeiling).max(0).dividedBy(inputs.rounding).floor()).times(inputs.rounding);
  const quota = budget.dividedBy(inputs.yesterdayCPA).ceil();
  const quotaPerPerson = inputs.activePeople ? Fraction.from(quota).dividedBy(inputs.activePeople) : Fraction.from(0);
  const perPerson = !inputs.activePeople ? Fraction.from(0) : holding ? baseline : quotaPerPerson.times(percent('headroomPct').plus(1)).max(baseline).min(safePerPerson);
  return {budget: Number(budget), candidate: Number(candidate), baseStep: Number(base), budgetLimit: Number(spendingCeiling), wholeProjectCapacity: Number(wholeCapacity), teamQuota: Number(quota), quotaPerPerson: Number(quotaPerPerson), plannedPerPerson: Number(perPerson), capacity: Number(perPerson.times(inputs.activePeople)), changeRate: Number(budget.dividedBy(reference).minus(1)), maximumTeamProjects: Number(maximumTeamProjects), maximumDailyBudget: Number(maximumDailyBudget), currentBudgetCeiling: Number(currentBudgetCeiling)};
}

function buildFormulaEvaluator(formulas) {
  const scripts = formulas.split('BUDGET FORMULA\n')[1].split('\nCapacity is calculated')[0].split('\n').filter(line => /^[A-Za-z]+ = /.test(line)).map(line => {
    const separator = line.indexOf(' = ');
    const expression = line.slice(separator + 3).replace(/<>/g, '!==').replace(/(?<![<>!=])=(?!=)/g, '===').replace(/\^/g, '**');
    return new vm.Script(line.slice(0, separator) + ' = ' + expression);
  });
  const inputsByName = {TodayBudget: 'currentBudget', StartingBudget: 'startingBudget', YesterdayResult: 'yesterdayResult', YesterdayCPA: 'yesterdayCPA', ActivePeople: 'activePeople', MaxPerPerson: 'maxPerPerson', TomorrowDay: 'day', TaperScale: 'taperBudget', StartPerPerson: 'rampPerPerson', RampDays: 'rampDays', RoundUnit: 'rounding'};
  const percentagesByName = {BaseStep: 'baseStepPct', MinStep: 'minStepPct', MaxStep: 'maxStepPct', Reserve: 'reservePct', Headroom: 'headroomPct', BoostPerPerson: 'peopleBoostPct', MaxTeamBoost: 'maxPeopleBoostPct', ExtraProfitStep: 'profitLiftPct', DayBoostRate: 'dayBoostPct', MaxDayBoost: 'maxDayBoostPct', CapacityFill: 'capacityFillPct'};
  return inputs => {
    const context = vm.createContext({
      IF: (condition, yes, no) => condition ? yes : no,
      AND: (...values) => values.every(Boolean), MAX: Math.max, MIN: Math.min,
      ROUND: (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits,
      ROUNDDOWN: (value, digits) => Math.trunc(value * 10 ** digits) / 10 ** digits,
      ROUNDUP: (value, digits) => Math.sign(value) * Math.ceil(Math.abs(value) * 10 ** digits) / 10 ** digits,
      FLOOR: (value, unit) => Math.floor(value / unit) * unit
    });
    for (const [name, key] of Object.entries(inputsByName)) context[name] = inputs[key];
    for (const [name, key] of Object.entries(percentagesByName)) context[name] = inputs[key] / 100;
    for (const script of scripts) script.runInContext(context);
    return {budget: context.TomorrowBudget, candidate: context.GrowthBudget, baseStep: context.BaseStepRate, budgetLimit: context.TeamBudgetLimit, wholeProjectCapacity: context.WholeProjectCapacity, teamQuota: context.TeamSalesQuota, quotaPerPerson: context.AverageQuotaPerPerson, plannedPerPerson: context.PlannedPerPerson, capacity: context.TeamCapacity, changeRate: context.FinalChange, neededPeople: context.PeopleForFullGrowth, maximumTeamProjects: context.MaximumTeamProjects, maximumDailyBudget: context.MaximumDailyBudget, currentBudgetCeiling: context.CurrentBudgetCeiling};
  };
}

const source = fs.readFileSync(path.join(__dirname, 'budget-model.js'), 'utf8');
let checks = 0;
let copiedChecks = 0;
let plans = 0;
let copiedPlans = 0;
let seed = 74021;
const choose = values => {seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;return values[seed % values.length];};
for (const [profile, plannerId] of [['aggressive', 'aggressive'], ['conservative', 'conservative'], ['aggressive', 'suno']]) {
  const context = {document: {documentElement: {dataset: {plannerProfile: profile, plannerId}}}};
  vm.runInNewContext(source, context);
  const model = context.BudgetModel;
  const evaluateFormulas = buildFormulaEvaluator(model.formulas);
  const cases = [
    {}, {currentBudget: 0}, {activePeople: 0}, {yesterdayResult: 'BREAK-EVEN'}, {yesterdayResult: 'LOSS'},
    {yesterdayResult: 'BREAK-EVEN', day: 8}, {yesterdayResult: 'LOSS', day: 8}, {rounding: 0.01},
    {baseStepPct: 0, minStepPct: 0, maxStepPct: 0, capacityFillPct: 0},
    {currentBudget: 10000, yesterdayCPA: 0.01, activePeople: 1, maxPerPerson: 0.5}
  ];
  for (let index = 0; index < 1000; index++) cases.push({
    currentBudget: choose([0, 0.01, 100, 499.99, 2800, 7800.5, 10000]),
    yesterdayCPA: choose([0.01, 125.25, 199.99, 400, 700]),
    activePeople: choose([0, 1, 2, 5, 10, 25]), maxPerPerson: choose([0.5, 1.25, 1.6, 3, 3.5, 5.5]),
    day: choose([1, 7, 8, 21, 101]), yesterdayResult: choose(['PROFIT', 'BREAK-EVEN', 'LOSS']),
    rounding: choose([0.01, 0.05, 0.1, 1, 10, 50]),
    baseStepPct: choose([0, 20, 40, 100, 200]), minStepPct: choose([0, 2.5, 5]), maxStepPct: choose([10, 25, 80, 99]),
    peopleBoostPct: choose([0, 1, 2]), maxPeopleBoostPct: choose([0, 10, 25]), profitLiftPct: choose([0, 10, 20]),
    dayBoostPct: choose([0, 1, 5]), maxDayBoostPct: choose([0, 20, 100]), capacityFillPct: choose([0, 3, 15]),
    reservePct: choose([10, 20, 50]), headroomPct: choose([0, 10, 20]), rampPerPerson: choose([0.5, 0.6, 0.8]), rampDays: choose([0, 3, 7])
  });
  for (const patch of cases) {
    const inputs = {...model.defaults, ...patch};
    const actual = model.calculate(inputs);
    const expected = referencePlan(inputs);
    assert.equal(actual.errors.length, 0);
    for (const [field, value] of Object.entries(expected)) {
      const tolerance = ['teamQuota', 'wholeProjectCapacity', 'maximumTeamProjects'].includes(field) ? 0 : Number.EPSILON * 64 * Math.max(1, Math.abs(value));
      assert.ok(Math.abs(actual[field] - value) <= tolerance, plannerId + ' ' + field + ': expected ' + value + ', received ' + actual[field] + '; inputs ' + JSON.stringify(patch));
      checks++;
    }
    plans++;
  }
  const copiedCases = [...cases,
    {maxPerPerson: 0.7499999995, reservePct: 20, day: 8, baseStepPct: 0, minStepPct: 0, maxStepPct: 0, capacityFillPct: 0},
    {currentBudget: 99.9999999995, day: 8, baseStepPct: 0, minStepPct: 0, maxStepPct: 0, capacityFillPct: 0},
    {currentBudget: 1600, maxPerPerson: 2.499999999875, reservePct: 20, day: 8, baseStepPct: 0, minStepPct: 0, maxStepPct: 0, capacityFillPct: 0}
  ];
  for (const patch of copiedCases) {
    const inputs = {...model.defaults, ...patch};
    const actual = model.calculate(inputs);
    const copied = evaluateFormulas(inputs);
    for (const [field, value] of Object.entries(copied)) {
      const tolerance = ['teamQuota', 'wholeProjectCapacity', 'maximumTeamProjects', 'neededPeople'].includes(field) ? 0 : Number.EPSILON * 64 * Math.max(1, Math.abs(value));
      assert.ok(Math.abs(actual[field] - value) <= tolerance, 'Copyable formulas disagree: ' + plannerId + ' ' + field + ', calculator ' + actual[field] + ', copied ' + value + '; inputs ' + JSON.stringify(patch));
      copiedChecks++;
    }
    copiedPlans++;
  }
}
console.log('Independent exact-fraction formula checks passed: ' + checks + ' assertions across ' + plans.toLocaleString('en-US') + ' plans.');
console.log('Copyable formula checks passed: ' + copiedChecks + ' assertions across ' + copiedPlans.toLocaleString('en-US') + ' plans.');
