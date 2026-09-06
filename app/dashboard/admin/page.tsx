"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Users, List, AlertTriangle, Shield, ChevronRight, Bell, BarChart2, Loader2, CheckCircle, XCircle } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";

export default function AdminDashboardPage() {
  const { user, loading } = useAuth();
  const [platformStats, setPlatformStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [pendingListings, setPendingListings] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    Promise.all([
      api.get("/api/analytics"),
      api.get("/api/users?admin=true"),
      api.get("/api/pets?status=pending"),
      api.get("/api/notifications"),
    ]).then(([statsRes, usersRes, pendingRes, notifRes]) => {
      if (statsRes.error) setError(statsRes.error);
      setPlatformStats(statsRes.data ?? null);
      setUsers(usersRes.data ?? []);
      setPendingListings(pendingRes.data?.slice(0, 5) ?? []);
      setUnreadCount((notifRes.data ?? []).filter((n: any) => !n.is_read).length);
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

  if (user.role !== "administrator") {
    return (
      <div className="text-center py-10">
        <p className="text-gray-500 text-sm">Access restricted to administrators.</p>
      </div>
    );
  }

  const totalUsers = platformStats?.totalUsers ?? users.length;
  const totalPets = platformStats?.totalActivePets ?? 0;
  const buyers = users.filter((u) => u.role === "buyer").length;
  const sellers = users.filter((u) => u.role === "seller").length;
  const admins = users.filter((u) => u.role === "administrator").length;
  const recentUsers = users.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide">Administrator Dashboard</p>
          <h1 className="text-xl font-bold text-gray-900">Platform Overview 🛡️</h1>
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

      {/* Alert banner */}
      {pendingListings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center gap-3">
          <AlertTriangle size={18} className="text-yellow-600 shrink-0" />
          <p className="text-sm text-yellow-800">
            <span className="font-semibold">{pendingListings.length} listing{pendingListings.length > 1 ? "s" : ""}</span> pending review.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Users" value={totalUsers.toLocaleString()} icon={Users} color="indigo" />
        <StatCard label="Active Listings" value={totalPets} icon={List} color="green" />
        <StatCard label="Pending Listings" value={pendingListings.length} icon={AlertTriangle} color="yellow" />
        <StatCard label="Sellers" value={sellers} icon={Shield} color="purple" />
      </div>

      {/* User breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="font-semibold text-gray-900 text-sm mb-3">User Breakdown</h2>
        {dataLoading ? (
          <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-indigo-400" /></div>
        ) : (
          [
            { label: "Buyers", value: buyers, color: "bg-indigo-500" },
            { label: "Sellers", value: sellers, color: "bg-purple-500" },
            { label: "Admins", value: admins, color: "bg-gray-400" },
          ].map((item) => (
            <div key={item.label} className="mb-3 last:mb-0">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-600">{item.label}</span>
                <span className="font-semibold text-gray-900">{item.value.toLocaleString()}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full">
                <div
                  className={`h-2 rounded-full ${item.color} transition-all`}
                  style={{ width: totalUsers > 0 ? `${(item.value / totalUsers) * 100}%` : "0%" }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Platform breed pricing from analytics */}
      {platformStats?.breedPricing?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 text-sm">Top Breeds by Listings</h2>
            <Link href="/analytics" className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
              Full report <ChevronRight size={12} />
            </Link>
          </div>
          <div className="space-y-2">
            {platformStats.breedPricing.slice(0, 5).map((b: any) => (
              <div key={b.breed} className="flex items-center justify-between text-xs">
                <span className="text-gray-700 font-medium truncate flex-1">{b.breed}</span>
                <span className="text-gray-400 mx-3">{b.count} listing{b.count > 1 ? "s" : ""}</span>
                <span className="text-indigo-600 font-semibold">₦{b.avgPrice.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending listings for approval */}
      {!dataLoading && pendingListings.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900">Pending Listings</h2>
            <Link href="/admin" className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="space-y-2">
            {pendingListings.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.breed} · {p.seller?.name ?? "Unknown seller"}</p>
                    <p className="text-xs font-medium text-indigo-600 mt-0.5">₦{Number(p.price).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        await api.patch("/api/pets", { id: p.id, status: "active" });
                        setPendingListings((prev) => prev.filter((x) => x.id !== p.id));
                      }}
                      className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-green-700">
                      <CheckCircle size={12} /> Approve
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm(`Reject and delete "${p.name}"?`)) return;
                        await api.delete(`/api/pets?id=${p.id}`);
                        setPendingListings((prev) => prev.filter((x) => x.id !== p.id));
                      }}
                      className="flex items-center gap-1 border border-red-300 text-red-600 px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-50">
                      <XCircle size={12} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recent users */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Recent Users</h2>
          <Link href="/admin" className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
            Manage all <ChevronRight size={14} />
          </Link>
        </div>
        {dataLoading ? (
          <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-indigo-400" /></div>
        ) : recentUsers.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-3">No users found.</p>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {recentUsers.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 p-3">
                <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-700 shrink-0">
                  {(u.name ?? "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.name ?? "—"}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize shrink-0 ${
                  u.role === "administrator" ? "bg-red-100 text-red-700" :
                  u.role === "seller" ? "bg-purple-100 text-purple-700" : "bg-indigo-100 text-indigo-700"
                }`}>{u.role}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section>
        <h2 className="font-semibold text-gray-900 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/admin" className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50">
            <Shield size={18} className="text-indigo-600" />
            <span className="text-sm font-medium text-gray-700">Admin Panel</span>
          </Link>
          <Link href="/analytics" className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl p-4 hover:bg-gray-50">
            <BarChart2 size={18} className="text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Analytics</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
