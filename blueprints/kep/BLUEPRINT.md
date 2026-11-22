# Kep (เก็บ) — Architecture Blueprint v0.1

> **Status: DRAFT, awaiting user approval (Spec Gate).** No code will be written until this is confirmed.
> "Kep" (เก็บ, "to keep / to save") is a placeholder working name; rename freely.

## 0. Scope and clean-room statement

- **Reference product:** Weple Money: รายรับรายจ่าย (bumblebee apps), Android listing on Google Play.
- **Goal:** an income/expense tracker with the same core workflow (calendar ledger plus category statistics), with the improvements in §2.2.
- **Clean-room:** the feature set and flows are re-implemented from observable behaviour only. Kep uses an original name, icon, palette, copy and illustrations. No vendor code is decompiled or copied, and no reference assets (piggy-bank logo, teal trade dress, screenshots, marketing text) are reused.

---

## 1. Evidence

### 1.1 Observed facts: Play Store listing screenshot (2026-11-22)

**Listing**
- Title "Weple Money: รายรับรายจ่าย", developer "bumblebee apps".
- Marked "contains ads" and "in-app purchases".
- 5.0★ from 205 reviews; content rating 3+; size 26 MB.
- Marketing banner: "จาก iPhone สู่ Android" (from iPhone to Android) and "4.8 · ดาวน์โหลดบน iPhone 6 ล้านครั้ง" (6 million iPhone downloads).

**Screen A: calendar ledger (home)**
- Teal header with a month selector ("10 ▾"), search and filter icons, and two icons on the left (likely stats and list; function unverified).
- Month summary:
  - Income (รายรับ) ฿40,000
  - Expense (รายจ่าย) ฿20,364
  - Balance (คงเหลือ) ฿22,734, with a ▾ dropdown
- Expense split by payment type: Cash 12,266 · Card 8,098 · Savings 5,000. Cash plus card is 20,364, which equals total expense.
- Sunday-first month grid. Each day cell shows that day's income and expense in two colours, and the selected day is highlighted.
- Draggable bottom sheet grouped by day, e.g. header `2/10  −฿1,325 … ฿23,425 ›`. Each row shows memo, category, payment method and amount:
  - "ซื้อของเข้าบ้าน · อาหาร · บัตรเครดิต ฿1,250" (household shopping · food · credit card)
  - "กาแฟ ฿75" (coffee)

**Screen B: statistics (สถิติ)**
- Period selector `‹ 10 ›`; Expense/Income toggle; "by category" dropdown; a "compare" control.
- Headline "ใช้ไปเดือน 10" (spent in month 10): ฿20,364.
- Donut chart with category icons around the ring. The centre callout reads "largest expense: Housing 54%", and segments read 54 / 17 / 12 / 9 %.
- Payment row: Cash 12.3K · Card 8,098 · (third column) 0 · Savings 5,000.
- Ranked category list with share bar, amount and change vs. previous period:
  - Housing 54% ฿10,950
  - Food 17% ฿3,434 ↓33%

### 1.2 Public listing (secondary source)

These come from App Store search snippets. The listing page itself was not reachable from this container, so they are unverified.

- Free app plus a paid "Pro" version (Pro is 249 THB on the Thai App Store).
- Release notes mention:
  - balance-after-transaction display (v4.8.3)
  - subcategory charts in statistics (v4.8.3)
  - a home-screen widget (v4.8.7 fix)
  - emoji category icons, and a budget screen with hideable category groups (v4.7.7)
- Reviewer requests: multi-device sync, transfers between accounts, recurring expenses, a budget pie chart, and photos on entries.

### 1.3 Hypotheses and unknowns

| ID | Statement | Confidence |
|---|---|---|
| H1 | Balance ฿22,734 ≠ 40,000 − 20,364 (= 19,636), so balance probably includes a carry-over or opening balance. | Unverified |
| H2 | "Savings 5,000" appears in the payment split but is excluded from the ฿20,364 total, so savings is probably a special payment type rather than a real transfer. | Unverified |
| H3 | The day-header figure (e.g. ฿23,425) is the running balance after that day; this matches the v4.8.3 note. | Likely |
| U1 | Server-side behaviour (backup/sync, accounts, ad and IAP entitlement, analytics) is not observable. Kep designs these fresh. | n/a |
| U2 | Exact category taxonomy, budget rules and widget behaviour are not visible; Kep defines its own. | n/a |

**Not done:** APK decompilation. REA's Android providers (JADX, apktool, ADB) are not configured here, and a clean-room rebuild of an observable feature set does not need vendor code.

---

## 2. Product scope

### 2.1 Parity (MVP)

