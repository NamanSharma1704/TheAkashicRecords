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
        extend: {},
    },
    safelist: [
        ...themeClasses,
        ...VARIANTS.flatMap(v => themeClasses.map(c => `${v}:${c}`)),
        // Not theme tokens: returned by getThemedRankStyle and used for error states,
        // so constants.ts never mentions them.
        'text-cyan-400', 'text-red-500', 'bg-slate-50', 'bg-black',
    ],
    plugins: [],
}
