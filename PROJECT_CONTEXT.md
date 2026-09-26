# Akashic Records — Project Context

Working notes for picking this codebase up cold. The `README.md` covers what the app *is*
in the project's own voice; this file covers how it is built, what was recently changed,
and what is still open.

Last updated: 2026-09-25, after the completion pass in §5.2, merged over the parallel
pass `0661754`.

---

## 1. What this is

A manhwa/webtoon reading tracker presented as an RPG "System" HUD — the interface styles
itself as a hunter-leveling terminal rather than a conventional library app. Users catalogue
series, track chapter progress, and the UI dresses that data as ranks, quests and telemetry.

**Stack**

| Layer | Technology |
| :--- | :--- |
| Frontend | React 18 + TypeScript, Vite |
| Styling | Tailwind CSS (config in `system/tailwind.config.js`) |
| Motion | `motion` (Framer Motion) |
| 3D | Three.js (`three`) |
| Backend | Express + Mongoose (MongoDB) |
| Auth | JWT, bcryptjs, httpOnly cookie session |
| Deploy | Vercel (`vercel.json`, serverless entry at `api/index.js`) |

**Two themes**, and they are genuinely different designs rather than inverted values:

- **Dark ("Void")** — near-black `#020202`, amber `#f59e0b` accent.
- **Light ("Aureic")** — a pale "drafting table" `#e9eef5`, cyan `#06b6d4` accent.

---

## 2. Running it locally

```bash
npm run dev          # concurrently: backend (nodemon) + frontend (vite)
```

Or separately, which is what you want if a tool harness injects `PORT`:

```bash
PORT=5000 node backend/server.js        # API — MUST be 5000
cd system && vite                       # frontend on 5173
```

**The backend must be on port 5000.** `system/vite.config.*` proxies `/api` there. The
server reads `process.env.PORT || 5000`, so anything that sets `PORT` (some dev harnesses
set it to the frontend port) will silently break every API call.

Config lives in `backend/.env` (gitignored). `mongod` runs locally as a Windows service.

> **Check before trusting "local".** On 2026-09-25 the `MONGODB_URI` in `backend/.env`
> pointed at a **non-local host**, not the local `mongod` (which was running but held only
> an empty `akashic_records`). Every `node backend/server.js` therefore talks to that remote
> database — guest logins create sandboxes there. Confirm whether it is production and
> point local development at `mongodb://127.0.0.1:27017/...` if it should not be. Never
> print the URI; check it with
> `node -e "require('dotenv').config({path:'backend/.env',quiet:true});console.log(/@?(localhost|127\.0\.0\.1)[:/]/.test(process.env.MONGODB_URI||''))"`.

**Guest login requires the API.** With the backend down, the login screen returns
`SYS_ERR: GUEST_LINK_SEVERED` and the app never mounts — so a UI review needs the API up
even though the UI itself is static. To see the login screen without ending a session,
remove `akashic_session_expires` from localStorage and reload; putting a future epoch-ms
back returns to the dashboard on the same cookie.

**Verification commands**

```bash
cd system && npx tsc --noEmit        # types
npx eslint ../src                    # lint (run from system/)
npm run lint                         # lint, from the root: src + backend + api
cd system && npm run build           # production build
```

The `three` chunk-size warning in the build output is pre-existing and expected — it is
already split into its own lazy chunk.

---

## 3. Layout

```
src/
  core/
    App.tsx           # the dashboard; large, holds most page state
    constants.ts      # THEMES — the single source of theme tokens
    types.ts          # Theme, Quest, Rank interfaces
    depth.ts          # elevation() and emphasis() — the depth system
    main.tsx          # root; wraps the app in MotionConfig (reduced motion)
  components/
    dais/             # Three.js holographic platform under the hero card
    fx/               # background field: nebula, star field, ripples, noise
    quest/            # Card3D, QuestCard, ManhwaDetail (+ its own .css)
    system/           # SystemFrame, BootScreen, LoginScreen, modals, notifications
    tower/            # DivineSpire + TowerStructure (Three.js) + TowerHUD
    profile/          # HunterProfile
  lib/dais/geometry.ts  # traced dais geometry, no `three` import
  utils/ranks.ts        # QUEST_RANKS, USER_RANKS, rank helpers
  utils/useDialogFocus.ts  # dialog focus/Escape/Tab-trap, stack-aware (§4.6)
  styles/index.css      # global CSS + the utilities Tailwind can't express

backend/    # Express app, Mongoose models, maintenance scripts (see backend/scripts/README.md)
api/        # Vercel serverless entry
system/     # Vite root: index.html, vite.config, tailwind.config
```

