# Veo Budget

A static ad budget calculator with three pages: the original aggressive growth planner, a less aggressive conservative planner, and a Suno planner matching Page 1. All include automatic growth, team capacity, and whole-project sales quotas. All calculations run in the browser. No database, backend, API keys, or environment variables are required.

## Default settings

New visitors start with the settings below. All calendar dates use **Asia/Manila (Philippine time, UTC+8)**, regardless of the browser timezone. Today's Philippine date is displayed automatically, and tomorrow's recommendation is dated automatically. There is no manual planning-date input. Switch pages using the navigation above the planner. Budget, CPA, and headcount start the same; Page 2 uses gentler growth settings and an editable default maximum of 1.6 projects per person/day.

| Setting | Page 1: Aggressive | Page 2: Conservative |
| --- | ---: | ---: |
| Today's budget | PHP 2,800 | PHP 2,800 |
| Starting budget | PHP 2,000 | PHP 2,000 |
| Campaign day | 1 | 1 |
| Yesterday's result | Profit | Profit |
| Yesterday's CPA | PHP 400 | PHP 400 |
| Active people tomorrow | 5 | 5 |
| Maximum projects per person/day | 3.5 | 1.6 |
| Base budget step | 100% | 40% |
| Smallest/largest base step | 10% / 80% | 5% / 25% |
| Budget taper scale | PHP 2,000 | PHP 1,500 |
| Profit step boost per extra person | 2% | 1% |
| Maximum team boost | 25% | 10% |
| Extra profit step | 10% | 0% |
| Profit step boost per campaign day after day 1 | 5% | 1% |
| Maximum campaign day boost | 100% | 20% |
| Grow into unused team capacity | 15% | 3% |
| Reserve below maximum capacity | 10% | 20% |
| Capacity above quota | 10% | 20% |
| Starting projects per person/day | 0.8 | 0.6 |
| Starting period | 3 days | 7 days |
| Budget rounding unit | PHP 10 | PHP 10 |

Page 1 still recommends **PHP 4,660** and a **12-project sales quota**, averaging **2.4 projects per person**. Page 2 recommends **PHP 2,400** and a **6-project sales quota**, averaging **1.2 projects per person**. Its planned capacity is 1.28 projects per person after the 20% reserve. The original PHP 2,800 budget exceeds this smaller team's capacity ceiling, so even a profitable result is reduced to fit. These are editable planning defaults, not guaranteed outcomes.

**Page 3: Suno** uses exactly the same starting inputs, growth settings, formulas, and scenarios as Page 1. It therefore starts at **PHP 4,660**, **12 projects**, and **2.4 projects per person**. Suno is a separate planner, not an integration with an external service.

Save my inputs stores settings in that visitor's browser using localStorage. Each page saves independently: neither Page 2 nor Suno imports or overwrites another page's saved settings. Saved settings are not shared between people, devices, browsers, or domains. Reset defaults clears only the current page's saved settings on that browser. A calculator URL can optionally prefill named inputs through query parameters; only known, valid inputs are accepted.

Existing saved capacity choices are preserved. Use **Reset defaults** on Page 2 to load the new 1.6 default, or edit **Maximum projects per person / day** without resetting the rest of your inputs.

Dates are not saved campaign inputs. Old saved or URL `planDate` values are ignored, so stale or impossible dates cannot override the Philippine calendar. An open page checks for Philippine date changes every 30 seconds and when it regains focus or visibility. **Campaign day tomorrow** remains editable because it represents campaign age and affects the growth boost; update it along with your actual daily figures rather than treating it as a calendar date.

## Profit growth-stop estimate

All three pages show the profit growth-stop estimate. Each projects consecutive profitable days from today's budget using its actual calculation rules, advancing campaign age until further profit no longer raises the budget. It checks the largest remaining campaign-day boost too, so a temporary rounding stall is not mistaken for a permanent stop. Team, CPA, growth, capacity, and rounding settings otherwise stay unchanged.

With Page 2's defaults, growth stops at **PHP 2,400/day**: another profitable day still recommends PHP 2,400. This currently equals the team capacity ceiling. Other settings can stop growth earlier: with zero base/minimum/maximum steps, a 3% capacity-fill allowance, PHP 10 rounding, and a PHP 1,000 budget, growth stops at PHP 2,070 despite a PHP 2,400 capacity ceiling.

With the original Page 1 or Suno defaults, growth stops at **PHP 6,000/day**, and another profitable day still recommends PHP 6,000. Each page recalculates the projection independently from its own inputs.

Every page also shows **estimated profitable days to max**, counting one profit update per day from today's budget until the projected maximum is first reached, including waiting days before later campaign boosts. The defaults take **2 profitable days** on Page 1 and Suno. Page 2 shows **0 days** because its PHP 2,800 current budget is already above the PHP 2,400 growth-stop estimate; no further growth is needed, and the next recommendation can reduce it to fit. An unchanged budget already at the estimate also shows 0 days. Timing is conditional on consecutive profit and otherwise unchanged settings, not a guaranteed calendar forecast.

**Est. date at max (PH)** adds that day count to today's Philippine date: tomorrow is the first possible daily update, and a 0-day estimate displays today. Month/year transitions and leap days are handled as calendar days, independently of the browser timezone. Very distant forecasts outside the supported calendar range display a range warning rather than an invalid date.

