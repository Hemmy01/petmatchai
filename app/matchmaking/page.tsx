"use client";
import { useEffect, useRef, useState } from "react";
import { Zap, Loader2, Check, X, History, Clock, Download } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import PetCard, { PetCardData } from "@/components/listings/PetCard";

type MatchCategories = {
  species: boolean;
  price: boolean;
  breed: boolean;
  location: boolean;
  health: boolean;
};

type Match = PetCardData & {
  matchScore: number;
  matchReasons: string[];
  matchCategories?: MatchCategories;
  matchStatus: "pending" | "accepted" | "declined";
};

// Prefer the authoritative per-category result computed by the scoring engine
// (lib/matching.ts) and returned as `matchCategories`. Only fall back to parsing
// the free-text reasons for older cached rows that predate that field.
function buildCompatibilityBreakdown(match: Match) {
  const c = match.matchCategories;
  const cats = c
    ? c
    : (() => {
        const reasonText = (match.matchReasons ?? []).join(" ").toLowerCase();
        return {
          species: !reasonText.includes("species mismatch") && !reasonText.includes("wrong species") && !reasonText.includes("different species"),
          price: !reasonText.includes("over budget") && !reasonText.includes("exceeds budget") && !reasonText.includes("price cap") && !reasonText.includes("above your"),
          breed: !reasonText.includes("breed mismatch") && !reasonText.includes("wrong breed") && !reasonText.includes("isn't a breed"),
          location: reasonText.includes("location match") || reasonText.includes("same location") || reasonText.includes("matching your area"),
          health: !reasonText.includes("missing your requirement") && !reasonText.includes("not vaccinated") && !reasonText.includes("not microchipped") && !reasonText.includes("not dewormed"),
        };
      })();
  return [
    { label: "Species", ok: cats.species, icon: "🐾" },
    { label: "Price / Budget", ok: cats.price, icon: "💰" },
    { label: "Breed", ok: cats.breed, icon: "🏷️" },
    { label: "Location", ok: cats.location, icon: "📍" },
    { label: "Health", ok: cats.health, icon: "💊" },
  ];
}

