import { X } from 'lucide-react'

export const CLOSE_PANEL_LABEL = 'Close panel'

export const PanelCloseButton = ({ onClose }: { onClose: () => void }) => (
  <button
    onClick={onClose}
    className="flex min-h-[44px] min-w-[44px] items-center justify-center text-ink-faint transition-colors hover:text-ink focus-ring"
    aria-label={CLOSE_PANEL_LABEL}
  >
    <X className="h-4 w-4" />
  </button>
)
