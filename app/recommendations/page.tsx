"use client";
import { useState, useEffect, useRef } from "react";
import { Zap, Heart, ExternalLink, Loader2, Settings, RefreshCw, ShieldCheck, ThumbsUp, ThumbsDown, Eye, Bookmark, MapPin, Share2, History, Check, X } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import PetCard, { PetCardData } from "@/components/listings/PetCard";

type Pet = {
  id: string;
  name: string;
  species: string;
  breed: string;
  age_months: number;
  gender: string;
  price: number;
  location: string;
  vaccinated: boolean;
  dewormed: boolean;
  microchipped: boolean;
  image_url: string | null;
  matchScore: number;
  matchReasons: string[];
  feedback: "interested" | "not_interested" | null;
  seller: { id: string; name: string; is_verified: boolean } | null;
};

type BecauseYouViewed = { petName: string; suggestions: PetCardData[] } | null;

function scoreColor(score: number) {
  if (score >= 80) return "bg-green-100 text-green-700";
  if (score >= 60) return "bg-indigo-100 text-indigo-700";
  if (score >= 40) return "bg-yellow-100 text-yellow-700";
  return "bg-gray-100 text-gray-500";
}

function ageLabel(months: number) {
  if (months < 1) return "< 1 month";
  if (months < 12) return `${months} month${months > 1 ? "s" : ""}`;
  const yrs = Math.floor(months / 12);
  const mo = months % 12;
  return mo > 0 ? `${yrs}y ${mo}m` : `${yrs} yr${yrs > 1 ? "s" : ""}`;
}

