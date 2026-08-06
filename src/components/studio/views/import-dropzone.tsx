'use client'

import { memo } from 'react'
import { Upload } from 'lucide-react'
import { motion } from 'framer-motion'
import { useReducedMotion } from '@/lib/studio/use-reduced-motion'

interface ImportDropzoneProps {
  handleImportClick: () => void
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>
}

/** Dropzone for importing a JSON export file to replace the current library. */
export const ImportDropzone = memo(function ImportDropzone({
  handleImportClick,
  handleFileChange,
  fileInputRef,
}: ImportDropzoneProps) {
  const reducedMotion = useReducedMotion()

  return (
    <motion.section
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0 } : { delay: 0.1 }}
      className="mb-8"
    >
      <div className="mb-4">
        <h2 className="font-serif text-lg font-semibold text-ink">Import knowledge</h2>
        <p className="mt-1 text-[13px] text-ink-mute">
          Replace your current library with the contents of a JSON export. This action cannot be undone.
        </p>
      </div>

      <div
        className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-card/50 py-10 text-center transition-colors hover:border-saffron/40"
      >
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-saffron-soft">
          <Upload className="h-5 w-5 text-saffron" />
        </div>
        <h3 className="font-serif text-[15px] font-semibold text-ink">Choose a JSON file</h3>
        <p className="mt-1 text-[12px] text-ink-mute">
          Accepts exports from this view ({'{ entities: [], claims: [] }'})
        </p>
        <button
          onClick={handleImportClick}
          className="mt-3 rounded-md bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 press-scale focus-ring"
        >
          Choose file
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
    </motion.section>
  )
})
