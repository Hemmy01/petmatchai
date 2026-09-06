"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Zap, MessageSquare, Bell, Search, ChevronRight, Loader2, Heart, Sparkles } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";

export default function BuyerDashboardPage() {
  const { user, loading } = useAuth();
  const [recentPets, setRecentPets] = useState<any[]>([]);
  const [threads, setThreads] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [savedCount, setSavedCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [followUps, setFollowUps] = useState<any[]>([]);

  useEffect(() => {
    const searches: string[] = JSON.parse(localStorage.getItem("petmatchai_searches") ?? "[]");
    setRecentSearches(searches);
  }, []);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get("/api/pets"),
      api.get("/api/messages"),
      api.get("/api/notifications"),
      api.get("/api/matches?followup=true"),
      api.get("/api/matches?saved=true"),
      api.get("/api/matches"),
    ]).then(([petsRes, msgRes, notifRes, followUpRes, savedRes, matchesRes]) => {
      setRecentPets(petsRes.data?.slice(0, 4) ?? []);
      setThreads(msgRes.data?.slice(0, 4) ?? []);
      setUnreadCount((notifRes.data ?? []).filter((n: any) => !n.is_read).length);
      setFollowUps(followUpRes.data?.slice(0, 3) ?? []);
      setSavedCount((savedRes.data ?? []).length);
      setMatchCount((matchesRes.data ?? []).length);
      setDataLoading(false);
    });
  }, [user]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-indigo-600" /></div>;
  }

  if (!user) {
    return (
      <div className="text-center py-10">
        <Link href="/auth/login" className="text-indigo-600 text-sm underline">Sign in to view your dashboard</Link>
      </div>
    );
  }

  const firstName = user.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Buyer Dashboard</p>
          <h1 className="text-xl font-bold text-gray-900">Hi, {firstName} 👋</h1>
        </div>
        <Link href="/notifications" className="relative p-2 bg-white border border-gray-200 rounded-xl">
          <Bell size={20} className="text-gray-600" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
              {unreadCount}
            </span>
          )}
        </Link>
      </div>

      {/* Quick search */}
      <Link href="/listings"
        className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-400 hover:border-indigo-300 transition-colors">
        <Search size={16} /> Search for pets...
      </Link>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Saved Pets" value={savedCount} icon={Heart} color="indigo" />
        <StatCard label="AI Matches" value={matchCount} icon={Sparkles} color="purple" />
        <StatCard label="Messages" value={threads.length} icon={MessageSquare} color="green" />
        <StatCard label="Unread Alerts" value={unreadCount} icon={Bell} color="yellow" />
      </div>

      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-gray-900 text-sm">Recent Searches</h2>
            <button onClick={() => { localStorage.removeItem("petmatchai_searches"); setRecentSearches([]); }}
              className="text-xs text-gray-400 hover:text-red-500">Clear</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((s) => (
              <Link key={s} href={`/listings?q=${encodeURIComponent(s)}`}
                className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-full hover:bg-indigo-50 hover:text-indigo-700 transition-colors">
                <Search size={11} /> {s}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Follow-up suggestions */}
      {followUps.length > 0 && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <h2 className="font-semibold text-amber-900 text-sm mb-3">💬 Follow up on your matches</h2>
          <div className="space-y-2">
            {followUps.map((pet: any) => (
              <div key={pet.id} className="flex items-center gap-3 bg-white rounded-xl border border-amber-100 p-3">
                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center text-xl shrink-0">
                  {pet.species === "cat" ? "🐱" : "🐶"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{pet.name} — {pet.breed}</p>
                  <p className="text-xs text-gray-500">You accepted this match but haven't messaged recently</p>
                </div>
                <Link href="/messages" className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700 shrink-0 font-medium">
                  Message
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* AI Matching CTA */}
      <Link href="/matchmaking"
        className="flex items-center gap-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-4 hover:opacity-95 transition-opacity">
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
          <Zap size={22} className="text-white" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Find Your AI Match</p>
          <p className="text-xs text-white/80 mt-0.5">Our engine scores every pet against your preferences</p>
        </div>
        <ChevronRight size={18} className="text-white/70" />
      </Link>

      {/* Browse by type */}
      <section>
        <h2 className="font-semibold text-gray-900 mb-3">Browse by Type</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/listings?type=dog"
            className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-3 hover:bg-amber-100 transition-colors">
            <span className="text-3xl">🐕</span>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Dogs</p>
              <p className="text-xs text-gray-500">{recentPets.filter((p) => p.species === "dog").length} recent</p>
            </div>
          </Link>
          <Link href="/listings?type=cat"
            className="bg-pink-50 border border-pink-200 rounded-xl p-4 flex items-center gap-3 hover:bg-pink-100 transition-colors">
            <span className="text-3xl">🐈</span>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Cats</p>
              <p className="text-xs text-gray-500">{recentPets.filter((p) => p.species === "cat").length} recent</p>
            </div>
          </Link>
        </div>
      </section>

      {/* Recent listings */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Recent Listings</h2>
          <Link href="/listings" className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
            View all <ChevronRight size={14} />
          </Link>
        </div>
        {dataLoading ? (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-indigo-400" /></div>
        ) : recentPets.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No listings found yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {recentPets.map((pet) => (
              <Link key={pet.id} href={`/listings/${pet.id}`}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                {pet.image_url ? (
                  <img src={pet.image_url} alt={pet.name} className="w-full aspect-[4/3] object-contain bg-gray-50" />
                ) : (
                  <div className="bg-gradient-to-br from-indigo-100 to-purple-100 aspect-[4/3] flex items-center justify-center text-4xl">
                    {pet.species === "cat" ? "🐱" : "🐶"}
                  </div>
                )}
                <div className="p-3">
                  <p className="font-semibold text-sm text-gray-900 truncate">{pet.name}</p>
                  <p className="text-xs text-gray-500 truncate">{pet.breed}</p>
                  <p className="text-xs font-semibold text-indigo-600 mt-1">₦{Number(pet.price).toLocaleString()}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Recent messages */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Messages</h2>
          <Link href="/messages" className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
            View all <ChevronRight size={14} />
          </Link>
        </div>
        {dataLoading ? (
          <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-indigo-400" /></div>
        ) : threads.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-sm text-gray-400">No messages yet. Contact a seller from any listing.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {threads.map((t: any) => (
              <Link key={t.id} href="/messages" className="flex items-center gap-3 p-4 hover:bg-gray-50">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-lg shrink-0">🐾</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {t.seller?.name ?? t.buyer?.name ?? "Conversation"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{t.last_message ?? "No messages yet"}</p>
                </div>
                {t.unread_count > 0 && (
                  <span className="bg-indigo-600 text-white text-xs rounded-full px-2 py-0.5 shrink-0">{t.unread_count}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