export default function RecommendationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [message, setMessage] = useState("");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [hasPrefs, setHasPrefs] = useState<boolean | null>(null);
  const [feedback, setFeedback] = useState<Record<string, "interested" | "not_interested" | null>>({});
  const [fadingOut, setFadingOut] = useState<Set<string>>(new Set());
  const [becauseYouViewed, setBecauseYouViewed] = useState<BecauseYouViewed>(null);
  const [similarToSaved, setSimilarToSaved] = useState<PetCardData[]>([]);
  const [popularInArea, setPopularInArea] = useState<PetCardData[]>([]);
  const [tab, setTab] = useState<"recommendations" | "history">("recommendations");
  const [history, setHistory] = useState<(Pet & { matchStatus: string; updatedAt: string })[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const fetchIdRef = useRef(0);

  async function fetchRecommendations() {
    const id = ++fetchIdRef.current;
    setFetching(true);
    setError("");
    const res = await api.get("/api/recommendations");
    if (id !== fetchIdRef.current) return; // a newer fetch superseded this one
    setFetching(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    const data: Pet[] = res.data ?? [];
    setPets(data);
    setFeedback(Object.fromEntries(data.map((p) => [p.id, p.feedback ?? null])));
    setMessage(res.message ?? "");
    setBecauseYouViewed(res.becauseYouViewed ?? null);
    setSimilarToSaved(res.similarToSaved ?? []);
    setPopularInArea(res.popularInArea ?? []);
  }

  useEffect(() => {
    if (!user || tab !== "history") return;
    setHistoryLoading(true);
    api.get("/api/matches?history=true").then((res) => {
      setHistory(res.data ?? []);
      setHistoryLoading(false);
    });
  }, [user, tab]);

  useEffect(() => {
    if (!user) return;
    // Check if user has preferences set
    api.get("/api/preferences").then((res) => {
      const prefs = res.data;
      const hasAny =
        prefs &&
        (prefs.preferred_species?.length > 0 ||
          prefs.preferred_breeds?.length > 0 ||
          (prefs.budget_max && prefs.budget_max < 999999));
      setHasPrefs(!!hasAny);
      if (hasAny) fetchRecommendations();
    });
  }, [user]);

  async function handleSave(petId: string) {
    const action = saved.has(petId) ? "unsave" : "save";
    setSaved((prev) => {
      const next = new Set(prev);
      action === "save" ? next.add(petId) : next.delete(petId);
      return next;
    });
    await api.post("/api/matches", { petId, action });
  }

  async function handleFeedback(petId: string, action: "interested" | "not_interested") {
    setFeedback((prev) => ({ ...prev, [petId]: action }));
    if (action === "not_interested") {
      setFadingOut((prev) => new Set(prev).add(petId));
      setTimeout(() => {
        setPets((prev) => prev.filter((p) => p.id !== petId));
      }, 300);
    }
    await api.post("/api/matches", { petId, action });
  }

  if (authLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={28} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to get recommendations</h2>
        <p className="text-sm text-gray-500 mb-4">
          AI-powered recommendations are personalised to your preferences and require an account.
        </p>
        <Link href="/auth/login" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 text-sm">
          Sign In
        </Link>
      </div>
    );
  }

  if (hasPrefs === false) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Settings size={28} className="text-indigo-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Set your preferences first</h2>
        <p className="text-sm text-gray-500 mb-6">
          We need to know what kind of pet you're looking for — species, breed, budget, purpose — before the matching
          engine can score and rank matches for you.
        </p>
        <Link href="/profile"
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 text-sm inline-block">
          Go to Preferences →
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AI Recommendations</h1>
          <p className="text-sm text-gray-500 mt-1">Personalised matches scored against your preferences</p>
        </div>
        <div className="flex gap-2">
          <Link href="/profile"
            className="flex items-center gap-1.5 text-xs border border-gray-300 text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-50">
            <Settings size={14} /> Preferences
          </Link>
          {tab === "recommendations" && (
            <button onClick={fetchRecommendations} disabled={fetching}
              className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-2 rounded-xl hover:bg-indigo-700 disabled:opacity-60">
              <RefreshCw size={14} className={fetching ? "animate-spin" : ""} />
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        <button onClick={() => setTab("recommendations")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "recommendations" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <Zap size={14} /> Recommendations {pets.length > 0 && <span className="bg-indigo-100 text-indigo-600 text-xs px-1.5 py-0.5 rounded-full">{pets.length}</span>}
        </button>
        <button onClick={() => setTab("history")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "history" ? "bg-white text-indigo-600 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          <History size={14} /> History
        </button>
      </div>

      {/* History Tab */}
      {tab === "history" && (
        <div>
          {historyLoading ? (
            <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
          ) : history.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <History size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No history yet</p>
              <p className="text-sm mt-1">Pets scored by the matching engine will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((pet) => (
                <div key={pet.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-2xl">
                    {pet.image_url ? <img src={pet.image_url} alt={pet.name} className="w-full h-full object-cover" /> : (pet.species === "cat" ? "🐱" : "🐶")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 truncate">{pet.name}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(pet.matchScore)}`}>{pet.matchScore}% match</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        pet.matchStatus === "accepted" ? "bg-green-100 text-green-700" :
                        pet.matchStatus === "declined" ? "bg-gray-100 text-gray-500" : "bg-yellow-50 text-yellow-700"
                      }`}>
                        {pet.matchStatus === "accepted" ? <><Check size={10} className="inline" /> Accepted</> :
                         pet.matchStatus === "declined" ? <><X size={10} className="inline" /> Declined</> : "Pending"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5"><Link href={`/listings?breed=${encodeURIComponent(pet.breed)}`} className="hover:text-indigo-600 hover:underline">{pet.breed}</Link> · {pet.location} · ₦{Number(pet.price).toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Scored {new Date(pet.updatedAt).toLocaleDateString()}</p>
                  </div>
                  <Link href={`/listings/${pet.id}`}
                    className="text-xs text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 shrink-0">
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recommendations tab content */}
      {tab === "recommendations" && <>

      {/* AI message banner */}
      {message && !fetching && (
        <div className="flex gap-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-4 mb-6">
          <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center shrink-0 mt-0.5">
            <Zap size={14} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-indigo-700 mb-0.5">Groq AI says</p>
            <p className="text-sm text-gray-700">{message}</p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {fetching && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="relative">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center">
              <Zap size={28} className="text-indigo-600" />
            </div>
            <Loader2 size={20} className="animate-spin text-indigo-600 absolute -top-1 -right-1" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-gray-900">Finding your best matches…</p>
            <p className="text-sm text-gray-400 mt-1">This usually takes 5–15 seconds</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && !fetching && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl mb-4">
          {error}
        </div>
      )}

      {/* Results */}
      {!fetching && pets.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Zap size={18} className="text-indigo-600" />
            <h2 className="font-semibold text-gray-900">Your Top Matches</h2>
          </div>
          <div className="space-y-3">
            {pets.map((pet, i) => (
              <div key={pet.id}
                className={`bg-white rounded-2xl border border-gray-200 p-4 flex items-start gap-4 hover:shadow-sm transition-all duration-300 ${
                  fadingOut.has(pet.id) ? "opacity-0 scale-95" : "opacity-100"
                }`}>
                {/* Rank badge */}
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-1">
                  {i + 1}
                </div>

                {/* Pet image */}
                <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-2xl">
                  {pet.image_url
                    ? <img src={pet.image_url} alt={pet.name} className="w-full h-full object-cover" />
                    : (pet.species === "cat" ? "🐱" : "🐶")
                  }
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-semibold text-gray-900">{pet.name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scoreColor(pet.matchScore)}`}>
                      {pet.matchScore}% match
                    </span>
                    {pet.seller?.is_verified && (
                      <span className="flex items-center gap-0.5 text-xs text-blue-600">
                        <ShieldCheck size={12} /> Verified
                      </span>
                    )}
                    {feedback[pet.id] === "interested" && (
                      <span className="flex items-center gap-0.5 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        <ThumbsUp size={11} /> Interested
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500">
                    <Link href={`/listings?breed=${encodeURIComponent(pet.breed)}`} className="hover:text-indigo-600 hover:underline">{pet.breed}</Link> · {pet.gender} · {ageLabel(pet.age_months)} · {pet.location}
                  </p>
                  <p className="text-sm font-semibold text-indigo-600 mt-0.5">
                    ₦{Number(pet.price).toLocaleString()}
                  </p>

                  {/* Health badges */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {pet.vaccinated && (
                      <span className="bg-green-50 text-green-700 text-[11px] px-1.5 py-0.5 rounded-md">💉 Vaccinated</span>
                    )}
                    {pet.dewormed && (
                      <span className="bg-green-50 text-green-700 text-[11px] px-1.5 py-0.5 rounded-md">✅ Dewormed</span>
                    )}
                    {pet.microchipped && (
                      <span className="bg-blue-50 text-blue-700 text-[11px] px-1.5 py-0.5 rounded-md">📡 Microchipped</span>
                    )}
                  </div>

                  {/* Match reasons */}
                  {pet.matchReasons.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {pet.matchReasons.map((r) => (
                        <span key={r} className="bg-indigo-50 text-indigo-600 text-[11px] px-2 py-0.5 rounded-full">
                          {r}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 items-end shrink-0">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleFeedback(pet.id, "interested")}
                      className={`p-2 border rounded-xl transition-colors ${
                        feedback[pet.id] === "interested"
                          ? "bg-green-50 border-green-300 text-green-600"
                          : "border-gray-200 text-gray-400 hover:text-green-600 hover:border-green-200"
                      }`}
                      title="Interested — show me more like this">
                      <ThumbsUp size={14} fill={feedback[pet.id] === "interested" ? "currentColor" : "none"} />
                    </button>
                    <button
                      onClick={() => handleFeedback(pet.id, "not_interested")}
                      className={`p-2 border rounded-xl transition-colors ${
                        feedback[pet.id] === "not_interested"
                          ? "bg-red-50 border-red-300 text-red-500"
                          : "border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200"
                      }`}
                      title="Not interested — show me fewer like this">
                      <ThumbsDown size={14} fill={feedback[pet.id] === "not_interested" ? "currentColor" : "none"} />
                    </button>
                  </div>
                  <button
                    onClick={() => handleSave(pet.id)}
                    className={`p-2 border rounded-xl transition-colors ${
                      saved.has(pet.id)
                        ? "bg-red-50 border-red-200 text-red-500"
                        : "border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200"
                    }`}
                    title={saved.has(pet.id) ? "Unsave" : "Save"}>
                    <Heart size={15} fill={saved.has(pet.id) ? "currentColor" : "none"} />
                  </button>
                  <Link href={`/listings/${pet.id}`}
                    className="flex items-center gap-1 text-xs text-indigo-600 hover:underline whitespace-nowrap">
                    View <ExternalLink size={11} />
                  </Link>
                  <button
                    onClick={() => navigator.share?.({ title: `Check out ${pet.name} on PetMatchAI`, url: `${window.location.origin}/listings/${pet.id}` })}
                    className="p-2 border border-gray-200 rounded-xl text-gray-400 hover:text-indigo-600 hover:border-indigo-300 transition-colors"
                    title="Share this recommendation">
                    <Share2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contextual sections */}
      {!fetching && becauseYouViewed && becauseYouViewed.suggestions.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Eye size={16} className="text-indigo-600" />
            <h2 className="font-semibold text-gray-900">Because you viewed {becauseYouViewed.petName}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {becauseYouViewed.suggestions.map((p) => (
              <PetCard key={p.id} pet={p} />
            ))}
          </div>
        </section>
      )}

      {!fetching && similarToSaved.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Bookmark size={16} className="text-indigo-600" />
            <h2 className="font-semibold text-gray-900">Similar to your saved pets</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {similarToSaved.map((p) => (
              <PetCard key={p.id} pet={p} />
            ))}
          </div>
        </section>
      )}

      {!fetching && popularInArea.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <MapPin size={16} className="text-indigo-600" />
            <h2 className="font-semibold text-gray-900">Popular in your area</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {popularInArea.map((p) => (
              <PetCard key={p.id} pet={p} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state — preferences set but no results */}
      {!fetching && !error && pets.length === 0 && hasPrefs && (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">🐾</div>
          <h3 className="font-semibold text-gray-900 mb-1">No matches found</h3>
          <p className="text-sm text-gray-500 mb-4">
            No active listings currently match your preferences. Try widening your budget or species filter.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/profile" className="text-sm text-indigo-600 border border-indigo-200 px-4 py-2 rounded-xl hover:bg-indigo-50">
              Adjust Preferences
            </Link>
            <Link href="/listings" className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700">
              Browse All Listings
            </Link>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}
