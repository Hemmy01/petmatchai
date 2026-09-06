"use client";
import { useCompare } from "@/lib/compare-context";
import { useRouter } from "next/navigation";
import { X, Scale } from "lucide-react";

export default function CompareTray() {
  const { items, remove, clear } = useCompare();
  const router = useRouter();

  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 shadow-xl">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <Scale size={16} className="text-indigo-600 shrink-0" />
        <div className="flex-1 flex items-center gap-2 overflow-x-auto min-w-0">
          {items.map((item) => (
            <div key={item.id}
              className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-2 py-1.5 shrink-0">
              {item.image_url
                ? <img src={item.image_url} alt={item.name} className="w-7 h-7 rounded object-cover" />
                : <div className="w-7 h-7 bg-indigo-100 rounded flex items-center justify-center text-xs">🐾</div>
              }
              <div className="leading-tight">
                <p className="text-xs font-semibold text-gray-900">{item.name}</p>
                <p className="text-[10px] text-gray-400">{item.breed}</p>
              </div>
              <button
                onClick={() => remove(item.id)}
                aria-label={`Remove ${item.name} from compare`}
                className="text-gray-400 hover:text-gray-600 ml-1 shrink-0">
                <X size={12} />
              </button>
            </div>
          ))}
          {items.length < 3 && (
            <span className="text-xs text-gray-400 shrink-0">
              {3 - items.length} more slot{3 - items.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={clear} className="text-xs text-gray-400 hover:text-gray-700">
            Clear all
          </button>
          <button
            onClick={() => router.push(`/compare?ids=${items.map((i) => i.id).join(",")}`)}
            disabled={items.length < 2}
            className="flex items-center gap-1.5 bg-indigo-600 text-white text-sm px-4 py-2 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed">
            <Scale size={14} />
            Compare ({items.length})
          </button>
        </div>
      </div>
    </div>
  );
}
