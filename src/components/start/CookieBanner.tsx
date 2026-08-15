import { Cookie } from 'lucide-react'
import { useLibrary } from '../../store/useLibrary'

/**
 * No cookies are set and nothing is sent anywhere — but people expect to be
 * told what a site stores, so say it plainly.
 */
export function CookieBanner() {
  const ack = useLibrary((s) => s.cookiesAck)
  const ackCookies = useLibrary((s) => s.ackCookies)
  if (ack) return null

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3">
      <div className="flex max-w-3xl flex-col gap-3 rounded-xl border border-ink-600 bg-ink-850/95 px-4 py-3 shadow-2xl backdrop-blur sm:flex-row sm:items-center">
        <Cookie size={18} className="shrink-0 text-warn" />
        <p className="flex-1 text-[12px] leading-relaxed text-mist-300">
          <b className="text-mist-200">No cookies, no tracking, no account.</b> Measure keeps your plans in this
          browser's local storage so they are still here next time. Nothing is uploaded, and clearing your browser data
          removes them — use Export to keep a copy.
        </p>
        <button
          className="shrink-0 rounded-lg bg-accent px-3.5 py-2 font-medium text-white transition-colors hover:bg-accent/85"
          onClick={ackCookies}
        >
          Got it
        </button>
      </div>
    </div>
  )
}
