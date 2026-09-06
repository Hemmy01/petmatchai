"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Check, ChevronDown, Search } from "lucide-react";
import { NIGERIA_CITIES, cityLabel } from "@/lib/nigeria";

export default function LocationSelect({
  value,
  onChange,
  id = "location",
  required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? NIGERIA_CITIES.filter((c) => c.toLowerCase().includes(q)) : NIGERIA_CITIES;
    return list.slice(0, 80);
  }, [query]);

  function select(city: string) {
    onChange(cityLabel(city));
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) { setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (matches[active]) select(matches[active]); }
    else if (e.key === "Escape") { setOpen(false); }
  }

  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.children[active] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [active, open]);

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <MapPin size={16} className="absolute left-3 top-3 text-gray-400 pointer-events-none" aria-hidden="true" />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          autoComplete="off"
          required={required}
          value={open ? query : value}
          placeholder="Search your city…"
          onFocus={() => { setOpen(true); setActive(0); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
          onKeyDown={onKeyDown}
          className="w-full border border-gray-300 rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <ChevronDown
          size={16}
          onClick={() => setOpen((o) => !o)}
          className={`absolute right-3 top-3 text-gray-400 cursor-pointer transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 text-xs text-gray-400">
            <Search size={13} aria-hidden="true" /> {matches.length} location{matches.length === 1 ? "" : "s"}
          </div>
          <ul id={`${id}-listbox`} ref={listRef} role="listbox" className="max-h-56 overflow-y-auto py-1">
            {matches.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-400">No matching city found</li>
            )}
            {matches.map((city, i) => {
              const isSel = value === cityLabel(city);
              return (
                <li key={city} role="option" aria-selected={isSel}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => select(city)}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm ${
                      i === active ? "bg-indigo-50" : ""
                    } ${isSel ? "text-indigo-700 font-medium" : "text-gray-700"}`}
                  >
                    <span>{city}<span className="text-gray-400">, Nigeria</span></span>
                    {isSel && <Check size={15} className="text-indigo-600" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