| Feature | Reference | Kep v1 |
|---|---|---|
| Calendar month ledger with per-day income and expense | ✅ observed | ✅ |
| Month summary: income / expense / balance | ✅ observed | ✅ (balance made transparent, see I3) |
| Add income or expense: amount, category, payment method, date, memo | ✅ observed | ✅ (faster, see I6) |
| Categories with emoji icons, subcategories, groups, hide/reorder | listing | ✅ |
| Stats: donut by category, expense/income toggle, ranked list, % share, Δ vs. previous period | ✅ observed | ✅ |
| Subcategory drill-down in stats | listing | ✅ |
| Split by payment method | ✅ observed | ✅ (as real accounts, see I2) |
| Search and filter | ✅ observed (icons) | ✅ |
| Running balance per day | likely (H3) | ✅ |
| Budgets per category | listing | ✅ |
| Home-screen widget | listing | ⏭ Phase 2: PWAs can't do widgets; Capacitor wrapper can |

### 2.2 Improvements ("make it better")

| # | Improvement | Why |
|---|---|---|
| I1 | No ads, all core features free, no tracking SDKs. Local-first, with CSV/JSON export and import. | Reference ships ads and IAP; users own their data. |
| I2 | Real accounts (cash, bank, credit card, savings, e-wallet) and transfers. Moving money to savings is a transfer, never spending. | Fixes the H2 ambiguity; transfers were a reviewer request. |
| I3 | Transparent balance: tap the balance to see carry-over + income − expense = balance, with a "this month only" toggle. | Fixes the H1 confusion. |
| I4 | Recurring transactions (rent, subscriptions, salary) with auto-post and an "upcoming" list. | Reviewer request. |
| I5 | Budgets with progress bars, pace and "safe to spend per day", plus a budget donut. | Reviewer request. |
| I6 | Faster entry: custom numpad with calculator (`120+45`), category suggestions from memo history, recent-first category grid, templates. Target: a repeat expense in ≤ 3 taps. | Entry speed is the main reason people abandon expense trackers. |
| I7 | Trends: 6- and 12-month bars, daily average, compare any two periods. | Reference compares only against the previous period. |
| I8 | Receipt photo attachments, stored on-device and compressed. | Reviewer request. |
| I9 | Thai-first: Thai and English UI, Buddhist Era (พ.ศ.) toggle, ฿ formatting. | Primary market. |
| I10 | Accessibility: larger calendar numerals, WCAG AA contrast, income and expense shown by sign as well as colour, full dark mode. | The reference calendar figures are tiny. |
| I11 | Privacy lock: PIN, plus biometric via WebAuthn where supported. | Financial data. |

### 2.3 Out of scope for v1 (Phase 2 candidates)

- Optional end-to-end-encrypted multi-device sync (reviewer request; needs a server design).
- Thai bank-slip OCR / PromptPay slip import.
- Multi-currency.
- Credit-card statement-cycle tracking.
- Home-screen widget, via the Capacitor Android wrapper.

---

## 3. Architecture

### 3.1 Recommended stack (pending approval)

**Installable PWA:** React 18 + TypeScript + Vite.

| Concern | Choice |
|---|---|
| App shell / offline | vite-plugin-pwa (Workbox); installable on Android/iOS home screen |
| Storage | IndexedDB via Dexie, with versioned schema migrations |
| State | Zustand + Dexie live queries |
| Money | Integer satang (฿1 = 100); no floating point |
| Dates | date-fns with `th` locale; Buddhist Era formatting helper |
| Charts | Custom SVG donut and bar components (small, accessible, themeable) |
| i18n | i18next, th / en |
| Tests | Vitest for domain logic; Playwright end-to-end (Chromium is available in this container) |
| Store release (later) | Capacitor → Android AAB for Google Play; enables a native widget |

**Why this stack:**
- It can be built, run and tested end to end in this container. There is no Android SDK here, and its download hosts are blocked.
- It works on any phone today.
- Capacitor gives a path to the Play Store later.

**Alternatives:**
- **Flutter:** native feel from a single codebase, but the Android binary cannot be built or tested here.
- **Kotlin + Jetpack Compose:** the best native Android result, with the same limitation.
- **Expo React Native:** could only be tested through Expo web here.

### 3.2 Module map

```
src/
  domain/      pure TS: money, ledger math, balances, budgets, recurrence, stats   (fully unit-tested)
  data/        Dexie db, schema, repositories, migrations, CSV/JSON import-export
  features/
    calendar/  month grid, summary card, draggable day sheet
    entry/     quick-add sheet, numpad + calculator, category picker, suggestions
    stats/     donut, ranked list, drill-down, trends, compare
    budgets/   budget list, progress, pace
    accounts/  accounts, transfers, balances
    recurring/ rules, auto-post, upcoming
    settings/  categories, lock, language/BE, theme, backup
  ui/          design tokens, components (Sheet, Numpad, Donut, Bar, Chip, ...)
  app/         routing, tabs, PWA shell, i18n bootstrap
```

### 3.3 Data model

