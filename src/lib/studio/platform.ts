export const IS_MAC =
  typeof navigator !== 'undefined' && /mac/i.test(navigator.platform)

export const COMMAND_PALETTE_SHORTCUT_LABEL = IS_MAC ? '⌘K' : 'Ctrl+K'