---

## 4. The design system

This is the part most likely to be violated by accident. Read it before touching colour.

### 4.1 Four inks, not one accent

Defined in `core/types.ts`, valued in `core/constants.ts`:

| Token | Purpose | Light | Dark |
| :--- | :--- | :--- | :--- |
| `accentColor` | **Decorative only** — fills, glows, gradients, artwork | `#06b6d4` | `#f59e0b` |
| `accentInk` | **Structural** — text, icons, thin lines; anything read | `#155e75` | `#f59e0b` |
| `warningInk` | Warnings and countdowns; stays amber when the theme is cyan | `#92400e` | `#f59e0b` |
| `inkGradient` | **Gradient text** (`bg-clip-text`) — the gradient twin of `accentInk` | `#164e63 → #0c6f8a → #155e75` | = `gradient` |

The rule when adding UI: **ask whether a colour is *read* or merely *seen*.** Read →
`accentInk` (or `inkGradient` if it is gradient text). Seen → `accentColor` / `gradient`.
Warning → `warningInk`. On dark the pairs collapse to the same values, so mistakes only
show up in light mode. `gradient` is never a text fill: on light its stops measured
1.8–2.4:1. Every `inkGradient` stop clears 4.5:1 even against the darkest page stop.

### 4.2 Depth — `core/depth.ts`

Never hand-write a shadow.

- `elevation(theme, 0..3)` — dark shows height as *emitted light* (a lit top rim, since a
  cast shadow has nothing to darken on near-black); light shows it as a *cast shadow*,
  cool-tinted slate rather than black.
- `emphasis(theme, rgb, strength)` — the glow/shadow translation. A coloured glow cannot
  simply be recoloured for light mode: on a pale page there is no headroom above the
  background to glow *into*. The light branch spends it as a neutral cast shadow plus a
  tight saturated ring instead.

Because Tailwind cannot express a shadow driven by a custom property (see §6), two helper
classes in `styles/index.css` read CSS variables set in JS: `.card-plate` (hero card) and
`.elev-1` (hand-rolled panels; the page sets `--elev-1` from `elevation(theme, 1)`).

`SystemFrame` takes a `level` prop and applies `elevation` itself. Its panel colour goes
through `surfaceClass` — **not** `className` (see §6).

### 4.3 The light field

`components/fx/GalaxyNebula.tsx` is `fixed inset-0` and therefore **is** the page
background — it covers the `appBg` token entirely. Light renders `#edf1f7 → #e9eef5 →
#e2eaf3` plus a 32px/160px slate drafting grid, over which white panels rise on a real
shadow like paper. Changing `appBg` alone does nothing visible.

The background field (`OmniscientField`, `GoldenRipples`, `SanctuaryRing`) is *inverted*
for light — slate nodes and contour linework rather than glowing points — for the same
headroom reason. (`SanctuaryRing` drew pure black on light until 2026-09-25; it now uses
`theme.starColor`, slate-600, like the rest of the field.)

### 4.4 Deliberate exception: ManhwaDetail

`components/quest/ManhwaDetail.css` gives the detail view its own `[data-theme]` variants:
light is a **cinematic mid-slate backdrop** (`#98a2b5 → #949db0`) with pale stars, not the
drafting table. This is authored, not drift, and the owner explicitly chose to keep it as
its own moment. Do not "fix" it into the drafting table.

Its consequence for colour: a mid-slate ground (L ≈ 0.37–0.41) has no room for mid-tones in
either direction, so **text in this view uses a deeper ink on light** — `inkText`
(`cyan-950`) for accent text, `slate-800`/`-900` for neutrals sitting on the bare backdrop,
`slate-600`/`-700` only on the white/35 panels. The page ink `#155e75` measures 3.3:1 here.
Cards that are always a dark scrim over art (similar records) take fixed pale ink instead.

