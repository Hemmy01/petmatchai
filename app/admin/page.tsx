"use client";
import { useState, useEffect } from "react";
import { Users, List, AlertTriangle, CheckCircle, XCircle, Shield, Loader2, RefreshCw, Star, Trash2, Brain, Zap, Download, Search, Filter, Gavel, Tag, MessageSquare, X, Send } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";

const tabs = ["Overview", "Users", "Listings", "Verifications", "Reviews", "AI System", "Audit Log", "Disputes", "Payments", "Categories"] as const;
type Tab = typeof tabs[number];

type TxRow = { id: string; reference: string; amount: number; status: string; provider: string; created_at: string; buyer: { name: string; email: string } | null; seller: { name: string; email: string } | null; pet: { name: string } | null };
const TX_STATUS_STYLES: Record<string, string> = {
  pending: "bg-gray-100 text-gray-600",
  paid_escrow: "bg-indigo-100 text-indigo-700",
  released: "bg-green-100 text-green-700",
  refunded: "bg-amber-100 text-amber-700",
  cancelled: "bg-gray-100 text-gray-500",
};

type UserRow = { id: string; name: string; email: string; role: string; location: string; is_verified: boolean; status?: string; created_at: string };
type PetRow = { id: string; name: string; breed: string; price: number; status: string; seller: { name: string } | null };
type AuditRow = { id: string; action: string; entity_type: string; created_at: string; user: { name: string; email: string } | null; details: Record<string, unknown> };
type DisputeRow = { id: string; subject: string; description: string; status: string; created_at: string; offer_id?: string | null; thread_id?: string | null; escrow?: { reference: string; amount: number; status: string } | null; reporter: { name: string; email: string } | null; respondent: { name: string; email: string } | null };
type ConvoMsg = { id: string; sender_id: string; content: string; created_at: string; message_type?: string };
type ConvoState = { open: boolean; loading: boolean; subject: string; thread: { id: string; pet: { name: string } | null; buyer: { id: string; name: string } | null; seller: { id: string; name: string } | null } | null; messages: ConvoMsg[] };

