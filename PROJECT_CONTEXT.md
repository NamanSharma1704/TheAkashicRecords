# Akashic Records — Project Context

Working notes for picking this codebase up cold. The `README.md` covers what the app *is*
in the project's own voice; this file covers how it is built, what was recently changed,
and what is still open.

Last updated: 2026-09-25 — the pass on top of **a356f56** described in §5a. Not pushed; the
owner's push rule (§9) applies.

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

**Guest login requires the API.** With the backend down, the login screen returns
`SYS_ERR: GUEST_LINK_SEVERED` and the app never mounts — so a UI review needs the API up
even though the UI itself is static.

**Verification commands**

```bash
cd system && npx tsc --noEmit        # types
npx eslint ../src                    # lint (run from system/)
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
    main.tsx          # mounts App inside <MotionConfig reducedMotion="user">
  components/
    dais/             # Three.js holographic platform under the hero card
    fx/               # background field: nebula, star field, ripples, noise
    quest/            # Card3D, QuestCard, ManhwaDetail (+ its own .css)
    system/           # SystemFrame, BootScreen, LoginScreen, modals, notifications
    tower/            # DivineSpire + TowerStructure (Three.js) + TowerHUD
    profile/          # HunterProfile
  lib/dais/geometry.ts  # traced dais geometry, no `three` import
  utils/ranks.ts        # QUEST_RANKS, USER_RANKS, rank helpers
  utils/useDialog.ts    # keyboard contract for every modal surface — see §6
  styles/index.css      # global CSS + the utilities Tailwind can't express

backend/    # Express app, Mongoose models, maintenance scripts (scripts/README.md)
api/        # Vercel serverless entry
system/     # Vite root: index.html, vite.config, tailwind.config
```

---

## 4. The design system

This is the part most likely to be violated by accident. Read it before touching colour.

### 4.1 Three inks, not one accent

Defined in `core/types.ts`, valued in `core/constants.ts`:

| Token | Purpose | Light | Dark |
| :--- | :--- | :--- | :--- |
| `accentColor` | **Decorative only** — fills, glows, gradients, artwork | `#06b6d4` | `#f59e0b` |
| `accentInk` | **Structural** — text, icons, thin lines; anything read | `#155e75` | `#f59e0b` |
| `warningInk` | Warnings and countdowns; stays amber when the theme is cyan | `#92400e` | `#f59e0b` |
| `gradient` | **Decorative** gradient — progress fills, washes | cyan ramp | amber → white |
| `gradientInk` | **Read** gradient — any `bg-clip-text` display type | `#155e75 → cyan-900 → cyan-950` | amber → white (same) |

The rule when adding UI: **ask whether a colour is *read* or merely *seen*.** Read →
`accentInk`. Seen → `accentColor`. Warning → `warningInk`. On dark all three collapse to
the same amber, so mistakes only show up in light mode. Gradient text is read: it takes
`gradientInk`, never `gradient`.

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

`SystemFrame` takes a `level` prop and applies `elevation` itself.

### 4.3 The light field

`components/fx/GalaxyNebula.tsx` is `fixed inset-0` and therefore **is** the page
background — it covers the `appBg` token entirely. Light renders `#edf1f7 → #e9eef5 →
#e2eaf3` plus a 32px/160px slate drafting grid, over which white panels rise on a real
shadow like paper. Changing `appBg` alone does nothing visible.

The background field (`OmniscientField`, `GoldenRipples`, `SanctuaryRing`) is *inverted*
for light — slate nodes and contour linework rather than glowing points — for the same
headroom reason.

### 4.4 Deliberate exception: ManhwaDetail

`components/quest/ManhwaDetail.css` gives the detail view its own `[data-theme]` variants:
light is a **cinematic mid-slate backdrop** (`#98a2b5 → #949db0`) with pale stars, not the
drafting table. This is authored, not drift, and the owner explicitly chose to keep it as
its own moment. Do not "fix" it into the drafting table.

The backdrop is untouched, but a mid-slate is a mid-tone: bare, it runs L≈0.15–0.40, where
neither the ink nor white clears AA. So on light, **text on this view never sits on the
bare backdrop**: panels are 60%-white "paper" plates (`LIGHT_PLATE`), accents read in
cyan-900 (`LIGHT_INK`, the deep end of the ink family — the house `#155e75` measured just
under 4.5 on the plate), headers that sit outside a panel get the same plate, the top bar
carries its own shade (both themes — content scrolls under it), and the spine, which sits
in the vignette, takes pale ink. Surfaces that are dark in both themes (character cards,
similar-record posters) take pinned-light ink.

