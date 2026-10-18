# Veo Budget

A static ad budget calculator with automatic growth, team capacity, and whole-project sales quotas. All calculations run in the browser. No database, backend, API keys, or environment variables are required.

## Default settings

New visitors start with the latest agreed settings. The planning date is tomorrow in the visitor's local timezone.

| Setting | Default |
| --- | ---: |
| Today's budget | PHP 2,800 |
| Starting budget | PHP 2,000 |
| Campaign day | 1 |
| Yesterday's result | Profit |
| Yesterday's CPA | PHP 400 |
| Active people tomorrow | 5 |
| Maximum projects per person/day | 3.5 |
| Base budget step | 100% |
| Smallest/largest base step | 10% / 80% |
| Budget taper scale | PHP 2,000 |
| Profit step boost per extra person | 2% |
| Maximum team boost | 25% |
| Extra profit step | 10% |
| Profit step boost per campaign day after day 1 | 5% |
| Maximum campaign day boost | 100% |
| Grow into unused team capacity | 15% |
| Reserve below maximum capacity | 10% |
| Capacity above quota | 10% |
| Starting projects per person/day | 0.8 |
| Starting period | 3 days |
| Budget rounding unit | PHP 10 |

These defaults recommend **PHP 4,660** and a **12-project sales quota**, averaging **2.4 projects per person**. Planned capacity is 2.64 projects per person, below the entered maximum of 3.5.

Save my inputs stores settings in that visitor's browser using localStorage. Saved settings are not shared between people, devices, browsers, or domains. Reset defaults clears this calculator's saved settings on that browser. A calculator URL can optionally prefill named inputs through query parameters; only known, valid inputs are accepted.

## How the model works

Profit increases one step; break-even decreases one step; loss decreases two compounded steps. The base percentage step tapers as the budget grows. On profit, campaign age increases the step and unused team capacity adds a growth allowance. Campaign day represents age; today's budget is the base for a single recommendation.

Team capacity retains the configured reserve below the maximum per person. The budget is capped so the whole-project sales quota fits within team capacity. The quota is budget divided by the CPA input, rounded up. It is the sales count needed to meet that CPA target. The per-person quota is a team average.

Inputs, formulas, and example scenarios are available in the calculator. Changing a setting recalculates the result immediately.

## Local use

Open `ad-budget-calculator.html` directly, or use Node.js 22 or newer:

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

Only generated `dist/` files are served. The calculator is available at `/` and `/ad-budget-calculator.html`.

Vercel's Hobby plan is limited to personal, non-commercial use: https://vercel.com/docs/plans/hobby. Review the appropriate plan for business use.

Cloudflare Pages also offers a free static hosting option. Use build command `node build.cjs` and output directory `dist`: https://developers.cloudflare.com/pages/platform/limits/.

## Source files

- `ad-budget-calculator.html`: the complete calculator and its defaults.
- `build.cjs`: copies the calculator into the static deployment directory.
- `preview.cjs`: serves only the generated static pages locally.
- `vercel.json`: deployment settings.
- `verify-model.cjs`, `verify-browser.cjs`, `verify-hosting.cjs`: calculation, browser, and HTTP checks.
