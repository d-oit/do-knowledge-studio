/**
 * Browser-chrome colours for the `theme-color` meta tag.
 *
 * The meta tag needs a concrete colour in two places that cannot read a CSS
 * variable: the server-rendered viewport export (before the stylesheet loads)
 * and the client-side sync that keeps the tag matching the *resolved* theme.
 * These constants are that single source; the token each one mirrors is named
 * beside it so a palette change in `globals.css` has an obvious other end.
 */
export const THEME_COLOR_DARK = '#14110d' as const
// globals.css `.dark` → `--background`
export const THEME_COLOR_LIGHT = '#9a5c2a' as const
// globals.css `:root` → `--saffron` (the accent the light chrome uses)
