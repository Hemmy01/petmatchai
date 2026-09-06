"use client"
import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { useIdleTimeout } from "@/lib/use-idle-timeout"

const WARN_SECONDS = 120

export default function IdleTimeoutModal() {
  const { user, logout } = useAuth()
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [countdown, setCountdown] = useState(WARN_SECONDS)

  const handleLogout = useCallback(async () => {
    setVisible(false)
    await logout()
    router.push("/auth/login?reason=idle")
  }, [logout, router])

  const { reset } = useIdleTimeout(
    useCallback(() => { if (user) setVisible(true) }, [user]),
    handleLogout
  )

  useEffect(() => {
    if (!visible) { setCountdown(WARN_SECONDS); return }
    const iv = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(iv)
  }, [visible])

  function stayLoggedIn() {
    setVisible(false)
    reset()
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-labelledby="idle-title">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center">
        <div className="text-5xl mb-4">⏱️</div>
        <h2 id="idle-title" className="text-lg font-bold text-gray-900 mb-2">Still there?</h2>
        <p className="text-sm text-gray-500 mb-4">
          You've been inactive. For your security, you'll be signed out in{" "}
          <span className="font-bold text-red-600">{countdown}s</span>.
        </p>
        <div className="w-full bg-gray-100 rounded-full h-1.5 mb-5 overflow-hidden">
          <div
            className="bg-red-500 h-1.5 rounded-full transition-all duration-1000"
            style={{ width: `${(countdown / WARN_SECONDS) * 100}%` }}
          />
        </div>
        <div className="flex gap-3">
          <button onClick={stayLoggedIn}
            className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-indigo-700 transition-colors">
            Stay Logged In
          </button>
          <button onClick={handleLogout}
            className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
