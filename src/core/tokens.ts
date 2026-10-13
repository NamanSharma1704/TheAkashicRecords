import { Theme } from './types';

/**
 * The theme's accent family as CSS custom properties, set on :root by App.
 *
 * These are what the `accent-*` Tailwind utilities read (system/tailwind.config.js), so the
 * same literal class is right in both themes and a component never has to name both. The
 * values reproduce what the call sites used to write per theme, exactly:
 *
 *   accent              decorative accent (fills, glows)          theme.accentColor
 *   accent-ink          read accent (text, thin lines)             theme.accentInk
 *   accent-solid        solid marks (dots)                         amber-500 / violet-500
 *   accent-icon         icon glyphs                                amber-500 / violet-600
 *   accent-soft         10% fill                                   accentFillRGB at 0.10
 *   accent-soft-strong  20% fill (hover, selected)
 *   accent-wash         30% fill (gradient washes)
 *   accent-line         40% line (hover borders)
 *   accent-line-strong  80% line (focus borders)
 *   accent-surface      opaque accent-tinted surface
 *   accent-edge         the edge drawn on that surface
 *   accent-on           ink on a solid accent fill
 */
export const accentVars = (theme: Theme): Record<string, string> => ({
    '--accent-color': theme.accentColor,
    '--accent-ink': theme.accentInk,
    '--accent-glow': `${theme.accentColor}88`,
    '--accent-faint': `${theme.accentColor}22`,
    '--accent-solid': theme.accentSolid,
    '--accent-icon': theme.accentIcon,
    '--accent-soft': `rgba(${theme.accentFillRGB}, 0.10)`,
    '--accent-soft-strong': `rgba(${theme.accentFillRGB}, 0.20)`,
    '--accent-wash': `rgba(${theme.accentFillRGB}, 0.30)`,
    '--accent-line': `rgba(${theme.accentFillRGB}, 0.40)`,
    '--accent-line-strong': `rgba(${theme.accentFillRGB}, 0.80)`,
    '--accent-surface': theme.accentSurface,
    '--accent-edge': theme.accentEdge,
    '--accent-on': theme.accentOn,
});