```ts
type ID = string;      // ULID
type Satang = number;  // integer; ฿1 = 100
type ISODate = string; // 'YYYY-MM-DD' (local calendar date)

interface Account {
  id: ID; name: string;
  kind: 'cash' | 'bank' | 'credit_card' | 'savings' | 'ewallet';
  openingBalance: Satang; currency: 'THB';
  includeInBalance: boolean; archived: boolean; sort: number;
}

interface CategoryGroup { id: ID; kind: 'expense' | 'income'; name: string; hidden: boolean; sort: number; }

interface Category {
  id: ID; kind: 'expense' | 'income'; name: string; emoji: string; color: string;
  parentId?: ID;   // subcategory
  groupId?: ID; hidden: boolean; sort: number;
}

interface Transaction {
  id: ID; type: 'expense' | 'income' | 'transfer';
  amount: Satang;  // always positive; sign derives from type
  date: ISODate; time?: string;
  accountId: ID; toAccountId?: ID;  // toAccountId only for transfers
  categoryId?: ID;                  // required for expense/income
  memo?: string; tags: string[]; attachmentIds: ID[];
  recurringId?: ID; createdAt: number; updatedAt: number;
}

interface Budget { id: ID; categoryId: ID | null /* null = overall */; amount: Satang; rollover: boolean; }

interface RecurringRule {
  id: ID;
  template: Pick<Transaction, 'type' | 'amount' | 'accountId' | 'toAccountId' | 'categoryId' | 'memo' | 'tags'>;
  freq: 'daily' | 'weekly' | 'monthly' | 'yearly'; interval: number;
  byMonthDay?: number; byWeekday?: number[];
  startDate: ISODate; endDate?: ISODate; autoPost: boolean; lastPostedDate?: ISODate;
}

interface Attachment { id: ID; blob: Blob; mime: string; width: number; height: number; }
```

**Domain rules**
1. Spending and income statistics count only `expense` and `income`. Transfers never count.
2. The month balance, shown as a breakdown, is carry-over + income − expense. Carry-over is the sum of `openingBalance` plus all prior net flows for accounts with `includeInBalance`.
3. The day running balance is the sum of included account balances at the end of that day.
4. Month-day 29–31 recurrences clamp to the last day of a shorter month.
5. All amounts are integer satang. Display formatting is applied only at the UI edge.

### 3.4 Screens and navigation

Bottom tabs: **Calendar** (home) · **Stats** · **Budgets** · **More**. A centre **＋** button opens the entry sheet from anywhere.

- **Calendar:**
  - Month picker and summary card; tapping the card shows the balance breakdown.
  - Month grid with per-day income and expense.
  - Draggable day sheet; long-pressing a day adds an entry on that date.
- **Entry sheet:**
  - Tabs: Expense / Income / Transfer.
  - Numpad with calculator, recent-first category grid, account chips, date, and memo with autocomplete.
  - Photo attachment; "save & add another".
- **Stats:**
  - Period (month / year / custom) and expense/income toggle.
  - Donut; tapping a segment opens the subcategory drill-down and its transactions.
  - Ranked list with Δ vs. the previous period; trend bars; compare two periods.
- **Budgets:** overall and per-category progress, pace marker, safe-to-spend per day.
- **More:** accounts, recurring, categories, search and filter, export/import, app lock, language and Buddhist Era, theme.

### 3.5 Server-side gaps

v1 has **no server**. Backup is file export and import. Ads and IAP are not built. Multi-device sync is deferred to Phase 2 and needs its own design (end-to-end encrypted).

---

## 4. Delivery plan (clean-builder, module by module)

| Milestone | Content | Exit criteria |
|---|---|---|
| M1 | `domain/` + `data/` (schema, repos, migrations, seed categories) | Unit tests green for money, balances, stats, recurrence |
| M2 | Design system + app shell (PWA, tabs, i18n, theme) | Installable, offline shell; light and dark |
| M3 | Entry sheet + calendar | Add, edit and delete flows; e2e test |
| M4 | Stats (donut, ranked list, drill-down, trends) | Matches domain totals; e2e test |
| M5 | Accounts/transfers + budgets | Transfers excluded from stats; pace calculation tested |
| M6 | Recurring + search/filter | Auto-post idempotent across app restarts |
| M7 | Settings: categories, export/import, lock | Round-trip export → import equality test |
| M8 | Full e2e pass, Lighthouse PWA audit, preview deploy | Lighthouse PWA ✓, a11y ≥ 90 |

## 5. Decisions needed before build

| ID | Decision | Recommendation |
|---|---|---|
| D1 | Tech stack | PWA (React + TS + Vite), Capacitor later |
| D2 | Where the code lives | New private GitHub repo (this repo is REA's own source) |
| D3 | Name and branding | Working name "Kep (เก็บ)"; indigo + amber palette, non-pig icon |
| D4 | MVP scope | §2.1 parity + I1–I11; Phase 2 items deferred |
