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
 *   accent-plate        read accent on a plate dark in both themes  amber-500 / violet-300
 *
 * And the NEUTRALS of the System frame kit (the `.hud` classes in styles/index.css), which
 * draws every button, chip and panel frame from custom properties:
 *
 *   hud-neutral-line    a frame's hairline at rest                 white 16% / violet-grey
 *   hud-glass           a control's plate at rest                  white 4% / white 62%
 *   hud-glass-hover     that plate under the pointer               white 9% / white 88%
 *   hud-danger          a destructive control's line and ink       red-400 / red-700
 *   hud-danger-soft     its plate under the pointer
 *   hud-on-plate-line   a hairline on a plate dark in both themes
 *   hud-deep-glass      the plate of a control floating over the atmosphere
 *   hud-ink-muted       the muted ink (mutedText), for kit states that recolour it
 *   hud-sheet-glass     the plate of a reading sheet (the series page's sections)
 *   hud-panel-solid     an opaque panel plate (panelBg), for menus
 */
export const accentVars = (theme: Theme): Record<string, string> => ({
    '--accent-color': theme.accentColor,
    '--accent-ink': theme.accentInk,
    '--accent-glow': `${theme.accentColor}88`,
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
    '--accent-plate': theme.accentPlateInk,
    '--hud-neutral-line': theme.isDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(96, 78, 140, 0.34)',
    '--hud-glass': theme.isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(255, 255, 255, 0.62)',
    '--hud-glass-hover': theme.isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(255, 255, 255, 0.88)',
    '--hud-danger': theme.isDark ? '#f87171' : '#b91c1c',
    '--hud-danger-soft': theme.isDark ? 'rgba(239, 68, 68, 0.14)' : 'rgba(220, 38, 38, 0.10)',
    '--hud-on-plate-line': 'rgba(255, 255, 255, 0.18)',
    '--hud-deep-glass': theme.isDark ? 'rgba(0, 0, 0, 0.72)' : 'rgba(255, 255, 255, 0.82)',
    '--hud-ink-muted': theme.isDark ? '#9ca3af' : '#655a80',
    '--hud-sheet-glass': theme.isDark ? 'rgba(0, 0, 0, 0.32)' : 'rgba(255, 255, 255, 0.72)',
    '--hud-panel-solid': theme.isDark ? '#0a0a0c' : '#fbf9ff',
});
