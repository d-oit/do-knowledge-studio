'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Camera, X, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

export function QRDisplay({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(roomId)
    setCopied(true)
    setTimeout(() => { setCopied(false) }, 2000)
  }, [roomId])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-lg border border-border bg-white p-4">
        <QRCodeSVG
          value={roomId}
          size={180}
          level="M"
          includeMargin={false}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[13px] text-ink">{roomId}</span>
        <button
          onClick={handleCopy}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-border hover:text-ink focus-ring"
          aria-label="Copy room ID"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <p className="text-center text-caption text-ink-faint">
        Scan this QR code with another device to pair
      </p>
    </div>
  )
}

export function QRScanner({ onScan }: { onScan: (roomId: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const onScanRef = useRef(onScan)

  useEffect(() => {
    onScanRef.current = onScan
  }, [onScan])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
    setIsActive(false)
  }, [])

  const startCamera = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsActive(true)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Camera access denied'
      setError(msg)
      toast.error(`Camera error: ${msg}`)
    }
  }, [])

  useEffect(() => {
    return () => { stopCamera() }
  }, [stopCamera])

  useEffect(() => {
    if (!isActive) return
    let animFrame = 0
    let detecting = false

    const detect = () => {
      if (!videoRef.current || !canvasRef.current || detecting) return
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      ctx.drawImage(video, 0, 0)

      const BD = (window as unknown as Record<string, unknown>)['BarcodeDetector'] as
        | (new (opts: { formats: string[] }) => {
            detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>
          })
        | undefined

      if (BD) {
        detecting = true
        const detector = new BD({ formats: ['qr_code'] })
        detector.detect(canvas).then((barcodes) => {
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            stopCamera()
            onScanRef.current(barcodes[0].rawValue)
            return
          }
          animFrame = requestAnimationFrame(detect)
        }).catch(() => {
          animFrame = requestAnimationFrame(detect)
        }).finally(() => { detecting = false })
      } else {
        animFrame = requestAnimationFrame(detect)
      }
    }

    animFrame = requestAnimationFrame(detect)
    return () => { cancelAnimationFrame(animFrame) }
  }, [isActive, stopCamera])

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Video container always mounted so videoRef is available for startCamera */}
      <div className={`relative overflow-hidden rounded-lg border border-border ${isActive ? '' : 'hidden'}`}>
        <video
          ref={videoRef}
          className="h-48 w-48 object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />
        <button
          onClick={stopCamera}
          className="absolute right-1 top-1 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70 focus-ring"
          aria-label="Stop camera"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {/* Scan button — only shown when not active */}
      {!isActive && (
        <button
          onClick={() => { void startCamera() }}
          className="flex h-48 w-48 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 transition-colors hover:border-saffron/40 hover:bg-muted/50"
        >
          <Camera className="h-8 w-8 text-ink-faint" />
          <span className="text-[12px] text-ink-faint">Tap to scan QR code</span>
        </button>
      )}
      {error && (
        <p className="text-center text-[12px] text-red-500">{error}</p>
      )}
      {!isActive && (
        <p className="text-center text-caption text-ink-faint">
          Point camera at QR code from another device
        </p>
      )}
    </div>
  )
}