function timeAgo(iso: string) {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("Overview");

  const [platform, setPlatform] = useState<{ totalActivePets: number; totalUsers: number } | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [pets, setPets] = useState<PetRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditRow[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [aiStats, setAiStats] = useState<any>(null);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [categories, setCategories] = useState<{ species: { name: string; count: number }[]; breeds: { name: string; species: string; count: number }[] } | null>(null);

  const [flushingCache, setFlushingCache] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [sending, setSending] = useState(false);

  // Audit log filter state
  const [auditFrom, setAuditFrom] = useState("");
  const [auditTo, setAuditTo] = useState("");
  const [auditAction, setAuditAction] = useState("");
  const [auditUser, setAuditUser] = useState("");
  const [auditExporting, setAuditExporting] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  // Dispute resolution state
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionText, setResolutionText] = useState("");
  const [resolutionSubmitting, setResolutionSubmitting] = useState(false);
  const [resolveOutcome, setResolveOutcome] = useState<"none" | "refund_buyer" | "release_seller">("none");
  const [convo, setConvo] = useState<ConvoState | null>(null);

  const [adminMsg, setAdminMsg] = useState("");
  const [adminMsgSending, setAdminMsgSending] = useState(false);

  async function openConversation(threadId: string, subject: string) {
    setAdminMsg("");
    setConvo({ open: true, loading: true, subject, thread: null, messages: [] });
    const res = await api.get(`/api/admin?type=disputeThread&threadId=${threadId}`);
    setConvo({ open: true, loading: false, subject, thread: res.thread ?? null, messages: res.messages ?? [] });
  }

  async function sendAdminInstruction() {
    if (!convo?.thread?.id || !adminMsg.trim() || adminMsgSending) return;
    setAdminMsgSending(true);
    const res = await api.patch("/api/admin", { type: "disputeMessage", threadId: convo.thread.id, content: adminMsg.trim() });
    if (res.data) {
      setConvo((prev) => (prev ? { ...prev, messages: [...prev.messages, res.data] } : prev));
      setAdminMsg("");
    }
    setAdminMsgSending(false);
  }

  // Categories search
  const [breedSearch, setBreedSearch] = useState("");

  async function loadAll() {
    setLoading(true);
    const [pubRes, usersRes, petsRes] = await Promise.all([
      api.get("/api/analytics"),
      api.get("/api/users?admin=true"),
      api.get("/api/pets?adminAll=true"),
    ]);
    setPlatform(pubRes.data ?? null);
    setUsers(usersRes.data ?? []);
    setPets(petsRes.data ?? []);
    setLoading(false);
  }

  async function loadAuditLogs(filters?: { from?: string; to?: string; action?: string; userId?: string }) {
    setAuditLoading(true);
    const params = new URLSearchParams({ type: "auditLogs" });
    if (filters?.from) params.set("from", filters.from);
    if (filters?.to) params.set("to", filters.to);
    if (filters?.action) params.set("action", filters.action);
    if (filters?.userId) params.set("userId", filters.userId);
    const res = await api.get(`/api/admin?${params.toString()}`);
    setAuditLogs(res.data ?? []);
    setAuditLoading(false);
  }

  useEffect(() => {
    if (!authLoading && user?.role === "administrator") loadAll();
    else if (!authLoading) setLoading(false);
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!user?.role) return;
    if (tab === "Audit Log" && auditLogs.length === 0) loadAuditLogs();
    if (tab === "Verifications" && verifications.length === 0) {
      api.get("/api/verify?status=pending").then((res) => setVerifications(res.data ?? []));
    }
    if (tab === "Reviews" && reviews.length === 0) {
      api.get("/api/reviews?adminAll=true").then((res) => setReviews(res.data ?? []));
    }
    if (tab === "AI System" && !aiStats) {
      api.get("/api/admin?type=aiStats").then((res) => setAiStats(res.data ?? null));
    }
    if (tab === "Disputes" && disputes.length === 0) {
      api.get("/api/admin?type=disputes").then((res) => setDisputes(res.data ?? []));
    }
    if (tab === "Payments" && transactions.length === 0) {
      api.get("/api/payments?admin=true").then((res) => setTransactions(res.data ?? []));
    }
    if (tab === "Categories" && !categories) {
      api.get("/api/admin?type=categories").then((res) => setCategories(res.data ?? null));
    }
  }, [tab]);

  async function doAction(fn: () => Promise<void>, successMsg: string) {
    setActionMsg("");
    try {
      await fn();
      setActionMsg(successMsg);
    } catch (e) {
      setActionMsg(`Error: ${e instanceof Error ? e.message : "Action failed"}`);
    }
    setTimeout(() => setActionMsg(""), 4000);
  }

  async function changeListingStatus(petId: string, status: string) {
    await api.patch("/api/pets", { id: petId, status });
    setPets((prev) => prev.map((p) => p.id === petId ? { ...p, status } : p));
  }

  async function rejectListing(petId: string) {
    // "Remove" deletes the listing — there is no 'rejected' pet status.
    await api.delete(`/api/pets?id=${petId}`);
    setPets((prev) => prev.filter((p) => p.id !== petId));
  }

  async function setUserStatus(userId: string, status: "active" | "suspended" | "disabled") {
    const res = await api.patch("/api/admin", { type: "setUserStatus", userId, status });
    if (res.error) throw new Error(res.error);
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, status } : u));
  }

  async function refundTransaction(reference: string) {
    const res = await api.post("/api/payments", { type: "refund", reference });
    if (res.error) throw new Error(res.error);
    setTransactions((prev) => prev.map((t) => t.reference === reference ? { ...t, status: "refunded" } : t));
  }

  async function changeRole(userId: string, role: string) {
    await api.patch("/api/admin", { type: "changeRole", userId, role });
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
  }

  async function deleteReview(reviewId: string) {
    const { supabase: sb } = await import("@/lib/supabase");
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(`/api/reviews?id=${reviewId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    });
    if (res.ok) {
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
      doAction(async () => {}, "Review removed.");
    }
  }

  async function exportAuditCsv() {
    setAuditExporting(true);
    const { utils, writeFile } = await import("xlsx");
    const rows = auditLogs.map((log) => ({
      "Timestamp": new Date(log.created_at).toLocaleString(),
      "User": log.user?.name ?? "System",
      "Email": log.user?.email ?? "",
      "Action": log.action,
      "Entity Type": log.entity_type ?? "",
      "Details": log.details ? JSON.stringify(log.details) : "",
    }));
    const ws = utils.json_to_sheet(rows);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, "Audit Log");
    writeFile(wb, `PetMatchAI_AuditLog_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setAuditExporting(false);
  }

  async function resolveDispute(disputeId: string) {
    if (!resolutionText.trim()) return;
    setResolutionSubmitting(true);
    const res = await api.patch("/api/admin", { type: "resolveDispute", disputeId, resolution: resolutionText.trim(), outcome: resolveOutcome });
    setResolutionSubmitting(false);
    if (!res.error) {
      setDisputes((prev) => prev.map((d) => d.id === disputeId ? { ...d, status: "resolved", escrow: res.settlement ? null : d.escrow } : d));
      setResolvingId(null);
      setResolutionText("");
      setResolveOutcome("none");
      const msg = res.settlement === "refunded" ? "Dispute resolved & buyer refunded."
        : res.settlement === "released" ? "Dispute resolved & funds released to seller."
        : "Dispute resolved.";
      doAction(async () => {}, msg);
    }
  }

  if (authLoading || loading) {
    return <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-indigo-600" /></div>;
  }

  if (!user || user.role !== "administrator") {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <Shield size={40} className="text-gray-300 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Admin access only</h2>
        <p className="text-sm text-gray-500">This panel is restricted to administrator accounts.</p>
      </div>
    );
  }

  const buyers = users.filter((u) => u.role === "buyer").length;
  const sellers = users.filter((u) => u.role === "seller").length;
  const admins = users.filter((u) => u.role === "administrator").length;
  const pendingPets = pets.filter((p) => p.status === "pending");
  const pendingVerifs = verifications.filter((v) => v.status === "pending");
  const activePets = pets.filter((p) => p.status === "active");
  const pendingDisputes = disputes.filter((d) => d.status === "pending").length;
  const filteredBreeds = (categories?.breeds ?? []).filter((b) =>
    !breedSearch || b.name.toLowerCase().includes(breedSearch.toLowerCase()) || b.species.toLowerCase().includes(breedSearch.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield size={24} className="text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Panel</h1>
            <p className="text-sm text-gray-500">Platform administration & moderation</p>
          </div>
        </div>
        <button onClick={loadAll} disabled={loading}
          className="flex items-center gap-1.5 text-xs border border-gray-300 text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {actionMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2.5 rounded-xl mb-4">
          {actionMsg}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${tab === t ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
            {t}
            {t === "Listings" && pendingPets.length > 0 && (
              <span className="ml-1.5 bg-yellow-500 text-white text-[10px] rounded-full px-1.5">{pendingPets.length}</span>
            )}
            {t === "Verifications" && pendingVerifs.length > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-[10px] rounded-full px-1.5">{pendingVerifs.length}</span>
            )}
            {t === "Disputes" && pendingDisputes > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white text-[10px] rounded-full px-1.5">{pendingDisputes}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {tab === "Overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={(platform?.totalUsers ?? users.length).toLocaleString()} icon={Users} color="indigo" />
            <StatCard label="Active Listings" value={platform?.totalActivePets ?? activePets.length} icon={List} color="green" />
            <StatCard label="Pending Listings" value={pendingPets.length} icon={AlertTriangle} color="yellow" />
            <StatCard label="Sellers" value={sellers} icon={Shield} color="purple" />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-4">User Breakdown</h3>
            {[
              { label: "Buyers", value: buyers, color: "bg-indigo-500" },
              { label: "Sellers", value: sellers, color: "bg-purple-500" },
              { label: "Admins", value: admins, color: "bg-gray-400" },
            ].map((item) => {
              const total = users.length || 1;
              return (
                <div key={item.label} className="mb-3 last:mb-0">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{item.label}</span>
                    <span className="font-semibold text-gray-900">{item.value}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div className={`h-2 rounded-full ${item.color} transition-all`}
                      style={{ width: `${(item.value / total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">System Announcement</h3>
            <p className="text-xs text-gray-500 mb-3">Broadcast a notification to all users on the platform.</p>
            <textarea rows={3} value={announcement} onChange={(e) => setAnnouncement(e.target.value)}
              placeholder="Type announcement text…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2 resize-none" />
            <button
              disabled={!announcement.trim() || sending}
              onClick={async () => {
                setSending(true);
                const res = await api.post("/api/admin", { type: "announcement", message: announcement.trim() });
                setSending(false);
                if (res.error) {
                  setActionMsg(`Error: ${res.error}`);
                } else {
                  setAnnouncement("");
                  doAction(async () => {}, `Announcement sent to ${res.sent ?? "all"} users.`);
                }
              }}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {sending && <Loader2 size={13} className="animate-spin" />}
              Send Announcement
            </button>
          </div>
        </div>
      )}

      {/* ── Users ── */}
      {tab === "Users" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Name / Email</th>
                  <th className="text-left px-4 py-3">Role</th>
                  <th className="text-left px-4 py-3">Location</th>
                  <th className="text-left px-4 py-3">Verified</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-gray-400 text-sm">No users found.</td></tr>
                ) : users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{u.name ?? "—"}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => doAction(() => changeRole(u.id, e.target.value), `Role updated to ${e.target.value}`)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        <option value="buyer">buyer</option>
                        <option value="seller">seller</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{u.location ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.is_verified ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {u.is_verified ? "Verified" : "Unverified"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        const st = u.status ?? "active";
                        const styles: Record<string, string> = {
                          active: "bg-green-100 text-green-700",
                          suspended: "bg-amber-100 text-amber-700",
                          disabled: "bg-red-100 text-red-700",
                        };
                        return <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${styles[st]}`}>{st}</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {u.id !== user.id && u.role !== "administrator" && (
                        <div className="flex items-center gap-3">
                          {(u.status ?? "active") === "active" && (
                            <button
                              onClick={() => doAction(() => setUserStatus(u.id, "suspended"), "User suspended — they can no longer sign in.")}
                              className="text-xs text-amber-600 hover:underline">
                              Suspend
                            </button>
                          )}
                          {(u.status ?? "active") !== "active" && (
                            <button
                              onClick={() => doAction(() => setUserStatus(u.id, "active"), "User reactivated.")}
                              className="text-xs text-green-600 hover:underline">
                              Reactivate
                            </button>
                          )}
                          {(u.status ?? "active") !== "disabled" && (
                            <button
                              onClick={() => { if (confirm(`Permanently disable ${u.name ?? u.email}? They will be banned from signing in. You can still reactivate later if needed.`)) doAction(() => setUserStatus(u.id, "disabled"), "Account permanently disabled."); }}
                              className="text-xs text-red-500 hover:underline">
                              Disable
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Listings ── */}
      {tab === "Listings" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Pet</th>
                  <th className="text-left px-4 py-3">Seller</th>
                  <th className="text-left px-4 py-3">Price</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pets.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-6 text-gray-400 text-sm">No listings found.</td></tr>
                ) : pets.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <Link href={`/listings/${p.id}`} className="hover:text-indigo-600">
                        {p.name}
                      </Link>
                      <span className="text-gray-400 font-normal"> ({p.breed})</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.seller?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-indigo-600 font-semibold">₦{Number(p.price).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.status === "active" ? "bg-green-100 text-green-700" :
                        p.status === "pending" ? "bg-yellow-100 text-yellow-600" :
                        p.status === "sold" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-600"
                      }`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {p.status === "pending" && (
                          <button
                            onClick={() => doAction(() => changeListingStatus(p.id, "active"), `${p.name} approved.`)}
                            className="flex items-center gap-0.5 text-xs text-green-600 hover:underline">
                            <CheckCircle size={11} /> Approve
                          </button>
                        )}
                        <button
                          onClick={() => { if (confirm(`Remove "${p.name}"? This permanently deletes the listing.`)) doAction(() => rejectListing(p.id), `${p.name} removed.`); }}
                          className="flex items-center gap-0.5 text-xs text-red-500 hover:underline">
                          <XCircle size={11} /> Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Verifications ── */}
      {tab === "Verifications" && (
        <div className="space-y-4">
          {verifications.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <CheckCircle size={32} className="text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No pending identity verification requests.</p>
            </div>
          ) : verifications.map((v: any) => {
            const idTypeLabels: Record<string, string> = {
              passport: "International Passport",
              national_id: "National ID Card (NIN)",
              drivers_license: "Driver's License",
              cac_certificate: "CAC Certificate",
            };
            return (
              <div key={v.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-start gap-4 flex-wrap">
                  {/* ID document photo */}
                  <div className="flex flex-col gap-2 shrink-0">
                    <a href={v.id_image_url} target="_blank" rel="noreferrer">
                      <img src={v.id_image_url} alt="ID Document"
                        className="w-36 h-28 rounded-xl object-cover border border-gray-200 hover:opacity-90 transition-opacity" />
                      <p className="text-[11px] text-indigo-600 text-center mt-1">ID Document ↗</p>
                    </a>
                    {v.selfie_url && (
                      <a href={v.selfie_url} target="_blank" rel="noreferrer">
                        <img src={v.selfie_url} alt="Selfie"
                          className="w-36 h-28 rounded-xl object-cover border border-gray-200 hover:opacity-90 transition-opacity" />
                        <p className="text-[11px] text-indigo-600 text-center mt-1">Selfie ↗</p>
                      </a>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap mb-3">
                      <div>
                        <p className="font-semibold text-gray-900">{v.user?.name ?? "—"}</p>
                        <p className="text-xs text-gray-500">{v.user?.email}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{v.user?.location ?? "Location not set"} · {v.user?.role}</p>
                      </div>
                      <span className="text-xs text-gray-400">{timeAgo(v.created_at)}</span>
                    </div>

                    <div className="bg-indigo-50 rounded-lg px-3 py-2 mb-3 inline-flex items-center gap-2">
                      <Shield size={13} className="text-indigo-600" />
                      <div>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wide font-medium">Document Type</p>
                        <p className="text-sm font-bold text-indigo-700">{idTypeLabels[v.id_type] ?? v.id_type}</p>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Admin note (optional — shown to user if rejected)</label>
                      <input
                        placeholder="e.g. Document unclear, please resubmit with better lighting"
                        className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        onChange={(e) => setAdminNote(e.target.value)}
                      />
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={async () => {
                          await api.patch("/api/verify", { requestId: v.id, status: "approved", adminNote });
                          setVerifications((prev) => prev.filter((x) => x.id !== v.id));
                          doAction(async () => {}, `${v.user?.name ?? "User"} identity verified. Verified Seller badge applied.`);
                        }}
                        className="flex items-center gap-1 bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-green-700">
                        <CheckCircle size={13} /> Approve — Mark Verified
                      </button>
                      <button
                        onClick={async () => {
                          await api.patch("/api/verify", { requestId: v.id, status: "rejected", adminNote });
                          setVerifications((prev) => prev.filter((x) => x.id !== v.id));
                          doAction(async () => {}, "Verification rejected. Seller notified.");
                        }}
                        className="flex items-center gap-1 border border-red-300 text-red-600 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-red-50">
                        <XCircle size={13} /> Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Reviews ── */}
      {tab === "Reviews" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Reviewer</th>
                  <th className="text-left px-4 py-3">Seller</th>
                  <th className="text-left px-4 py-3">Rating</th>
                  <th className="text-left px-4 py-3">Comment</th>
                  <th className="text-left px-4 py-3">Verified</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reviews.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400 text-sm">No reviews found.</td></tr>
                ) : reviews.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 text-xs">{r.reviewer?.name ?? "—"}</p>
                      <span className="text-[11px] text-gray-400">{timeAgo(r.created_at)}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{r.seller?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={11} className={i < r.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"} />
                        ))}
                        <span className="text-[10px] text-gray-500 ml-1">{r.rating}/5</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px] truncate">{r.comment ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.is_verified ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {r.is_verified ? "Verified" : "Unverified"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => doAction(() => deleteReview(r.id), "Review removed.")}
                        className="flex items-center gap-0.5 text-xs text-red-500 hover:underline">
                        <Trash2 size={11} /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── AI System ── */}
      {tab === "AI System" && (
        <div className="space-y-5">
          {!aiStats ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-indigo-500" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-1">Cached Matches</p>
                  <p className="text-2xl font-bold text-indigo-600">{aiStats.totalMatches.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-1">Avg Match Score</p>
                  <p className="text-2xl font-bold text-green-600">{aiStats.avgScore}<span className="text-sm font-normal text-gray-400">/100</span></p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-1">Buyers with Prefs</p>
                  <p className="text-2xl font-bold text-purple-600">{aiStats.buyersWithPrefs}</p>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                  <p className="text-xs text-gray-500 mb-1">Buyers Scored</p>
                  <p className="text-2xl font-bold text-gray-700">{aiStats.buyersWithCache}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                      <Brain size={20} className="text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Groq AI — llama-3.3-70b-versatile</p>
                      <p className="text-xs text-gray-500">Recommendation summaries · Analytics executive summary · Match scoring runs on the deterministic engine (cached in ai_matches)</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full font-medium">
                      <Zap size={11} /> Active
                    </span>
                    <button
                      disabled={flushingCache}
                      onClick={async () => {
                        if (!confirm("This will delete all cached AI scores. Buyers will see fresh scores on next visit. Continue?")) return;
                        setFlushingCache(true);
                        const { supabase: sb } = await import("@/lib/supabase");
                        const { data: { session } } = await sb.auth.getSession();
                        await fetch("/api/admin?type=aiCache", {
                          method: "DELETE",
                          headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
                        });
                        setFlushingCache(false);
                        setAiStats((prev: any) => ({ ...prev, totalMatches: 0, avgScore: 0, buyersWithCache: 0, topPets: [], recentMatches: [] }));
                        doAction(async () => {}, "AI cache flushed. Fresh scores will be computed on next buyer visit.");
                      }}
                      className="flex items-center gap-1.5 text-xs border border-red-200 text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50">
                      {flushingCache ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      Flush AI Cache
                    </button>
                  </div>
                </div>
              </div>

              {aiStats.topPets.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-900 mb-3 text-sm">Top AI-Scored Pets</h3>
                  <div className="space-y-2">
                    {aiStats.topPets.map((m: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{m.pet?.name ?? "—"} <span className="text-gray-400 text-xs">({m.pet?.breed})</span></span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-gray-100 rounded-full">
                            <div className="h-1.5 bg-indigo-500 rounded-full" style={{ width: `${m.score}%` }} />
                          </div>
                          <span className="text-xs font-semibold text-indigo-600 w-8 text-right">{m.score}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {aiStats.recentMatches.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-900 text-sm">Recent Match Computations</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500 text-xs">
                        <tr>
                          <th className="text-left px-4 py-2">Buyer</th>
                          <th className="text-left px-4 py-2">Pet</th>
                          <th className="text-left px-4 py-2">Score</th>
                          <th className="text-left px-4 py-2">Cached</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {aiStats.recentMatches.map((m: any) => (
                          <tr key={`${m.buyer_id}-${m.pet_id}`} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-700">{m.buyer?.name ?? "—"}</td>
                            <td className="px-4 py-2 text-gray-600 text-xs">{m.pet?.name} <span className="text-gray-400">({m.pet?.breed})</span></td>
                            <td className="px-4 py-2">
                              <span className={`text-xs font-bold ${m.score >= 70 ? "text-green-600" : m.score >= 40 ? "text-yellow-600" : "text-red-500"}`}>
                                {m.score}/100
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-400 text-xs">{timeAgo(m.updated_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Audit Log ── */}
      {tab === "Audit Log" && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">From</label>
                <input type="date" value={auditFrom} onChange={(e) => setAuditFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">To</label>
                <input type="date" value={auditTo} onChange={(e) => setAuditTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">Action type</label>
                <input placeholder="e.g. suspend_user" value={auditAction} onChange={(e) => setAuditAction(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">User ID</label>
                <input placeholder="UUID…" value={auditUser} onChange={(e) => setAuditUser(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadAuditLogs({ from: auditFrom || undefined, to: auditTo || undefined, action: auditAction || undefined, userId: auditUser || undefined })}
                disabled={auditLoading}
                className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-60">
                {auditLoading ? <Loader2 size={11} className="animate-spin" /> : <Filter size={11} />}
                Apply Filters
              </button>
              <button
                onClick={() => { setAuditFrom(""); setAuditTo(""); setAuditAction(""); setAuditUser(""); loadAuditLogs(); }}
                className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                Clear
              </button>
              <button onClick={() => loadAuditLogs({ from: auditFrom || undefined, to: auditTo || undefined, action: auditAction || undefined, userId: auditUser || undefined })}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                <RefreshCw size={11} /> Refresh
              </button>
              {auditLogs.length > 0 && (
                <button onClick={exportAuditCsv} disabled={auditExporting}
                  className="ml-auto flex items-center gap-1.5 text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                  {auditExporting ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                  Export CSV
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="text-left px-4 py-3">When</th>
                    <th className="text-left px-4 py-3">User</th>
                    <th className="text-left px-4 py-3">Action</th>
                    <th className="text-left px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditLoading ? (
                    <tr><td colSpan={4} className="text-center py-8">
                      <Loader2 size={18} className="animate-spin text-indigo-400 mx-auto mb-1" />
                      <p className="text-xs text-gray-400">Loading…</p>
                    </td></tr>
                  ) : auditLogs.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-gray-400 text-sm">No audit logs found.</td></tr>
                  ) : auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{timeAgo(log.created_at)}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-xs">{log.user?.name ?? "System"}</p>
                        <p className="text-gray-400 text-[11px]">{log.user?.email ?? ""}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded font-mono">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {log.entity_type && <span className="capitalize">{log.entity_type}</span>}
                        {log.details && Object.keys(log.details).length > 0
                          ? " · " + JSON.stringify(log.details)
                          : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Disputes ── */}
      {tab === "Disputes" && (
        <div className="space-y-4">
          {disputes.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
              <Gavel size={32} className="text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No disputes filed.</p>
              <p className="text-xs text-gray-400 mt-1">Buyer-seller disputes will appear here when reported.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      <th className="text-left px-4 py-3">Subject</th>
                      <th className="text-left px-4 py-3">Reporter</th>
                      <th className="text-left px-4 py-3">Respondent</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Filed</th>
                      <th className="text-left px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {disputes.map((d) => (
                      <>
                        <tr key={d.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">{d.subject}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">{d.reporter?.name ?? "—"}<br /><span className="text-gray-400">{d.reporter?.email}</span></td>
                          <td className="px-4 py-3 text-xs text-gray-600">{d.respondent?.name ?? "—"}<br /><span className="text-gray-400">{d.respondent?.email}</span></td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.status === "resolved" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                              {d.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">{timeAgo(d.created_at)}</td>
                          <td className="px-4 py-3">
                            {d.status === "pending" && (
                              <button
                                onClick={() => { setResolvingId(d.id); setResolutionText(""); setResolveOutcome("none"); }}
                                className="text-xs text-indigo-600 hover:underline font-medium">
                                Resolve
                              </button>
                            )}
                            {d.thread_id && (
                              <button
                                onClick={() => openConversation(d.thread_id!, d.subject)}
                                className="flex items-center gap-1 mt-1 text-xs text-gray-600 hover:text-indigo-600 hover:underline">
                                <MessageSquare size={11} /> View chat
                              </button>
                            )}
                            {d.escrow && (
                              <span className="block mt-1 text-[10px] text-indigo-500 font-medium">🔒 ₦{d.escrow.amount.toLocaleString()} in escrow</span>
                            )}
                          </td>
                        </tr>
                        {resolvingId === d.id && (
                          <tr key={`${d.id}-resolve`}>
                            <td colSpan={6} className="px-4 py-3 bg-indigo-50 border-t border-indigo-100">
                              <div className="flex items-start gap-3">
                                <textarea
                                  rows={2}
                                  value={resolutionText}
                                  onChange={(e) => setResolutionText(e.target.value)}
                                  placeholder="Enter resolution decision…"
                                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                                />
                                <div className="flex flex-col gap-2 shrink-0">
                                  <button
                                    onClick={() => resolveDispute(d.id)}
                                    disabled={!resolutionText.trim() || resolutionSubmitting}
                                    className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">
                                    {resolutionSubmitting ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle size={11} />}
                                    Mark Resolved
                                  </button>
                                  <button onClick={() => { setResolvingId(null); setResolveOutcome("none"); }}
                                    className="text-xs text-gray-500 hover:text-gray-700 text-center">
                                    Cancel
                                  </button>
                                </div>
                              </div>
                              {d.escrow && d.escrow.status === "paid_escrow" && (
                                <div className="mt-2.5">
                                  <p className="text-xs font-medium text-gray-600 mb-1.5">
                                    🔒 ₦{d.escrow.amount.toLocaleString()} is held in escrow — settle it for the parties:
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {([
                                      { v: "none", label: "No settlement", desc: "Just record a decision", cls: "border-gray-200 text-gray-600" },
                                      { v: "refund_buyer", label: "Refund the buyer", desc: "Return funds to buyer", cls: "border-amber-300 text-amber-800 bg-amber-50" },
                                      { v: "release_seller", label: "Release to seller", desc: "Pay the seller", cls: "border-green-300 text-green-800 bg-green-50" },
                                    ] as const).map((opt) => (
                                      <button key={opt.v} type="button"
                                        onClick={() => setResolveOutcome(opt.v)}
                                        className={`text-left rounded-lg border px-3 py-2 transition-all ${opt.cls} ${resolveOutcome === opt.v ? "ring-2 ring-indigo-500" : "opacity-80 hover:opacity-100"}`}>
                                        <span className="block text-xs font-semibold">{opt.label}</span>
                                        <span className="block text-[10px]">{opt.desc}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Payments ── */}
      {tab === "Payments" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Escrow Payments</p>
            <p className="text-xs text-gray-400 mt-0.5">Funds paid by buyers are held in escrow until handover is confirmed. Refund an escrowed payment to reverse it (e.g. after a dispute).</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Buyer → Seller</th>
                  <th className="text-left px-4 py-3">Pet</th>
                  <th className="text-left px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Via</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-6 text-gray-400 text-sm">No payments yet.</td></tr>
                ) : transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="text-gray-900">{t.buyer?.name ?? "—"} <span className="text-gray-400">→</span> {t.seller?.name ?? "—"}</p>
                      <p className="text-[11px] text-gray-400">{t.reference}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{t.pet?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">₦{Number(t.amount).toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 capitalize">{t.provider}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TX_STATUS_STYLES[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {t.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{timeAgo(t.created_at)}</td>
                    <td className="px-4 py-3">
                      {t.status === "paid_escrow" && (
                        <button
                          onClick={() => { if (confirm(`Refund ₦${Number(t.amount).toLocaleString()} to ${t.buyer?.name ?? "the buyer"}? This reverses the escrowed payment.`)) doAction(() => refundTransaction(t.reference), "Payment refunded."); }}
                          className="text-xs text-amber-600 hover:underline">
                          Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Categories ── */}
      {tab === "Categories" && (
        <div className="space-y-4">
          {!categories ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-indigo-500" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Species breakdown */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Tag size={16} className="text-indigo-600" />
                  <h3 className="font-semibold text-gray-900">Species Breakdown</h3>
                </div>
                {categories.species.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No listings yet.</p>
                ) : (
                  <div className="space-y-3">
                    {categories.species.map((s) => {
                      const total = categories.species.reduce((sum, x) => sum + x.count, 0) || 1;
                      return (
                        <div key={s.name}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="capitalize text-gray-700">{s.name}</span>
                            <span className="font-semibold text-gray-900">{s.count} listing{s.count !== 1 ? "s" : ""}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full">
                            <div className="h-2 bg-indigo-500 rounded-full transition-all"
                              style={{ width: `${(s.count / total) * 100}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Breed directory */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Tag size={16} className="text-purple-600" />
                  <h3 className="font-semibold text-gray-900">Breed Directory</h3>
                </div>
                <div className="relative mb-3">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={breedSearch}
                    onChange={(e) => setBreedSearch(e.target.value)}
                    placeholder="Search breeds…"
                    className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="max-h-72 overflow-y-auto space-y-1">
                  {filteredBreeds.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No breeds match.</p>
                  ) : filteredBreeds.map((b) => (
                    <div key={b.name} className="flex items-center justify-between py-1.5 px-2 hover:bg-gray-50 rounded-lg">
                      <Link
                        href={`/listings?breed=${encodeURIComponent(b.name)}`}
                        target="_blank"
                        className="text-sm text-gray-800 hover:text-indigo-600 hover:underline">
                        {b.name}
                      </Link>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] capitalize text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{b.species}</span>
                        <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{b.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Read-only disputed-conversation viewer */}
      {convo?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setConvo(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-3 border-b border-gray-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5"><MessageSquare size={14} className="text-indigo-600" /> Disputed conversation</p>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {convo.thread?.buyer?.name ?? "Buyer"} ↔ {convo.thread?.seller?.name ?? "Seller"}
                  {convo.thread?.pet?.name ? ` · Re: ${convo.thread.pet.name}` : ""}
                </p>
              </div>
              <button onClick={() => setConvo(null)} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
              {convo.loading ? (
                <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin text-indigo-400" /></div>
              ) : convo.messages.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">No messages in this conversation.</p>
              ) : (
                convo.messages.map((m) => {
                  if (m.message_type === "admin_note" || m.message_type === "admin_decision") {
                    const isDecision = m.message_type === "admin_decision";
                    return (
                      <div key={m.id} className="flex justify-center">
                        <div className={`max-w-[90%] rounded-xl px-3 py-2 text-sm border ${isDecision ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-indigo-50 border-indigo-200 text-indigo-900"}`}>
                          <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5 flex items-center gap-1">
                            <Shield size={11} /> {isDecision ? "Admin decision" : "You (Admin)"}
                          </p>
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          <p className="text-[10px] mt-1 opacity-70">{new Date(m.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    );
                  }
                  const isBuyer = m.sender_id === convo.thread?.buyer?.id;
                  const name = isBuyer ? convo.thread?.buyer?.name : convo.thread?.seller?.name;
                  return (
                    <div key={m.id} className={`flex ${isBuyer ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${isBuyer ? "bg-white border border-gray-200 text-gray-800" : "bg-indigo-600 text-white"}`}>
                        <p className={`text-[10px] font-semibold mb-0.5 ${isBuyer ? "text-gray-400" : "text-indigo-200"}`}>{name ?? "Unknown"}</p>
                        <p className="whitespace-pre-wrap break-words">{m.content}</p>
                        <p className={`text-[10px] mt-1 ${isBuyer ? "text-gray-400" : "text-indigo-200"}`}>{new Date(m.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {!convo.loading && convo.thread && (
              <div className="px-4 py-3 border-t border-gray-100 bg-white">
                <p className="text-[11px] text-gray-400 mb-1.5 flex items-center gap-1"><Shield size={11} className="text-indigo-500" /> Post an instruction — both parties see it as PetMatch Admin.</p>
                <div className="flex items-end gap-2">
                  <textarea
                    value={adminMsg}
                    onChange={(e) => setAdminMsg(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAdminInstruction(); } }}
                    rows={2}
                    placeholder="Give the buyer and seller instructions…"
                    className="flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={sendAdminInstruction}
                    disabled={!adminMsg.trim() || adminMsgSending}
                    className="shrink-0 bg-indigo-600 text-white rounded-xl px-3 py-2.5 text-sm font-semibold flex items-center gap-1 disabled:opacity-50 hover:bg-indigo-700 transition-colors"
                  >
                    {adminMsgSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  </button>
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">To post the <span className="font-medium text-amber-700">final decision</span>, use “Resolve” on the dispute — it’s recorded in this chat for both parties.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