### 4.5 The hero composition (dashboard)

The card, cone and dais are positioned by solved geometry, not tuning — keep the comments
in `App.tsx` in sync if any of them move. Canvas height `h = width / 5`; the body's back rim
projects at `0.139h` below the canvas top, the emitter at `0.254h`, the front floor ring at
`0.848h`.

- **lg and up** (unchanged): card lifts `7.4vh` (`lg:-top-[7.4vh]`), dais `translate-y 56%`
  (68% on ≥1000px-tall screens), cone 35% / 37%.
- **Below lg**: the card keeps a fixed 20px lift (lifting it further puts its reticles under
  the fixed header) and the *platform* moves down instead — dais `80%` (phone) / `82%` (md),
  cone `35%`. The title block carries a margin that clears the lowered front ring.
- **Phone card width is height-driven**: `--hero-w = clamp(240px, (100dvh − 320px) × 0.632,
  min(85vw, 320px))`, set once on the hero column and read by both the card width and the
  title margin, so they cannot be solved separately. It keeps card, platform, title,
  progress and controls above the 28px console bar on a 375×812 phone.

Measured after the change: card base 15–16px clear of the back rim on every phone and
tablet size tried (320×568 → 820×1180), cone origin within 3px of the emitter, title 12px
clear of the front ring, no horizontal overflow; desktop values identical to before.

### 4.6 Focus, dialogs and motion

- **Focus ring.** `:focus-visible` draws a 2px outline in `var(--focus-ring)`, which
  `App.tsx` sets on `<html>` from `accentInk` (so it also covers boot, login and every
  overlay). Inputs that recolour their own border opt out with `outline-none`.
- **Dialogs.** Every overlay (gate modal, notification, detail, profile + its two panels,
  Divine Spire) uses `useDialogFocus(ref, active, onClose, initialFocus?)`: focus in on open,
  Tab trapped, Escape closes, focus restored on close. Dialogs nest (Detail → Edit → Purge
  confirm), so open dialogs form a **stack** and only the topmost acts on a key. A
  confirmation opens on its safe choice (Cancel).
- **Reduced motion** is handled in three layers: a global CSS reset in `index.css` (every
  CSS animation/transition collapses to its end state), `MotionConfig reducedMotion="user"`
  in `main.tsx` (motion drops transforms, keeps opacity), and explicit checks in the loops
  CSS can't reach — dais, tower, `OmniscientField` (one still frame), `GoldenRipples` (off),
  BootScreen constellations (held on their front view), `Card3D` (no tilt).

---

## 5. Change history

### 5.1 a356f56 — holographic dais, light-theme rework, contrast pass

- `lib/dais/geometry.ts` — dais geometry traced off a reference image, with the projection
  it was measured through recorded so the numbers stay auditable.
- `components/dais/` — a lazily-loaded Three.js scene. **The renderer creates its own
  canvas**: a canvas whose WebGL context has been force-lost can never hand out another, so
  a React-owned canvas breaks on theme toggle.
- `components/quest/Card3D.tsx` — pointer-tracked tilt on the hero card, driven entirely by
  refs and direct style writes so the memoised subtree never re-renders on pointer move.
- Light theme rework: deeper page, the accent split into inks, the depth system.
- A contrast pass across every page. The recurring causes, most frequent first — **check
  new UI against this list**:
  1. **White on an accent fill** (~2.2–2.4:1). Near-black on the fill instead.
  2. **A dark-tuned palette on a light surface** (`-400` rungs ≈ 2.3:1 on white). Add a
     light variant (`CLASS_COLORS_LIGHT`, `Rank.colorLight`) rather than flattening.
  3. **`opacity-*` hiding content.** Tiers belong in *colour*.
  4. **Surface pinned, text themed** (or the reverse).
  5. **Classes assembled at runtime** — see §6.

### 5.2 2026-09-25 completion pass

Worked page by page; each page was measured in both themes at phone, tablet and desktop.

