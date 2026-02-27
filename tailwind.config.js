/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./system/index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {},
    },
    safelist: [
        'bg-[#020202]', 'bg-slate-50', 'bg-slate-950', 'bg-black',
        'text-[#f59e0b]', 'text-[#06b6d4]', 'text-cyan-400', 'text-red-500',
        'border-[#f59e0b]', 'border-[#06b6d4]', 'border-cyan-900/50', 'border-red-900/30',
        'from-[#f59e0b]', 'via-yellow-400', 'from-[#06b6d4]', 'to-cyan-500',
        'from-cyan-400', 'to-blue-500', 'from-red-500', 'to-rose-600'
    ],
    plugins: [],
}