The team capacity ceiling and current planning cap remain separate figures. The current cap can be lower during the starting period after break-even or loss; its default is PHP 1,200 in that case, but the growth-stop projection assumes future profit. If the projection exceeds its iteration or numeric limits, the page says the result is not determined instead of presenting the capacity ceiling as a completed forecast. This is neither an ad-platform limit nor a guarantee of profitability.

## How the model works

Profit increases one step; break-even decreases one step; loss decreases two compounded steps. The base percentage step tapers as the budget grows. On profit, campaign age increases the step and unused team capacity adds a growth allowance. Campaign day represents age; today's budget is the base for a single recommendation.

Team capacity retains the configured reserve below the maximum per person. The budget is capped so the whole-project sales quota fits within team capacity. The quota is budget divided by the CPA input, rounded up. It is the sales count needed to meet that CPA target. The per-person quota is a team average.

Page 2 uses the same formulas with smaller growth defaults, a longer starting period, and larger capacity buffers. On break-even or loss during the starting period, capacity stays at the starting per-person level; this protective limit can reduce spending more than the percentage step alone. Profit can expand capacity on either page, within its reserve limit.

Inputs, formulas, and example scenarios are available in the calculator. Changing a setting recalculates the result immediately.

The total increase/cut shows the final budget change, including compounded loss reductions, team limits, and downward rounding. The rule multiplier and pre-limit budget describe the calculation before those limits. Amounts retain cents when using fractional-peso rounding. Inputs that overflow the numeric range show an error instead of an invalid recommendation. Copyable formulas include the same small floating-point boundary adjustments as the calculator.

## Known edge cases pending a separate fix

- The outcome status can say **grow** after a profitable result even when downward budget rounding actually cuts spending. For example, PHP 50 with PHP 100 rounding and no capacity-fill allowance can round to PHP 0. The displayed budget/change show the reduction, but the status can mislead.
- Several numeric fields display a 0.01 minimum while calculation validation only requires a positive value. Smaller entries can still produce recommendations, so unrealistic sub-minimum CPA, rounding, or capacity values can distort the result.
- Very precise CPA values near a whole-project boundary can undercount the quota because expected projects are rounded before rounding up. For example, PHP 100 divided by PHP 33.3333333 is slightly above 3, but the quota displays 3 instead of the strict mathematical ceiling of 4. The monetary discrepancy is tiny, though the displayed project count differs by one.

The earlier manual-date validation problem is removed by automatic Philippine dates. The other three issues above are not changed by the calendar update. The calculator only displays recommendations; it does not change spending in an ad account.

## Local use

Open `ad-budget-calculator.html`, `ad-budget-conservative.html`, or `ad-budget-suno.html` directly, keeping the shared JavaScript and CSS files alongside them, or use Node.js 22 or newer:

```sh
npm run build
npm run preview
```

Open http://127.0.0.1:4173/. There are no packages to install.

```sh
npm test
npm run test:hosting
npm run test:browser
```

The browser check requires Chrome, Chromium, or Edge. Set `CHROME_PATH` if it is not in a standard location. Test screenshots and browser profiles stay in the ignored `.qa/` directory.

## Deploy to Vercel later

1. Import `princecjqlara/veobudget` into Vercel.
2. Select **Other** as the framework and use the repository root.
3. Keep **Build Command** as `node build.cjs` and **Output Directory** as `dist`. These values are provided by `vercel.json`.
4. No install command, database, or environment variables are needed. Deploy.

Only generated `dist/` files are served. Page 1 is available at `/` and `/ad-budget-calculator.html`; Page 2 is at `/ad-budget-conservative.html`; Suno is at `/ad-budget-suno.html`.

Vercel's Hobby plan is limited to personal, non-commercial use: https://vercel.com/docs/plans/hobby. Review the appropriate plan for business use.

Cloudflare Pages also offers a free static hosting option. Use build command `node build.cjs` and output directory `dist`: https://developers.cloudflare.com/pages/platform/limits/.

## Source files

- `ad-budget-calculator.html`: the original aggressive planner page.
- `ad-budget-conservative.html`: the less aggressive second planner page.
- `ad-budget-suno.html`: the Suno planner using the original aggressive settings.
- `budget-model.js`: shared formulas, profile-specific defaults, and example scenarios.
- `budget-planner.js`, `budget-planner.css`: shared interactions and styling.
- `build.cjs`: copies all three calculators and shared assets into the static deployment directory.
- `preview.cjs`: serves only the generated static pages locally.
- `vercel.json`: deployment settings.
- `verify-model.cjs`, `verify-browser.cjs`, `verify-hosting.cjs`: calculation, browser, and HTTP checks.
- `verify-formulas.cjs`: independent exact-fraction arithmetic checks across 3,030 plans, plus checks that the copyable equations match all three calculators across 3,039 plans.
- `verify-projection.cjs`: profit growth-stop estimates checked against direct daily simulations, rounding stalls, later campaign boosts, and projection limits.
- `verify-calendar.cjs`: Philippine date boundaries, automatic forecast dates, and removal of old saved planning dates.
