"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { List, Eye, MessageSquare, PlusCircle, ChevronRight, Bell, Loader2, Star, Pencil, CheckSquare, Trash2, Megaphone, MapPin, ShieldCheck } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";

export default function SellerDashboardPage() {
  const { user, loading } = useAuth();
  const [listings, setListings] = useState<any[]>([]);
  const [threads, setThreads] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [matchingBuyers, setMatchingBuyers] = useState<any[]>([]);

  async function handleToggleSold(petId: string, currentStatus: string) {
    setActing(petId);
    const target = currentStatus === "sold" ? "active" : "sold";
    const res = await api.patch("/api/pets", { id: petId, status: target });
    if (!res.error) {
      setListings((prev) => prev.map((p) => p.id === petId ? { ...p, status: target } : p));
    }
    setActing(null);
  }

  async function handleDelete(petId: string) {
    if (!confirm("Delete this listing? This cannot be undone.")) return;
    setActing(petId);
    const { supabase: sb } = await import("@/lib/supabase");
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(`/api/pets?id=${petId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    });
    if (res.ok) setListings((prev) => prev.filter((p) => p.id !== petId));
    setActing(null);
  }

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get(`/api/pets?sellerId=${user.id}`),
      api.get("/api/messages"),
      api.get(`/api/analytics?sellerId=${user.id}`),
      api.get("/api/notifications"),
      api.get(`/api/want-ads?sellerId=${user.id}`),
    ]).then(([petsRes, msgRes, analyticsRes, notifRes, wantRes]) => {
      setListings(petsRes.data ?? []);
      setThreads(msgRes.data?.slice(0, 4) ?? []);
      setAnalytics(analyticsRes.data ?? null);
      setUnreadCount((notifRes.data ?? []).filter((n: any) => !n.is_read).length);
      setMatchingBuyers(wantRes.data?.slice(0, 5) ?? []);
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

  const activeCount = listings.filter((p) => p.status === "active").length;
  const totalViews = analytics?.totalViews ?? listings.reduce((s: number, p: any) => s + (p.views ?? 0), 0);
  const totalInquiries = analytics?.totalInquiries ?? listings.reduce((s: number, p: any) => s + (p.inquiries ?? 0), 0);
  const avgRating = analytics?.avgRating ?? 0;

  // Bar chart: views per listing (top 6)
  const chartData = [...listings]
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 6);
  const maxViews = Math.max(...chartData.map((p) => p.views ?? 0), 1);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Seller Dashboard</p>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-1.5">
            {user.name ?? "My Store"}
            {user.is_verified && <VerifiedBadge size={18} />}
          </h1>
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

      {/* Verification banner — only show if not yet verified */}
      {!user.is_verified && (
        <Link href="/profile/verify"
          className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 hover:bg-amber-100 transition-colors">
          <ShieldCheck size={20} className="text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900">Verify your identity to build buyer trust</p>
            <p className="text-xs text-amber-700 mt-0.5">Upload a government ID — takes 2 minutes. All listings get a Verified Seller badge.</p>
          </div>
          <span className="text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg shrink-0">Verify →</span>
        </Link>
      )}

      {/* CTA */}
      <Link href="/listings/new"
        className="flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
        <PlusCircle size={18} /> Create New Listing
      </Link>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Active Listings" value={activeCount} icon={List} color="indigo" />
        <StatCard label="Total Views" value={totalViews} icon={Eye} color="purple" />
        <StatCard label="Inquiries" value={totalInquiries} icon={MessageSquare} color="green" />
        <StatCard label="Avg. Rating" value={avgRating > 0 ? `${avgRating}/5` : "—"} icon={Star} color="yellow" />
      </div>

      {/* Views per listing chart */}
      {chartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 text-sm">Views per Listing</h2>
            <Link href="/analytics" className="text-xs text-indigo-600 font-medium">Full report →</Link>
          </div>
          <div className="flex items-end gap-2 h-24">
            {chartData.map((p) => (
              <div key={p.id} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-indigo-500 rounded-t-sm"
                  style={{ height: `${Math.max(4, ((p.views ?? 0) / maxViews) * 80)}px` }}
                />
                <span className="text-[10px] text-gray-400 truncate w-full text-center">{p.name}</span>
              </div>
            ))}
          </div>
          {chartData.every((p) => (p.views ?? 0) === 0) && (
            <p className="text-xs text-gray-400 text-center mt-1">Views will appear here once buyers view your listings</p>
          )}
        </div>
      )}

      {/* My listings */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">My Listings</h2>
          <Link href="/listings/new" className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
            Add new <ChevronRight size={14} />
          </Link>
        </div>
        {dataLoading ? (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-indigo-400" /></div>
        ) : listings.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-gray-300 p-6 text-center">
            <p className="text-sm text-gray-400 mb-3">No listings yet.</p>
            <Link href="/listings/new" className="text-sm text-indigo-600 font-medium underline">Create your first listing</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {listings.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className="flex items-center gap-3">
                  <Link href={`/listings/${p.id}`} className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-lg flex items-center justify-center text-2xl shrink-0 overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                    ) : (
                      p.species === "cat" ? "🐱" : "🐶"
                    )}
                  </Link>
                  <Link href={`/listings/${p.id}`} className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">
                      {p.name} <span className="font-normal text-gray-400">({p.breed})</span>
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span>👁 {p.views ?? 0}</span>
                      <span>💬 {p.inquiries ?? 0}</span>
                      <span className="font-semibold text-indigo-600">₦{Number(p.price).toLocaleString()}</span>
                    </div>
                  </Link>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
                    p.status === "active" ? "bg-green-100 text-green-700" :
                    p.status === "sold" ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-600"
                  }`}>{p.status}</span>
                </div>
                {/* Action buttons */}
                <div className="flex gap-1.5 mt-2.5 pl-15">
                  <Link href={`/listings/${p.id}/edit`}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
                    <Pencil size={11} /> Edit
                  </Link>
                  <button
                    onClick={() => handleToggleSold(p.id, p.status)}
                    disabled={acting === p.id}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-orange-200 text-orange-700 hover:bg-orange-50 disabled:opacity-50">
                    {acting === p.id ? <Loader2 size={11} className="animate-spin" /> : <CheckSquare size={11} />}
                    {p.status === "sold" ? "Relist" : "Mark Sold"}
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={acting === p.id}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50">
                    <Trash2 size={11} /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Matching Buyers (want-ads) */}
      {matchingBuyers.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Megaphone size={16} className="text-indigo-600" />
              <h2 className="font-semibold text-gray-900">Matching Buyer Requests</h2>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">{matchingBuyers.length}</span>
            </div>
            <Link href="/want-ads" className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="space-y-2">
            {matchingBuyers.map((ad: any) => (
              <div key={ad.id} className="bg-white rounded-xl border border-indigo-100 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{ad.title}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {ad.species && <span className="bg-indigo-50 text-indigo-600 text-xs px-1.5 py-0.5 rounded-full capitalize">{ad.species}</span>}
                      {ad.breeds?.map((b: string) => <span key={b} className="bg-purple-50 text-purple-600 text-xs px-1.5 py-0.5 rounded-full">{b}</span>)}
                      {ad.budget_max && <span className="bg-green-50 text-green-600 text-xs px-1.5 py-0.5 rounded-full">≤₦{Number(ad.budget_max).toLocaleString()}</span>}
                    </div>
                    {ad.location && <p className="flex items-center gap-1 text-xs text-gray-400 mt-1"><MapPin size={10}/>{ad.location}</p>}
                  </div>
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs shrink-0">
                    {ad.buyer?.name?.[0] ?? "?"}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">By {ad.buyer?.name ?? "a buyer"}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent inquiries */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Recent Inquiries</h2>
          <Link href="/messages" className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
            View all <ChevronRight size={14} />
          </Link>
        </div>
        {dataLoading ? (
          <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-indigo-400" /></div>
        ) : threads.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-sm text-gray-400">No inquiries yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {threads.map((t: any) => (
              <Link key={t.id} href="/messages" className="flex items-center gap-3 p-4 hover:bg-gray-50">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-lg shrink-0">👤</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {t.buyer?.name ?? "Buyer"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {t.pet?.name ? `Re: ${t.pet.name} — ` : ""}{t.last_message ?? "No messages yet"}
                  </p>
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
