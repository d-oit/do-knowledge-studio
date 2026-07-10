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
import { toast } from 'sonner'

function ToolbarButton({ icon: Icon, label }: { icon: typeof Bold; label: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={() => { toast.info(`${label} — would apply formatting`) }}
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
}: {
  showAdvanced: boolean
  onToggleAdvanced: () => void
}) {
  return (
    <div className="sticky top-0 z-10 -mx-6 mb-3 border-y border-border bg-background/90 px-6 py-2 backdrop-blur-sm lg:-mx-10 lg:px-10">
      <div className="flex flex-wrap items-center gap-0.5">
        <ToolbarButton icon={Bold} label="Bold" />
        <ToolbarButton icon={Italic} label="Italic" />
        <Divider />
        <ToolbarButton icon={Heading1} label="Heading 1" />
        <ToolbarButton icon={Heading2} label="Heading 2" />
        <Divider />
        <ToolbarButton icon={List} label="Bullet list" />
        <ToolbarButton icon={ListOrdered} label="Numbered list" />
        <ToolbarButton icon={QuoteIcon} label="Quote" />
        <ToolbarButton icon={Code} label="Code" />
        <Divider />
        <ToolbarButton icon={Link2} label="Insert link" />
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => { toast.info('AI extraction would scan the body for entities.') }}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-saffron-deep transition-colors hover:bg-saffron-soft focus-ring"
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
