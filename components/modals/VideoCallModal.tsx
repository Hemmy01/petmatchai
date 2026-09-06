"use client"
import { X, Video, ExternalLink } from "lucide-react"

interface Props {
  threadId: string
  otherName: string
  onClose: () => void
}

export default function VideoCallModal({ threadId, otherName, onClose }: Props) {
  const roomName = `petmatchai-${threadId.replace(/-/g, "").slice(0, 20)}`
  const jitsiUrl = `https://meet.jit.si/${roomName}`

  return (
    <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <Video size={18} className="text-indigo-600" />
            <span className="font-semibold text-gray-900">Video Call with {otherName}</span>
            <span className="text-xs text-gray-400">· Powered by Jitsi Meet (end-to-end encrypted)</span>
          </div>
          <div className="flex items-center gap-2">
            <a href={jitsiUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50">
              <ExternalLink size={12} /> Open in new tab
            </a>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Jitsi iframe */}
        <div className="relative" style={{ paddingBottom: "56.25%", height: 0 }}>
          <iframe
            src={`${jitsiUrl}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&interfaceConfig.SHOW_JITSI_WATERMARK=false`}
            allow="camera; microphone; display-capture; autoplay; clipboard-write"
            className="absolute inset-0 w-full h-full border-0"
            title="Video call"
          />
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            🔒 Room: <code className="bg-gray-200 px-1 rounded">{roomName}</code> — share the room name with {otherName} if they need to join from the link
          </p>
          <button onClick={onClose}
            className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50">
            End Call
          </button>
        </div>
      </div>
    </div>
  )
}
