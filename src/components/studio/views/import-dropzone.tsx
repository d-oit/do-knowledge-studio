'use client'

import { memo, useRef } from 'react'
import { Upload } from 'lucide-react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'
import { translate } from '@/lib/i18n/messages/import'

interface ImportDropzoneProps {
  handleImportClick: () => void
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
}

/** Picker accept list: JSON exports, Markdown, and zip vaults. The folder picker carries no accept filter (directory picks ignore it) so selectors stay unambiguous. */
const PICKER_ACCEPT = '.json,application/json,.md,.markdown,text/markdown,.zip,application/zip'

/** Dropzone for importing a JSON/Markdown export or a vault to replace the current library. */
export const ImportDropzone = memo(function ImportDropzone({
  handleImportClick,
  handleFileChange,
  fileInputRef,
}: ImportDropzoneProps) {
  const reducedMotion = useReducedMotion()
  /** Folder picker input; `webkitdirectory` is set imperatively (absent from React types). */
  const folderInputRef = useRef<HTMLInputElement | null>(null)
  /** Attaches the folder input and enables directory picking on it. */
  const attachFolderInput = (input: HTMLInputElement | null) => {
    folderInputRef.current = input
    if (input) input.setAttribute('webkitdirectory', '')
  }

  return (
    <motion.section
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { delay: 0.1 }}
      className="mb-8"
    >
      <div className="mb-4">
        <h2 className="font-serif text-lg font-semibold text-ink">{translate('import.dropzone.title')}</h2>
        <p className="mt-1 text-body-sm text-ink-mute">
          {translate('import.dropzone.subtitle')}
        </p>
      </div>

      <div
        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card/50 py-10 text-center transition-colors hover:border-saffron/40"
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-saffron-soft">
          <Upload className="h-5 w-5 text-saffron" />
        </div>
        <h3 className="font-serif text-body-lg font-semibold text-ink">{translate('import.dropzone.chooseHeading')}</h3>
        <p className="mt-1 text-label-lg text-ink-mute">
          {translate('import.dropzone.acceptsHint')}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={handleImportClick}
            className="rounded-md bg-primary px-4 py-2 text-label-lg font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
          >
            {translate('import.dropzone.chooseButton')}
          </button>
          <button
            onClick={() => { folderInputRef.current?.click() }}
            className="rounded-md border border-border px-4 py-2 text-label-lg font-medium text-ink-soft transition-colors hover:bg-muted focus-ring"
          >
            {translate('import.dropzone.chooseFolderButton')}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={PICKER_ACCEPT}
          multiple
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
        <input
          ref={attachFolderInput}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    </motion.section>
  )
})