- **Dais render loop (bug).** The build effect started its own unconditional rAF loop *and*
  the visibility effect started a second one, so the dais rendered twice per frame, spun
  at double speed, and never paused behind overlays. Now exactly one loop (verified: one
  callback per frame; zero with an overlay open). `resize()` repaints, so a paused or
  reduced-motion dais is not left blank; late resizes after dispose are cancelled/latched.
- **Gradient text** measured for the first time (extended sweep, §7) — every light
  instance failed (1.23–2.43:1). New `inkGradient` token; all gradient headings now
  4.7–5.7:1 on light, 5.1–9.7:1 on dark.
- **Mobile/tablet hero overlap** fixed (§4.5); tablet was also worse than documented — the
  dais ran through the title at 768×1024.
- **No way to add a quest below lg (bug).** `CREATE_GATE` was desktop-only and the mobile
  HUD's "create" button actually entered the portal. Header now has a compact create
  button below lg; the HUD button is labelled for what it does.
- **EXP bar** was hardcoded at 60%; it now shows progress to the next rank, with a legend.
- **ManhwaDetail light** re-measured against its real backdrop — 15 failures the old
  sweep could not see (it fell back to the black `<body>`). Fixed with deeper inks (§4.4);
  backdrop untouched.
- **Surface/ink mismatches fixed**: mobile HUD plates, TowerHUD mobile dock (its
  `bg-black/85` never painted — §6), calibration overlay (grey sludge on light), Active
  Progress cards with no cover (white on white).
- **Profile on phones**: the close button was off-screen (the profile could not be
  closed) and the rank name clipped under the donut. Header and hero re-flow below sm.
- **Calibration**: a refused request (403/5xx) left the overlay on EXECUTING_SCAN forever;
  it now fails visibly and shows the reason.
- **Keyboard access**: hero card, active-quest rows, profile rows/cards, Spire quest cards
  (details reveal on focus) and a focus-revealed layer list for the canvas-only tower;
  import (`<input type=file>` was `display:none`). Labels associated with every field;
  every icon-only control named.
- **Dead code removed**: `getThemedRankStyle` / `playerRank.style` (never read; also
  compared against `'Sovereign'` while labels are upper-case).
- **Backend scripts**: the broken and one-off diagnostics removed; `db_diag.js` and
  `sync_metadata.js` kept in repaired form (no longer print the URI / fixed import);
  `reset_sandbox.js` removed as a hazard (it emptied the guest template). No script carries
  a credential. `backfill_normalized_titles.js` gained `--dry-run`.
  `backend/scripts/README.md` lists what remains, what each writes, and the backfill
  procedure.

**Merged with the parallel pass `0661754`.** A second session ran an overlapping pass and
pushed it to `main` first. This pass was merged over it as the base; from `0661754` these
were kept because they fixed things this pass had not:

- **Backend races**: the per-tenant `UserSettings` / `DailyQuest` singletons are fetched or
  created with one atomic upsert (concurrent first requests hit E11000 and returned a 500
  from `/api/boot/initial-data`), and the daily-absorbed list uses `$addToSet`.
- **Library not wiped** when a refresh (after import or recalibration) fails transiently.
- **BootScreen**: skippable (Esc/Enter/Space or SKIP), decorative layers hidden from screen
  readers, the phase announced politely, a progressbar role, no pulsing on `[STABLE]`.
- **Light-theme details**: RankSigil light palette (the letter measured 1.3–1.7:1),
  QuestCard title and quest-rank light rungs one step deeper (-800), the Active Progress
  scrim, an opaque Divine Spire button plate, a cool edge falloff instead of grey, a
  theme-aware text selection colour.
- `scrollbar-width: none` for Firefox; the `animate-aura` rest state under reduced motion
  (the global reset otherwise left it a solid accent disc).

Superseded by this pass where the two overlapped: `useDialog` (→ `useDialogFocus`),
`gradientInk` (→ `inkGradient`), the `.hero-stage` CSS solve (→ `--hero-w`, §4.5), the
Spire sector index (→ the layer list), and the ManhwaDetail white-plate treatment (→ the
deeper-ink treatment in §4.4).

---

## 6. Invariants and traps

