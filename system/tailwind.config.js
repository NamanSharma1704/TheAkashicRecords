import fs from 'node:fs';

/*
 * The theme objects in src/core/constants.ts hold Tailwind classes as data, and the app
 * composes them at runtime — sometimes behind a variant, as `hover:${theme.headingText}`.
 * The content scanner only ever sees literals, so those composed classes were never
 * emitted: the base `text-white` existed because some other file wrote it out, while
 * `hover:text-white` silently did not, and the hover state simply never applied.
 *
 * Hand-listing them was the old approach and it rotted — `text-[#06b6d4]` sat here long
 * after highlightText had moved on, and nothing reported it. So the list is derived from
 * constants.ts instead: every colour utility the themes actually contain, plus the
 * variants the codebase puts in front of them. Change a token and this follows.
 */
const constantsSrc = fs.readFileSync(
    new URL('../src/core/constants.ts', import.meta.url),
    'utf8',
);

const UTILITY = /^(?:text|bg|border|from|via|to|ring|fill|stroke|shadow)-/;

// Theme values are single-quoted, and a few hold several classes at once
// (`gradient: 'from-[#f59e0b] via-yellow-400 to-white'`), so split on whitespace.
const themeClasses = [
    ...new Set(
        [...constantsSrc.matchAll(/'([^']+)'/g)]
            .flatMap(m => m[1].split(/\s+/))
            .filter(c => UTILITY.test(c)),
    ),
];

// Only the variants the source actually composes — see the `<variant>:${` sites.
const VARIANTS = ['hover', 'focus', 'group-hover', 'focus-within', 'active'];

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "../src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            // The accent family, read from CSS custom properties that App sets on :root from
            // the active theme (src/core/tokens.ts). One literal class serves both themes, so
            // there is no per-theme class to forget. No opacity modifiers on these: each alpha
            // step is its own token (soft / soft-strong / wash / line / line-strong).
            colors: {
                accent: {
                    DEFAULT: 'var(--accent-color)',
                    ink: 'var(--accent-ink)',
                    solid: 'var(--accent-solid)',
                    icon: 'var(--accent-icon)',
                    soft: 'var(--accent-soft)',
                    'soft-strong': 'var(--accent-soft-strong)',
                    wash: 'var(--accent-wash)',
                    line: 'var(--accent-line)',
                    'line-strong': 'var(--accent-line-strong)',
                    surface: 'var(--accent-surface)',
                    edge: 'var(--accent-edge)',
                    on: 'var(--accent-on)',
                    plate: 'var(--accent-plate)',
                },
            },
        },
    },
    safelist: [
        ...themeClasses,
        ...VARIANTS.flatMap(v => themeClasses.map(c => `${v}:${c}`)),
        // Not theme tokens, so constants.ts never mentions them: the rank and error-state
        // colours. (These were once returned by getThemedRankStyle, since removed as dead.)
        'text-cyan-400', 'text-red-500', 'bg-slate-50', 'bg-black',
    ],
    plugins: [],
}