---

## 5. What changed in a356f56

One commit, two bodies of work, because both touch `core/App.tsx`.

### Holographic dais and hero card (new)

- `lib/dais/geometry.ts` — dais geometry traced off a reference image, with the projection
  it was measured through recorded so the numbers stay auditable.
- `components/dais/` — a lazily-loaded Three.js scene. **The renderer creates its own
  canvas**: a canvas whose WebGL context has been force-lost can never hand out another, so
  a React-owned canvas breaks on theme toggle.
- `components/quest/Card3D.tsx` — pointer-tracked tilt on the hero card, driven entirely by
  refs and direct style writes so the memoised subtree never re-renders on pointer move.
- Collapsible sidebar; content recentres when collapsed.

### Light theme rework

The diagnosis: light mode was dark mode brightened. Every technique that carries meaning on
near-black had no headroom — glows resolved to nothing, panels had nothing to separate
from, and the accent failed contrast wherever it carried text. Fixed by deepening the page,
splitting the accent into the three inks above, and adding the depth system.

### Contrast pass

Every page and component was swept in both themes and brought to WCAG AA. Pages covered:
dashboard, HunterProfile, DivineSpire/TowerHUD/TowerStructure, ManhwaDetail, LoginScreen,
SystemGateModal, QuestCard, SystemNotification, BootScreen.

The recurring causes, most frequent first — **check new UI against this list**:

1. **White on an accent fill.** Both accents are mid-luminance brights, so white lands near
   2.2–2.4:1. Five separate places. The fix is near-black on the fill (7.3:1 on cyan,
   8.3:1 on amber), never a paler fill — the fill is carrying a primary action's weight.
2. **A dark-tuned palette on a light surface.** Tailwind `-400` rungs measure ~2.3:1 on
   white. Class colours, rank colours, reds and ambers all had this. Where the identity
   matters, add a light variant (`CLASS_COLORS_LIGHT`, `Rank.colorLight`) rather than
   flattening everything to one colour.
3. **`opacity-*` hiding content.** A muted colour needs roughly 0.9 alpha to clear AA, so a
   fade cannot both pass contrast and still read as a fade. Tiers belong in *colour*. The
   rank ladder now separates current/reached/unreached by colour at full opacity.
4. **Surface pinned, text themed** (or the reverse). A panel hardcoded to `bg-black/40`
   while its text uses `theme.mutedText` looks right on dark and lands text on its own
   background in light. Either make the surface follow the theme, or keep the panel
   deliberately dark and give it fixed light text — never leave them disagreeing.
5. **Classes assembled at runtime** — see §6.

---

## 5a. What changed after a356f56 (2026-09-25)

**Graphics.** `HoloDais` ran two render loops once live — the build effect's and the
visibility effect's — so it drew twice a frame, spun at double speed, and `paused` only
stopped one of them. The visibility effect now owns the loop (measured: 1.0 renders/frame
idle, 0 with any overlay open). A resize repaints once, so a stopped dais never goes
blank. `OmniscientField`/`GoldenRipples` stop their rAF when paused instead of spinning a
no-op frame, no longer rebuild (re-scattering the field) on every pause toggle, and render
still under reduced motion; the field canvas is DPR-aware (capped 1.5). Six theme toggles
leave exactly one dais canvas.

**Reduced motion** is now app-wide: `MotionConfig reducedMotion="user"` (main.tsx), a CSS
rule for the named ambient utilities (styles/index.css), `motion-safe:` on the arbitrary
spins. Spinners (`animate-spin`) and opacity pulses stay.

**Hero below lg (was §8 "Not done").** Height-driven sizing was chosen over hiding the
dais — the platform is the hero. `.hero-stage` (styles/index.css) sizes the card from the
height available and derives the dais placement and spacing from the card width with the
scene's own projection (1 world unit = platform width / 2.48). Measured, card base to the
body's back rim: phones −25px → +23/24px; portrait tablets touching → +29/31px (the ring
also no longer runs under the title); desktop unchanged (27–54px). On a 375×667 phone the
whole hero, controls included, now fits the first screen.