**Tailwind only sees literals.** A class built at runtime — `hover:${theme.headingText}`,
`bg-${theme.primary}-500` — is never emitted. The base class often exists because some other
file writes it out, while the *variant* does not, so it fails silently and only in one
state. `system/tailwind.config.js` **derives its safelist from `constants.ts`**: every
colour utility the themes contain (including `inkGradient`), crossed with
`hover/focus/group-hover/focus-within/active`. Change a token and the safelist follows.
Classes built from a *variable* rather than a theme token still need literal conditionals
at the call site. `placeholder:` is **not** in the safelist variants.

**A bare `var()` in an arbitrary shadow is read as a colour.** `shadow-[var(--x)]` compiles
to `--tw-shadow-color: var(--x)` and the element computes `box-shadow: none`. Shadows driven
by a custom property must be plain CSS. (Outline colours from a variable need the type hint:
`outline-[color:var(--focus-ring)]`.)

**`SystemFrame className` does not paint the panel.** It lands on the outer wrapper,
behind the solid inner surface. Use `surfaceClass` for the panel colour.

**Two background utilities on one element.** Only one wins, and it is decided by CSS source
order rather than the order written in the class string.

**A border-colour class with no border width renders nothing**; nor does a text-colour class
on an empty `div` (the SystemNotification dots were invisible for that reason).

**`flex-1` + `w-full` does not wrap.** Line breaking reads the flex *basis* (0% for
`flex-1`); use `basis-full` to force a wrap.

**Contrast must be checked against the darkest stop of the page gradient**, not the token —
and for gradient-painted views (ManhwaDetail) against the backdrop, not whatever opaque
colour sits behind it in the DOM (§7).

**Tooling traps seen on this machine**

- A **hidden browser pane** stalls `requestAnimationFrame` entirely: motion entrances freeze
  at `opacity: 0`, and a sweep then skips everything. Front the pane, or settle inline
  opacity/transform before measuring. Screenshots pump frames.
- The **Vite file watcher on Windows** can coalesce two quick saves and keep serving the
  first transform (symptom: a `ReferenceError` for something that is plainly imported).
  `touch` the file.
- Python on Windows writes **CRLF** in text mode; the repo is LF. Write with `newline=''`.

---

## 7. Verifying contrast

Colour work here is measured, not eyeballed. Paste the sweep, then call it. It walks every
text node, composites the real background, folds in the opacity chain, and additionally:

- measures **gradient text** stop by stop against the real background (reporting the worst);
- measures **icon-only controls** at the 3:1 graphics floor;
- lists **controls without an accessible name**;
- takes `{ page, stopAt }` for views painted with background *images*, where a colour walk
  would otherwise climb past the backdrop to some unrelated opaque ancestor.

