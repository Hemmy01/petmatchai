"use client";
import { useState, useEffect } from "react";
import { Loader2, Plus, Trash2, ToggleLeft, ToggleRight, MapPin, Megaphone, MessageSquare, Search } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Link from "next/link";
import LocationSelect from "@/components/ui/LocationSelect";

type WantAd = {
  id: string;
  title: string;
  species: string | null;
  breeds: string[];
  budget_max: number | null;
  location: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  buyer?: { id: string; name: string; location?: string | null } | null;
};

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const SPECIES = ["dog", "cat", "bird", "rabbit", "other"];

const EXPIRY_DAYS = 30;

function timeAgo(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function expiryInfo(iso: string): { expired: boolean; daysLeft: number } {
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  const daysLeft = EXPIRY_DAYS - diffDays;
  return { expired: daysLeft <= 0, daysLeft: Math.max(0, daysLeft) };
}

// ── Seller browse view ──────────────────────────────────────────────────────
function SellerView({ ads }: { ads: WantAd[] }) {
  const [search, setSearch] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("all");

  const filtered = ads.filter((ad) => {
    if (speciesFilter !== "all" && ad.species !== speciesFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        ad.title.toLowerCase().includes(q) ||
        (ad.description ?? "").toLowerCase().includes(q) ||
        (ad.breeds ?? []).some((b) => b.toLowerCase().includes(q)) ||
        (ad.location ?? "").toLowerCase().includes(q) ||
        (ad.buyer?.name ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Buyer Want-Ads</h1>
        <p className="text-sm text-gray-500 mt-1">
          Active requests from buyers looking for pets — find potential customers for your listings
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, breed, location…"
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={speciesFilter}
          onChange={(e) => setSpeciesFilter(e.target.value)}
          className="border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All species</option>
          {SPECIES.map((s) => (
            <option key={s} value={s} className="capitalize">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {ads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-14 text-center">
          <Megaphone size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No active buyer requests yet</p>
          <p className="text-xs text-gray-400 mt-1">Check back later — buyers post here when looking for pets</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-sm text-gray-400">No want-ads match your search.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-xs text-gray-400">{filtered.length} request{filtered.length !== 1 ? "s" : ""} found</p>
          {filtered.map((ad) => (
            <div key={ad.id} className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-indigo-200 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 text-[15px] mb-2">{ad.title}</h3>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {ad.species && (
                      <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full capitalize font-medium">
                        {ad.species}
                      </span>
                    )}
                    {ad.breeds?.map((b) => (
                      <span key={b} className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full">{b}</span>
                    ))}
                    {ad.budget_max && (
                      <span className="bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        Budget: up to ₦{Number(ad.budget_max).toLocaleString()}
                      </span>
                    )}
                  </div>

                  {ad.description && (
                    <p className="text-sm text-gray-600 mb-3 leading-relaxed">{ad.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <div className="w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-[10px]">
                        {(ad.buyer?.name ?? "?")[0].toUpperCase()}
                      </div>
                      {ad.buyer?.name ?? "Buyer"}
                    </span>
                    {(ad.location || ad.buyer?.location) && (
                      <span className="flex items-center gap-0.5">
                        <MapPin size={11} /> {ad.location ?? ad.buyer?.location}
                      </span>
                    )}
                    <span>{timeAgo(ad.created_at)}</span>
                  </div>
                </div>

                {/* Contact CTA */}
                <Link
                  href={`/messages`}
                  className="shrink-0 flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-semibold px-3 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
                >
                  <MessageSquare size={13} /> Message
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Buyer management view ───────────────────────────────────────────────────
export default function WantAdsPage() {
  const { user, loading: authLoading } = useAuth();
  const [ads, setAds] = useState<WantAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [title, setTitle] = useState("");
  const [species, setSpecies] = useState("");
  const [breedsText, setBreedsText] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!user) return;
    api.get("/api/want-ads").then((res) => {
      setAds(res.data ?? []);
      setLoading(false);
    });
  }, [user]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const res = await api.post("/api/want-ads", {
      title: title.trim(),
      species: species || null,
      breeds: breedsText.split(",").map((b) => b.trim()).filter(Boolean),
      budgetMax: budgetMax ? Number(budgetMax) : null,
      location: location.trim() || null,
      description: description.trim() || null,
    });
    setSaving(false);
    if (res.error) { setMsg(`Error: ${res.error}`); return; }
    setAds((prev) => [res.data, ...prev]);
    setTitle(""); setSpecies(""); setBreedsText(""); setBudgetMax(""); setLocation(""); setDescription("");
    setShowForm(false);
    setMsg("Want-ad posted!");
    setTimeout(() => setMsg(""), 3000);
  }

  async function handleToggle(ad: WantAd) {
    const res = await api.patch("/api/want-ads", { id: ad.id, isActive: !ad.is_active });
    if (!res.error) setAds((prev) => prev.map((a) => a.id === ad.id ? { ...a, is_active: !ad.is_active } : a));
  }

  async function handleDelete(id: string) {
    const res = await api.delete(`/api/want-ads?id=${id}`);
    if (!res.error) setAds((prev) => prev.filter((a) => a.id !== id));
  }

  if (authLoading || loading) {
    return <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-indigo-600" /></div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="text-4xl mb-3">🔒</div>
        <Link href="/auth/login" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm">Sign In</Link>
      </div>
    );
  }

  // Sellers and admins see the browse view
  if (user.role === "seller" || user.role === "administrator") {
    return <SellerView ads={ads} />;
  }

  // ── Buyer view ──
  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Want-Ads</h1>
          <p className="text-sm text-gray-500 mt-1">Tell sellers what pet you're looking for</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700">
          <Plus size={16} /> New Want-Ad
        </button>
      </div>

      {msg && (
        <div className={`text-sm px-4 py-2.5 rounded-xl mb-4 ${msg.startsWith("Error") ? "bg-red-50 text-red-600 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
          {msg}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Post a Want-Ad</h2>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inp}
              placeholder="e.g. Looking for a Golden Retriever puppy" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Species</label>
              <select value={species} onChange={(e) => setSpecies(e.target.value)} className={inp}>
                <option value="">Any</option>
                {SPECIES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Budget (₦)</label>
              <input type="number" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} className={inp}
                placeholder="e.g. 500000" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Preferred Breeds</label>
            <input value={breedsText} onChange={(e) => setBreedsText(e.target.value)} className={inp}
              placeholder="Golden Retriever, Labrador (comma-separated)" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Location Preference</label>
            <LocationSelect value={location} onChange={setLocation} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">More Details</label>
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              className={`${inp} resize-none`} placeholder="Age preference, health requirements, purpose..." />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
              {saving && <Loader2 size={13} className="animate-spin" />}
              {saving ? "Posting…" : "Post Want-Ad"}
            </button>
            <button type="button" onClick={() => setShowForm(false)}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancel</button>
          </div>
        </form>
      )}

      {ads.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <Megaphone size={36} className="mx-auto text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500 mb-1">No want-ads yet</p>
          <p className="text-xs text-gray-400">Post a want-ad to let sellers know what you're looking for.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {ads.map((ad) => {
            const { expired, daysLeft } = expiryInfo(ad.created_at);
            const isVisible = ad.is_active && !expired;
            return (
              <div key={ad.id} className={`bg-white rounded-2xl border p-5 transition-opacity ${isVisible ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-gray-900">{ad.title}</h3>
                      {expired ? (
                        <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium">Expired</span>
                      ) : daysLeft <= 7 ? (
                        <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full font-medium">Expires in {daysLeft}d</span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {ad.species && (
                        <span className="bg-indigo-50 text-indigo-700 text-xs px-2 py-0.5 rounded-full capitalize">{ad.species}</span>
                      )}
                      {ad.breeds?.map((b) => (
                        <span key={b} className="bg-purple-50 text-purple-700 text-xs px-2 py-0.5 rounded-full">{b}</span>
                      ))}
                      {ad.budget_max && (
                        <span className="bg-green-50 text-green-700 text-xs px-2 py-0.5 rounded-full">
                          Up to ₦{Number(ad.budget_max).toLocaleString()}
                        </span>
                      )}
                      {ad.location && (
                        <span className="flex items-center gap-0.5 text-xs text-gray-500">
                          <MapPin size={11} /> {ad.location}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!expired && (
                      <button onClick={() => handleToggle(ad)} title={ad.is_active ? "Deactivate" : "Activate"}
                        className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors">
                        {ad.is_active ? <ToggleRight size={20} className="text-indigo-600" /> : <ToggleLeft size={20} />}
                      </button>
                    )}
                    <button onClick={() => handleDelete(ad.id)} title="Delete"
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                {ad.description && (
                  <p className="text-sm text-gray-500 mt-2">{ad.description}</p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-gray-400">
                    {expired ? "Expired" : ad.is_active ? "Visible to sellers" : "Hidden from sellers"} · Posted {timeAgo(ad.created_at)}
                  </p>
                  {expired && (
                    <button
                      onClick={async () => {
                        await handleDelete(ad.id);
                        setTitle(ad.title);
                        setSpecies(ad.species ?? "");
                        setBreedsText((ad.breeds ?? []).join(", "));
                        setBudgetMax(ad.budget_max ? String(ad.budget_max) : "");
                        setLocation(ad.location ?? "");
                        setDescription(ad.description ?? "");
                        setShowForm(true);
                      }}
                      className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 font-medium">
                      Repost
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
