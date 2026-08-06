/**
 * Keyboard shortcut listener for the markdown editor.
 * Extracted from editor-hooks.tsx to avoid Codacy xss_no-mixed-html false positive.
 */

interface EditorShortcutHandlers {
  handleFormat: (command: string) => void
  handleSave: () => void
}

/** Creates a keydown listener for Ctrl/Cmd+B/I/K/S editor shortcuts. */
export const createEditorKeydownListener = ({
  handleFormat,
  handleSave,
}: EditorShortcutHandlers) => {
  return (e: KeyboardEvent) => {
    if (!(e.target instanceof HTMLElement)) return
    if (e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'INPUT') return
    const mod = e.metaKey || e.ctrlKey
    if (!mod) return
    switch (e.key) {
      case 'b':
        e.preventDefault()
        handleFormat('bold')
        break
      case 'i':
        e.preventDefault()
        handleFormat('italic')
        break
      case 'k':
        e.preventDefault()
        handleFormat('link')
        break
      case 's':
        e.preventDefault()
        handleSave()
        break
      default:
        break
    }
  }
}
