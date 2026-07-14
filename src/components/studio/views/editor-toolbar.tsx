import {
  Bold,
  Italic,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Quote as QuoteIcon,
  Code,
  Link2,
} from 'lucide-react'

function ToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Bold
  label: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="rounded p-1.5 text-ink-mute transition-colors hover:bg-muted hover:text-ink focus-ring"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

function Divider() {
  return <span className="mx-1 h-4 w-px bg-border" />
}

export function EditorToolbar({
  showAdvanced,
  onToggleAdvanced,
  onFormat,
}: {
  showAdvanced: boolean
  onToggleAdvanced: () => void
  onFormat?: (command: string) => void
}) {
  const handleFormat = (command: string) => {
    onFormat?.(command)
  }
  return (
    <div className="sticky top-0 z-10 -mx-6 mb-3 border-y border-border bg-background/90 px-6 py-2 backdrop-blur-sm lg:-mx-10 lg:px-10">
      <div className="flex flex-wrap items-center gap-0.5">
        <ToolbarButton icon={Bold} label="Bold" onClick={() => { handleFormat('bold') }} />
        <ToolbarButton icon={Italic} label="Italic" onClick={() => { handleFormat('italic') }} />
        <Divider />
        <ToolbarButton icon={Heading1} label="Heading 1" onClick={() => { handleFormat('h1') }} />
        <ToolbarButton icon={Heading2} label="Heading 2" onClick={() => { handleFormat('h2') }} />
        <Divider />
        <ToolbarButton icon={List} label="Bullet list" onClick={() => { handleFormat('bullet') }} />
        <ToolbarButton icon={ListOrdered} label="Numbered list" onClick={() => { handleFormat('ordered') }} />
        <ToolbarButton icon={QuoteIcon} label="Quote" onClick={() => { handleFormat('quote') }} />
        <ToolbarButton icon={Code} label="Code" onClick={() => { handleFormat('code') }} />
        <Divider />
        <ToolbarButton icon={Link2} label="Insert link" onClick={() => { handleFormat('link') }} />
        <div className="flex-1" />
        <button
          type="button"
          disabled
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-ink-faint cursor-not-allowed"
        >
          <span className="h-3 w-3">✦</span>
          AI Extract
        </button>
        <button
          type="button"
          onClick={onToggleAdvanced}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors hover:bg-muted focus-ring ${
            showAdvanced ? 'text-ink' : 'text-ink-mute'
          }`}
        >
          Advanced
          <span className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}>
            ▾
          </span>
        </button>
      </div>
    </div>
  )
}