export default function MatchmakingPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fadingOut, setFadingOut] = useState<Set<string>>(new Set());
  const [threadByPet, setThreadByPet] = useState<Record<string, string>>({});
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [tab, setTab] = useState<"active" | "history">("active");
  const fetchIdRef = useRef(0);

  function fetchMatches() {
    const id = ++fetchIdRef.current;
    api.get("/api/matches")
      .then((res) => {
        if (id !== fetchIdRef.current) return;
        if (res.error) { setError(res.error); return; }
        setMatches(res.data ?? []);
      })
      .catch(() => { if (id === fetchIdRef.current) setError("Failed to load matches."); })
      .finally(() => { if (id === fetchIdRef.current) setLoading(false); });
  }

  useEffect(() => {
    fetchMatches();
  }, []);

  async function handleAccept(petId: string) {
    setActingOn(petId);
    const res = await api.post("/api/matches", { petId, action: "accept" });
    setActingOn(null);
    setMatches((prev) => prev.map((m) => m.id === petId ? { ...m, matchStatus: "accepted" } : m));
    if (res.threadId) {
      setThreadByPet((prev) => ({ ...prev, [petId]: res.threadId }));
    }
  }

  async function handleDecline(petId: string) {
    setFadingOut((prev) => new Set(prev).add(petId));
    setTimeout(() => {
      setMatches((prev) => prev.filter((m) => m.id !== petId));
    }, 300);
    await api.post("/api/matches", { petId, action: "decline" });
  }

  async function handleRevert(petId: string) {
    setActingOn(petId);
    await api.post("/api/matches", { petId, action: "revert" });
    setActingOn(null);
    setMatches((prev) => prev.map((m) => m.id === petId ? { ...m, matchStatus: "pending" } : m));
    setThreadByPet((prev) => { const next = { ...prev }; delete next[petId]; return next; });
  }

  const activeMatches = matches.filter((m) => m.matchStatus !== "declined");
  const history = matches.filter((m) => m.matchStatus === "accepted" || m.matchStatus === "declined");
  const avgScore = activeMatches.length > 0
    ? Math.round(activeMatches.reduce((a, m) => a + m.matchScore, 0) / activeMatches.length)
    : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Matchmaking Engine</h1>
        <p className="text-sm text-gray-500 mt-1">Matches scored against your preferences and live market data</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-indigo-600 text-white rounded-xl p-4">
          <p className="text-sm opacity-80">Active Matches</p>
          <p className="text-3xl font-bold mt-1">{activeMatches.length}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">Avg. Match Score</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{avgScore}%</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm text-gray-500">Powered by</p>
          <p className="text-lg font-bold text-gray-900 mt-1">⚡ Match Engine</p>
        </div>
      </div>

      {/* Export button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={async () => {
            const { utils, writeFile } = await import("xlsx");
            const rows = matches.map((m) => ({
              "Pet Name": m.name,
              Breed: m.breed,
              Species: m.species,
              "Price (₦)": m.price,
              Location: m.location,
              "Match Score (%)": m.matchScore,
              Status: m.matchStatus,
              "Match Reasons": (m.matchReasons ?? []).join("; "),
            }));
            const ws = utils.json_to_sheet(rows);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "My Matches");
            writeFile(wb, `petmatchai_matches_${new Date().toISOString().slice(0, 10)}.xlsx`);
          }}
          disabled={matches.length === 0}
          className="flex items-center gap-1.5 text-xs border border-gray-300 text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-50 disabled:opacity-40">
          <Download size={13} /> Export Matches
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        <button onClick={() => setTab("active")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "active" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <Zap size={14} /> Active
        </button>
        <button onClick={() => setTab("history")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "history" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <History size={14} /> History {history.length > 0 && <span className="bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{history.length}</span>}
        </button>
      </div>

      {/* History Tab */}
      {tab === "history" && (
        <div>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
          ) : history.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <History size={36} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No match history yet</p>
              <p className="text-sm mt-1">Accepted and declined matches will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((m) => (
                <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center text-2xl shrink-0">
                    {m.image_url ? <img src={m.image_url} alt={m.name} className="w-full h-full object-cover rounded-xl" /> : (m.species === "cat" ? "🐱" : "🐶")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{m.name} — {m.breed}</p>
                    <p className="text-sm text-gray-500">{m.location} · ₦{m.price?.toLocaleString()}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-medium text-indigo-600">{m.matchScore}% match</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.matchStatus === "accepted" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {m.matchStatus === "accepted" ? "✓ Accepted" : "✕ Declined"}
                      </span>
                    </div>
                    <div className="flex gap-1 mt-1">
                      {buildCompatibilityBreakdown(m).map((cat) => (
                        <span key={cat.label} title={`${cat.label}: ${cat.ok ? "pass" : "fail"}`}
                          className={`w-2 h-2 rounded-full ${cat.ok ? "bg-green-400" : "bg-red-300"}`} />
                      ))}
                    </div>
                  </div>
                  <Link href={`/listings/${m.id}`}
                    className="text-xs text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 shrink-0">
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "active" && loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
          <p className="text-sm text-gray-500">AI is computing your matches...</p>
        </div>
      ) : tab === "active" && error ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">⚠️</div>
          <p className="font-medium">{error}</p>
          <p className="text-xs mt-2">Make sure you are signed in and have set your preferences.</p>
        </div>
      ) : tab === "active" && activeMatches.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">🐾</div>
          <p className="font-medium">No matches yet. Set your preferences in your profile first!</p>
        </div>
      ) : tab === "active" ? (
        <div className="space-y-4">
          {activeMatches.map((match) => (
            <div key={match.id}
              className={`bg-white rounded-xl border border-gray-200 p-5 transition-all duration-300 ${
                fadingOut.has(match.id) ? "opacity-0 scale-95" : "opacity-100"
              }`}>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-xl flex items-center justify-center text-3xl flex-shrink-0">
                  {match.species === "cat" ? "🐱" : "🐶"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{match.name} — {match.breed}</h3>
                      <p className="text-sm text-gray-500">
                        {match.seller?.name ?? ""} · {match.location}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">{match.matchScore}%</div>
                      <div className="text-xs text-gray-400">match score</div>
                    </div>
                  </div>

                  <div className="h-2 bg-gray-100 rounded-full mb-3">
                    <div className="h-2 bg-gradient-to-r from-indigo-500 to-green-500 rounded-full transition-all"
                      style={{ width: `${match.matchScore}%` }} />
                  </div>

                  <div className="mb-3">
                    <div className="grid grid-cols-5 gap-1 mb-2">
                      {buildCompatibilityBreakdown(match).map((cat) => (
                        <div key={cat.label} className={`flex flex-col items-center p-1.5 rounded-lg text-center ${cat.ok ? "bg-green-50" : "bg-red-50"}`}>
                          <span className="text-base mb-0.5">{cat.icon}</span>
                          <span className={`text-[10px] font-medium leading-tight ${cat.ok ? "text-green-700" : "text-red-500"}`}>{cat.label}</span>
                          <span className={`text-[10px] ${cat.ok ? "text-green-600" : "text-red-400"}`}>{cat.ok ? "✓" : "✗"}</span>
                        </div>
                      ))}
                    </div>
                    {(match.matchReasons ?? []).length > 0 && (
                      <details className="text-xs text-gray-400">
                        <summary className="cursor-pointer hover:text-gray-600 select-none">AI reasoning details</summary>
                        <ul className="mt-1 space-y-0.5 pl-3">
                          {match.matchReasons.map((r, i) => <li key={i} className="list-disc">{r}</li>)}
                        </ul>
                      </details>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-indigo-600">₦{match.price?.toLocaleString()}</span>
                    <a href={`/listings/${match.id}`}
                      className="bg-indigo-600 text-white text-xs px-4 py-1.5 rounded-lg hover:bg-indigo-700">
                      View Pet
                    </a>
                  </div>

                  {match.matchStatus === "accepted" ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
                          <Check size={14} /> Match accepted
                        </span>
                        <Link
                          href={threadByPet[match.id] ? `/messages?thread=${threadByPet[match.id]}` : "/messages"}
                          className="text-xs text-indigo-600 hover:underline font-medium">
                          View conversation →
                        </Link>
                      </div>
                      <button
                        onClick={() => handleRevert(match.id)}
                        disabled={actingOn === match.id}
                        className="w-full flex items-center justify-center gap-1.5 border border-gray-200 text-gray-400 text-xs py-1.5 rounded-lg hover:border-red-200 hover:text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors">
                        {actingOn === match.id ? <Loader2 size={11} className="animate-spin" /> : <X size={11} />}
                        Undo acceptance
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccept(match.id)}
                        disabled={actingOn === match.id}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">
                        {actingOn === match.id
                          ? <Loader2 size={13} className="animate-spin" />
                          : <Check size={13} />}
                        Accept Match
                      </button>
                      <button
                        onClick={() => handleDecline(match.id)}
                        disabled={actingOn === match.id}
                        className="flex-1 flex items-center justify-center gap-1.5 border border-gray-300 text-gray-600 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                        <X size={13} /> Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
