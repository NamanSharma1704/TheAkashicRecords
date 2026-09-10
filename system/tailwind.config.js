/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "../src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {},
    },
    // Classes the theme objects assemble, which the content scanner cannot always follow.
    // Entries that existed only for the removed SYSTEM and BLOOD themes are gone
    // (bg-slate-950, border-cyan-900/50, border-red-900/30, from-cyan-400, to-blue-500,
    // from-red-500, to-rose-600). text-cyan-400 and text-red-500 stay: they are no longer
    // theme colours but are still returned by getThemedRankStyle and used for error states.
    safelist: [
        'bg-[#020202]', 'bg-slate-50', 'bg-black',
        'text-[#f59e0b]', 'text-[#06b6d4]', 'text-cyan-400', 'text-red-500',
        'border-[#f59e0b]', 'border-[#06b6d4]',
        'from-[#f59e0b]', 'via-yellow-400', 'from-[#06b6d4]', 'to-cyan-500'
    ],
    plugins: [],
}