```js
window.__sweep = function (opts) {
  opts = opts || {};
  if (!document.getElementById('__notrans')) { const st = document.createElement('style'); st.id = '__notrans'; st.textContent = '*,*::before,*::after{transition:none !important}'; document.head.appendChild(st); }
  const parse = s => { const m = (s || '').match(/[\d.]+/g); return m ? m.slice(0, 4).map(Number) : null; };
  let PAGE = null;
  for (const el of document.querySelectorAll('body,div,main')) { const r = el.getBoundingClientRect(); if (r.width < innerWidth * 0.9 || r.height < innerHeight * 0.8) continue; const p = parse(getComputedStyle(el).backgroundColor); if (p && (p.length < 4 || p[3] >= 0.99)) PAGE = p.slice(0, 3); }
  if (opts.page) PAGE = opts.page; if (!PAGE) PAGE = [255, 255, 255];
  const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = p => 0.2126 * lin(p[0]) + 0.7152 * lin(p[1]) + 0.0722 * lin(p[2]);
  const ratio = (a, b) => { const x = L(a), y = L(b), hi = Math.max(x, y), lo = Math.min(x, y); return +((hi + 0.05) / (lo + 0.05)).toFixed(2); };
  const over = (f, a, b) => [0, 1, 2].map(i => f[i] * a + b[i] * (1 - a));
  const stopBg = opts.stopAt ? document.querySelector(opts.stopAt) : null;
  const bgOf = el => { let n = el, st = []; while (n && n !== document.documentElement && n !== stopBg) { const p = parse(getComputedStyle(n).backgroundColor); if (p) { const a = p.length > 3 ? p[3] : 1; if (a > 0) st.push([p, a]); if (a >= 0.999) break; } n = n.parentElement; } let b = PAGE; for (let i = st.length - 1; i >= 0; i--) b = over(st[i][0], st[i][1], b); return b; };
  const opChain = el => { let o = 1, n = el; while (n && n !== document.documentElement) { const v = parseFloat(getComputedStyle(n).opacity); if (!isNaN(v)) o *= v; n = n.parentElement; } return o; };
  const arts = [...document.querySelectorAll('img:not([aria-hidden="true"])')].map(i => i.getBoundingClientRect()).filter(r => r.width > 2 && r.height > 2);
  const onArt = r => arts.some(a => !(a.right <= r.left || a.left >= r.right || a.bottom <= r.top || a.top >= r.bottom));
  const visible = (el, r) => r.width >= 4 && r.height >= 4 && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0;
  const out = [], skipped = [], grads = [], icons = [];
  for (const el of document.querySelectorAll('*')) {
    const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join('').trim();
    const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none') continue;
    const r = el.getBoundingClientRect(); if (!visible(el, r)) continue;
    const op = opChain(el); if (op < 0.08) continue;
    const b = el.closest('button'); if (b && b.disabled) continue;                       // WCAG exempts disabled
    const px = parseFloat(s.fontSize), bold = parseInt(s.fontWeight) >= 700; const need = (px >= 24 || (px >= 18.66 && bold)) ? 3 : 4.5;
    if (t) {
      if (s.webkitTextFillColor === 'rgba(0, 0, 0, 0)') {                                  // gradient text
        let host = el, bi = s.backgroundImage; while ((!bi || bi === 'none') && host.parentElement) { host = host.parentElement; bi = getComputedStyle(host).backgroundImage; }
        const stops = (bi.match(/rgba?\([^)]+\)/g) || []).map(parse); const bg = bgOf(el.parentElement || el);
        const cs = stops.map(p => ratio(p.length > 3 && p[3] < 1 ? over(p.slice(0, 3), p[3] * op, bg) : (op < 1 ? over(p.slice(0, 3), op, bg) : p.slice(0, 3)), bg));
        const worst = Math.min(...cs); grads.push(`${worst < need ? 'FAIL' : 'ok  '} worst ${worst} (need ${need}) stops[${cs.join(', ')}] ${px}px "${t.slice(0, 28)}"`); continue;
      }
      const fg = parse(s.color); if (!fg || (fg.length > 3 && fg[3] === 0)) continue;
      const bg = bgOf(el), alpha = (fg.length > 3 ? fg[3] : 1) * op; const eff = alpha < 1 ? over(fg.slice(0, 3), alpha, bg) : fg.slice(0, 3); const c = ratio(eff, bg);
      if (c < need) (onArt(r) ? skipped : out).push(`${c} (need ${need}) ${px}px op${op.toFixed(2)} "${t.slice(0, 26)}"`);
    }
    if (el.tagName === 'svg' && !el.closest('[aria-hidden="true"]')) {                      // icon-only controls, 3:1
      const ctl = el.closest('button,a,[role=button]'); if (!ctl) continue;
      if ([...ctl.querySelectorAll('*')].concat([ctl]).some(n => [...n.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()))) continue;
      const shape = el.querySelector('path,polyline,line,circle,polygon,rect'); const ss = shape ? getComputedStyle(shape) : s;
      let col = ss.stroke && ss.stroke !== 'none' ? ss.stroke : ss.fill; if (!col || col === 'none' || col.startsWith('url')) col = s.color;
      const fg = parse(col); if (!fg) continue; const bg = bgOf(ctl); const a = (fg.length > 3 ? fg[3] : 1) * op;
      const c = ratio(a < 1 ? over(fg.slice(0, 3), a, bg) : fg.slice(0, 3), bg); icons.push(`${c < 3 ? 'FAIL' : 'ok  '} ${c} icon in [${ctl.getAttribute('aria-label') || ctl.getAttribute('title') || '(no name)'}]`);
    }
  }
  const unnamed = [...document.querySelectorAll('button,a[href],[role=button],input,select,textarea')].filter(n => { const r = n.getBoundingClientRect(); if (!visible(n, r)) return false; if (n.matches('input,select,textarea')) { if (n.type === 'hidden') return false; return !(n.getAttribute('aria-label') || (n.id && document.querySelector(`label[for="${n.id}"]`)) || n.closest('label')); } return !(n.getAttribute('aria-label') || n.getAttribute('title') || n.textContent.trim()); }).map(n => `${n.tagName.toLowerCase()}.${(n.className.baseVal ?? n.className).toString().split(' ').slice(0, 3).join('.')}`);
  return { page: `rgb(${PAGE.map(Math.round).join(', ')})`, failing: out.length, items: out.sort(), overArtwork: skipped.length, gradients: grads, icons, unnamedControls: unnamed };
};
__sweep();
// ManhwaDetail light — measure against the LIGHTEST backdrop stop (worst case for dark ink):
// __sweep({ page: [166, 174, 192], stopAt: '.manhwa-detail-backdrop' })
// ManhwaDetail dark — the lightest (amber-tinted) stop is the worst case for pale ink:
// __sweep({ page: [26, 15, 0], stopAt: '.manhwa-detail-backdrop' })
```

