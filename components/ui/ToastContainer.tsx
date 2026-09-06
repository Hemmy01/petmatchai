"use client";
import { useToast } from "@/lib/toast-context";
import { X, MessageSquare, Tag, Zap, Bell } from "lucide-react";

const ICONS: Record<string, React.ElementType> = {
  message: MessageSquare,
  offer: Tag,
  match: Zap,
  default: Bell,
};

const COLORS = {
  success: "border-green-200 bg-green-50",
  info:    "border-indigo-200 bg-indigo-50",
  warning: "border-yellow-200 bg-yellow-50",
  error:   "border-red-200 bg-red-50",
};

const ICON_COLORS = {
  success: "text-green-600",
  info:    "text-indigo-600",
  warning: "text-yellow-600",
  error:   "text-red-500",
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[60] flex flex-col gap-2 w-72 sm:w-80 pointer-events-none">
      {toasts.map((t) => {
        const Icon = ICONS[t.title.toLowerCase().includes("message") ? "message"
          : t.title.toLowerCase().includes("offer") ? "offer"
          : t.title.toLowerCase().includes("match") ? "match"
          : "default"] ?? Bell;
        return (
          <div key={t.id}
            className={`pointer-events-auto flex items-start gap-3 border rounded-xl px-4 py-3 shadow-md ${COLORS[t.type]}`}>
            <div className={`shrink-0 mt-0.5 ${ICON_COLORS[t.type]}`}>
              <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{t.title}</p>
              {t.message && (
                <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{t.message}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 text-gray-400 hover:text-gray-600"
              aria-label="Dismiss notification">
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