**Design system.** New `gradientInk` token (§4.1). The App-root edge falloff was neutral
black at 20% in both themes, greying every light-mode edge; light now uses the cool falloff
HunterProfile already had. ManhwaDetail light: §4.4. QuestCard light scrim holds under the
whole text block; `Rank.colorLight` moved to the -800 rung; `RankSigil` has a light palette.
TowerHUD's phone dock now actually paints its surface (see traps).

**Accessibility.** Every overlay goes through `useDialog` (§6). Icon-only controls are
named. New keyboard paths: the hero card (Enter = the double-click editor), the quest list,
the Spire's sector index (appears on focus, like a skip link — the isles are canvas-only),
QuestCards (focus reveals what hover reveals), profile cards, CSV import. BootScreen can be
skipped (Escape/Enter/Space or `SKIP [ESC]`) and exposes a `progressbar`. Pulses moved off
text onto dots. Phones/tablets get a create button (creation was desktop-only).

**Backend.** `/api/boot/initial-data`, `/api/user/state` and the chapter PUT created the
per-tenant settings/daily documents with find-then-create; concurrent first requests
(StrictMode's double effect, two tabs) hit E11000 → 500 → the client showed an empty
library. Now atomic upserts; daily ids use `$addToSet`. The client no longer wipes a loaded
library when a refresh fails.

**Scripts.** See `backend/scripts/README.md`: nine unreferenced/broken one-offs and the
destructive `reset_sandbox` pruned, `sync_metadata` repaired, one remaining committed
credential literal routed through `scriptEnv`, `db_diag` no longer prints the URI,
backfill gained `--dry-run` and a documented production procedure.

---

## 6. Invariants and traps

**Tailwind only sees literals.** A class built at runtime — `hover:${theme.headingText}`,
`bg-${theme.primary}-500` — is never emitted. The base class often exists because some other
file writes it out, while the *variant* does not, so it fails silently and only in one
state. `system/tailwind.config.js` now **derives its safelist from `constants.ts`**: every
colour utility the themes contain, crossed with `hover/focus/group-hover/focus-within/active`.
Change a token and the safelist follows. Classes built from a *variable* rather than a theme
token still need literal conditionals at the call site.

**A bare `var()` in an arbitrary shadow is read as a colour.** `shadow-[var(--x)]` compiles
to `--tw-shadow-color: var(--x)` and the element computes `box-shadow: none`. Shadows driven
by a custom property must be plain CSS.

**Two background utilities on one element.** Only one wins, and it is decided by CSS source
order rather than the order written in the class string. Check for a themed token sitting
next to a hardcoded one.

**A border-colour class with no border width renders nothing.** `h-[1px] ${theme.borderSubtle}`
draws an invisible strip; it needs a background.

**Contrast must be checked against the darkest stop of the page gradient**, not the token.

**`SystemFrame`'s `className` lands on the outer wrapper**, behind the solid inner panel.
A fill passed there never paints — use `surfaceClass`. (StatBox learnt this; the Spire's
phone dock still had it, leaving pale-on-glass inks on the theme's white panel at 1.5:1.)

**A text-colour class on an empty element renders nothing** — the border-without-width
trap's sibling. `w-1 h-1 rounded-full ${theme.highlightText}` is invisible; fill it.

**Never pulse a text's opacity.** `animate-pulse` on a word takes it under AA at every
trough. Pulse a dot beside it.

**Percent heights on the hero stage below lg.** The flex row is sized from the stage's
margin box and then treated as definite, so `h-full` folds the stage's margins back into
the card and breaks its aspect ratio. `.hero-stage` sets `height: auto` below lg.

**Modal surfaces use `useDialog`.** It stacks (only the topmost dialog answers Escape/Tab),
moves focus in and back, and reads `onClose` through a ref. Depending on an inline
`onClose` re-ran the old ManhwaDetail effect on every App render — the guest countdown
ticks every 10s — and pulled keyboard focus back to the panel shell each time.

---

## 7. Verifying contrast

Colour work here is measured, not eyeballed. The sweep below walks every text node,
composites the real background, folds in the opacity chain, and reports anything under AA.

```js
// paste in the browser console; returns { page, failing, items }
(function(){
  const parse=s=>{const m=(s||'').match(/[\d.]+/g);return m?m.slice(0,4).map(Number):null};
  let PAGE=null;
  for(const el of document.querySelectorAll('body,div,main')){
    const r=el.getBoundingClientRect();
    if(r.width<innerWidth*0.9||r.height<innerHeight*0.8) continue;
    const p=parse(getComputedStyle(el).backgroundColor);
    if(p&&(p.length<4||p[3]>=0.99)) PAGE=p.slice(0,3);      // LAST match: overlays paint over body
  }
  if(!PAGE) PAGE=[255,255,255];
  const lin=c=>{c/=255;return c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4)};
  const L=p=>0.2126*lin(p[0])+0.7152*lin(p[1])+0.0722*lin(p[2]);
  const ratio=(a,b)=>{const x=L(a),y=L(b),hi=Math.max(x,y),lo=Math.min(x,y);return +((hi+0.05)/(lo+0.05)).toFixed(2)};
  const over=(f,a,b)=>[0,1,2].map(i=>f[i]*a+b[i]*(1-a));
  const bgOf=el=>{let n=el,st=[];while(n&&n!==document.documentElement){const p=parse(getComputedStyle(n).backgroundColor);if(p){const a=p.length>3?p[3]:1;if(a>0)st.push([p,a]);if(a>=0.999)break;}n=n.parentElement;}let b=PAGE;for(let i=st.length-1;i>=0;i--)b=over(st[i][0],st[i][1],b);return b;};
  const opChain=el=>{let o=1,n=el;while(n&&n!==document.documentElement){const v=parseFloat(getComputedStyle(n).opacity);if(!isNaN(v))o*=v;n=n.parentElement;}return o;};
  const arts=[...document.querySelectorAll('img')].map(i=>i.getBoundingClientRect()).filter(r=>r.width>2&&r.height>2);
  const onArt=r=>arts.some(a=>!(a.right<=r.left||a.left>=r.right||a.bottom<=r.top||a.top>=r.bottom));
  const out=[],skipped=[];
  for(const el of document.querySelectorAll('*')){
    const t=[...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent.trim()).join('').trim(); if(!t) continue;
    const s=getComputedStyle(el); if(s.visibility==='hidden'||s.display==='none') continue;
    const op=opChain(el); if(op<0.08) continue;
    const r=el.getBoundingClientRect(); if(r.width<4||r.height<4||r.top>innerHeight||r.bottom<0) continue;
    if(s.webkitTextFillColor==='rgba(0, 0, 0, 0)') continue;          // gradient text — see §8
    const fg=parse(s.color); if(!fg||(fg.length>3&&fg[3]===0)) continue;
    const b=el.closest('button'); if(b&&b.disabled) continue;          // WCAG exempts disabled
    const bg=bgOf(el), alpha=(fg.length>3?fg[3]:1)*op;
    const eff=alpha<1?over(fg.slice(0,3),alpha,bg):fg.slice(0,3);
    const px=parseFloat(s.fontSize), bold=parseInt(s.fontWeight)>=700;
    const need=(px>=24||(px>=18.66&&bold))?3:4.5, c=ratio(eff,bg);
    if(c<need) (onArt(r)?skipped:out).push(`${c} (need ${need}) ${px}px op${op.toFixed(2)} "${t.slice(0,26)}"`);
  }
  return {page:`rgb(${PAGE.join(', ')})`, failing:out.length, items:out.sort(), overArtwork:skipped.length};
})()
```

**Reading the results**

- Text over cover artwork is reported separately (`overArtwork`) — a scrim over an `<img>`
  is invisible to a background-colour walk, so those numbers are meaningless, not failures.
- Disabled controls are exempt under WCAG 1.4.3 and are skipped.
- Icons are graphics: WCAG 1.4.11 wants **3:1**, which the text sweep does not check. Check
  meaningful icons by hand.

**The sweep only sees background COLOURS.** It composites `background-color` up the tree,
so text over a `background-image` (ManhwaDetail's backdrop, BootScreen), a canvas or cover
art is measured against whatever solid colour happens to sit underneath. ManhwaDetail light
reported 0 failures this way while ~25 items were at 1.0–3.9:1 against the slate actually
on screen. For any surface like that, use the pixel method:

1. Mark every text element (visible, not covered by a layer that paints), record its
   colour (SVG text: `fill`; gradient text: every stop), font size/weight, and the box of
   its own text — the union of the text nodes' line boxes (`Range.getClientRects`), not
   the element box, which for a block-level line runs across the whole column — clipped to
   every overflow-clipping ancestor.
2. Inject `[mark]{color/-webkit-text-fill-color/fill:transparent; text-shadow:none}` and
   drop `background-image` on gradient-text elements only — the glyphs vanish, every
   backdrop stays.
3. Screenshot; for each text box take the 5th and 95th luminance percentile of the
   pixels; score the text colour (alpha and opacity chain composited) against both; the
   worse one is the result.

It was run with Playwright over desktop, tablet and phone in both themes, with a paused
clock (`page.clock.pauseAt`) to freeze BootScreen at 15/60/100%. The harness is not in
the repo (Playwright is not a dependency). One reading is a known artefact: `RankSigil`'s
letter (its box contains the sigil's own coloured hex outline). The sigil is `aria-hidden`
and its rank is always stated in text beside it or in the card's accessible name.

**The sweep is only valid when the browser pane is visible.** A hidden pane reports
`innerWidth === 0`, which makes the size filter match every element, and it freezes CSS
transitions so light-mode text gets measured against a stale dark background. Front the
pane, give it a real size, and inject `*{transition:none !important}` before measuring.

---

## 8. Open work

Nothing here is blocking; the app builds, passes lint and types, and is deploy-ready.

### Known and deliberate

- **Decorative micro-text stays below AA.** The 4–5px `LVL_99` / `Defined_State://True` /
  `Root.Apostle` decals on `EntityAvatar`, and BootScreen's side telemetry (7px hex codes and timestamps at
  30% opacity, now also `aria-hidden`). These are texture, not content.
- **Small text laid straight on the animated field** (the quest list's 9px status, the 7px
  `LINK_STABILITY` label) reads 4.4–4.5:1 at the pixel sweep's worst percentile when a
  particle, link line or drafting-grid rule passes behind a glyph. Against the page itself
  they measure 6+; with the field canvases hidden the dashboard sweeps clean. Transient
  texture, not a colour choice — but it is why nothing new should sit on the bare field
  below ~10px.
- **The projection cone's box is wider than a phone** (170% of the card). Its edges are
  transparent by construction and `main` is `overflow-x-hidden`, so nothing scrolls; it only
  shows up as `scrollWidth > clientWidth` in a DOM check.

### Verified in the 2026-09-25 pass (no longer open)

- Gradient text: all eight sites, both themes, by stop analysis and by pixel sweep.
- BootScreen dark (and light): captured visually at three frozen points of the sequence.
- Mobile hero/dais overlap: fixed (§5a).

### Not verifiable here

- Only Chromium was available. Safari (notably `env(safe-area-inset-*)`, `backdrop-filter`
  and `overflow-x: hidden` on iOS) and Firefox were not run.
- WebGL ran on SwiftShader; real-GPU frame timing was not measured. Loop counts and
  lifecycle (renders per frame, pause, dispose) were.
- Screen readers: roles, names and focus order were checked with axe-core and keyboard
  traversal, not with VoiceOver/NVDA.

### Owner action

- `backend/scripts/backfill_normalized_titles.js` has never been run against production.
  It now has `--dry-run`; the procedure is in `backend/scripts/README.md`. Needs production
  credentials.
- Credential rotation was flagged in an earlier session and is the owner's to action. This
  pass found one more maintenance script still carrying a committed credential literal and
  moved it to `backend/.env` like the rest; the committed value remains in public history,
  so it belongs in the same rotation. Details stay out of this file.

### Optional, not taken up

- Light-mode ideas proposed earlier: a card mat behind cover art elsewhere, and page texture
  beyond the drafting grid. Still ideas, not gaps.

---

## 9. Conventions

- **Never push without asking.** The owner's standing rule is that this repo is not pushed
  until they say so in that moment. a356f56 was pushed with explicit approval; that approval
  does not carry forward.
- **One page at a time.** Finish and review a single page or component before starting the
  next, rather than batching changes across routes.
- **New modal surfaces** get `role="dialog"`, `aria-modal`, a label, and `useDialog`.
- **New gradient text** takes `theme.gradientInk` and gets measured with the pixel method.
- Commit messages end with the co-author trailer used on a356f56.