**Reading the results**

- Text over cover artwork is reported separately (`overArtwork`) — a scrim over an `<img>`
  is invisible to a background-colour walk. Decorative `aria-hidden` images (the detail
  view's 9%-opacity aura) are excluded from that test.
- Disabled controls are exempt under WCAG 1.4.3 and are skipped.
- **Placeholders are not text nodes** and are not measured. Check them by hand; the house
  values are `placeholder:text-gray-400` (dark) and `placeholder:text-slate-600` (light).
- Glows painted as `background-image` behind text are still invisible to it — look.

**The sweep is only valid when the browser pane is visible** (see §6). Front the pane,
give it a real size, and let entrances finish (or settle inline opacity) before measuring.

---

## 8. Open work

The app builds, passes types and lint (frontend and backend), and every page measured
clean in both themes at phone, tablet and desktop sizes on 2026-09-25.

### Owner action required

- **Credential rotation.** Still the owner's to action, and now wider: one maintenance
  script carried the Sovereign account's credentials as literals. The working tree no
  longer does, but git history of this public repository still holds them. Rotate them.
  Details deliberately kept out of this file.
- **`MONGODB_URI` points at a remote host** (§2). Confirm what it is.
- **Backfill `normalizedTitle` in production.** The script only ever `$set`s the field and
  never deletes; verified on a throwaway local database (dry run writes nothing; real run
  updates; re-run is a no-op; collisions reported, not resolved). The canonical procedure —
  back up, dry-run `akashic_records` and `test_records`, review collisions, run, re-verify —
  is in `backend/scripts/README.md`. Only after that can the create handler's legacy
  fallback scan be retired.

### Known and deliberate

- **Decorative micro-text stays below AA.** The 4px `Defined_State://True` / `Root.Apostle`
  decals on `EntityAvatar`, and BootScreen's side telemetry (7px hex codes at 30%). Texture,
  not content.
- **At `lg` on short screens (e.g. 1024×768)** the hero card's top reticles sit ~10px into
  the transparent header band. They clear its content (logo left, controls right) and this
  is the unchanged desktop solve; revisit only if the header gains a centred element.

### Not verified live

- **SIMILAR_RECORDS** (ManhwaDetail) never rendered: no class in the test library had two
  titles. Its text is fixed pale ink on an always-dark scrim (checked by calculation).
- **Real screen readers.** Semantics were checked structurally (names, roles, focus order,
  dialogs); no VoiceOver/NVDA pass has been done.

### Deferred ideas (still optional — deliberately not built)

- Light-mode card mat behind cover art beyond the hero (the hero already has one), and
  page texture beyond the drafting grid + noise. Neither addresses a measured problem.

---

## 9. Conventions

- **Never push without asking.** The owner's standing rule is that this repo is not pushed
  until they say so in that moment. a356f56 was pushed with explicit approval; that approval
  does not carry forward.
- **One page at a time.** Finish and review a single page or component before starting the
  next, rather than batching changes across routes.
- Commit messages end with the co-author trailer used on a356f56.
