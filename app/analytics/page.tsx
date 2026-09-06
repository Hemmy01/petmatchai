"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { TrendingUp, BarChart2, Users, List, Loader2, RefreshCw, Printer, Download, Clock, Percent, Filter, ChevronDown, ChevronUp, Brain, Zap, FileText } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import type { DemandForecast, PriceBand } from "@/lib/forecast";

type BreedStat = { breed: string; avgPrice: number; count: number };
type SellerData = {
  totalListings: number;
  totalViews: number;
  totalInquiries: number;
  totalSold: number;
  avgRating: number;
  avgDaysToSell: number | null;
  conversionRate: number | null;
  listings: { id: string; name: string; breed: string; price: number; views: number; inquiries: number; status: string }[];
};

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();

  const [platform, setPlatform] = useState<{ totalActivePets: number; totalUsers: number; breedPricing: BreedStat[] } | null>(null);
  const [seller, setSeller] = useState<SellerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [geoData, setGeoData] = useState<{ location: string; count: number }[]>([]);
  const [aiSummary, setAiSummary] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [forecast, setForecast] = useState<DemandForecast | null>(null);
  const [priceBands, setPriceBands] = useState<PriceBand[]>([]);

  // Custom report builder state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportFrom, setReportFrom] = useState(() => new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [reportTo, setReportTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportSpecies, setReportSpecies] = useState("");
  const [reportStatus, setReportStatus] = useState("all");
  const [reportSort, setReportSort] = useState("views");
  const [reportData, setReportData] = useState<any[] | null>(null);
  const [reportSummary, setReportSummary] = useState<{ totalPets: number; totalViews: number; totalInquiries: number; avgPrice: number } | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  async function load() {
    setLoading(true);
    const requests: Promise<any>[] = [
      api.get("/api/analytics"),
      user?.role === "seller" || user?.role === "administrator"
        ? api.get(`/api/analytics?sellerId=${user.id}`)
        : Promise.resolve({ data: null }),
      api.get("/api/analytics?forecast=true").catch(() => null),
    ];
    if (user?.role === "administrator") {
      requests.push(api.get("/api/analytics?geo=true"));
    }
    const [pubRes, selRes, fcRes, geoRes] = await Promise.all(requests);
    setPlatform(pubRes.data ?? null);
    setSeller(selRes.data ?? null);
    setForecast(fcRes?.forecast ?? null);
    setPriceBands(fcRes?.priceBands ?? []);
    if (geoRes) setGeoData(geoRes.data ?? []);
    setLoading(false);
  }

  async function generateSummary() {
    setSummaryLoading(true);
    setAiSummary("");
    try {
      const { supabase: sb } = await import("@/lib/supabase");
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch("/api/analytics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? ""}`,
        },
        body: JSON.stringify({
          totalListings: platform?.totalActivePets ?? 0,
          totalUsers: platform?.totalUsers ?? 0,
          topBreed: breeds[0]?.breed ?? "",
          avgPrice: breeds.length ? Math.round(breeds.reduce((s, b) => s + b.avgPrice, 0) / breeds.length) : 0,
          totalSold: seller?.totalSold ?? 0,
          conversionRate: seller?.conversionRate ?? null,
        }),
      });
      const data = await res.json();
      setAiSummary(data.summary ?? "");
    } catch {
      setAiSummary("Failed to generate summary. Please try again.");
    }
    setSummaryLoading(false);
  }

  const isAdmin = user?.role === "administrator";
  const isSeller = user?.role === "seller";

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, user?.id]);

  if (authLoading || loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={28} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  const breeds = platform?.breedPricing ?? [];
  const maxPrice = Math.max(...breeds.map((b) => b.avgPrice), 1);
  const maxCount = Math.max(...breeds.map((b) => b.count), 1);

  // Seller listing chart data
  const topListings = (seller?.listings ?? [])
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 8);
  const maxViews = Math.max(...topListings.map((l) => l.views ?? 0), 1);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isAdmin ? "Platform Analytics" : "My Analytics"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {isAdmin
              ? "Platform-wide insights, user stats, and all listings"
              : "Your listing performance, market pricing trends, and insights"}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 text-xs border border-gray-300 text-gray-600 px-3 py-2 rounded-xl hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {/* Admin-only: platform-wide totals */}
      {isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Active Listings" value={platform?.totalActivePets ?? 0} icon={List} color="indigo" />
          <StatCard label="Total Users" value={platform?.totalUsers ?? 0} icon={Users} color="purple" />
          <StatCard label="Breeds Listed" value={breeds.length} icon={TrendingUp} color="green" />
          <StatCard label="Avg. Rating" value="—" icon={BarChart2} color="yellow" />
        </div>
      )}

      {/* Seller stats — own account only */}
      {seller && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <StatCard label="My Listings" value={seller.totalListings} icon={List} color="indigo" />
            <StatCard label="Total Views" value={seller.totalViews} icon={TrendingUp} color="green" />
            <StatCard label="Total Inquiries" value={seller.totalInquiries} icon={BarChart2} color="yellow" />
            <StatCard label="Pets Sold" value={seller.totalSold} icon={Users} color="purple" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard label="Avg. Rating" value={seller.avgRating > 0 ? `${seller.avgRating}/5` : "—"} icon={BarChart2} color="yellow" />
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Clock size={14} />
                <span className="text-xs font-medium">Avg. Time to Sell</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {seller.avgDaysToSell !== null ? `${seller.avgDaysToSell}d` : "—"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">days per pet sold</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <Percent size={14} />
                <span className="text-xs font-medium">Conversion Rate</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {seller.conversionRate !== null ? `${seller.conversionRate}%` : "—"}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">listings that sold</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-500 mb-1">
                <TrendingUp size={14} />
                <span className="text-xs font-medium">Active Now</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {seller.listings.filter((l) => l.status === "active").length}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">of {seller.totalListings} listings</p>
            </div>
          </div>
        </>
      )}

      {/* Buyer with no seller data */}
      {!seller && !isAdmin && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Breeds Listed" value={breeds.length} icon={TrendingUp} color="green" />
        </div>
      )}

      {/* AI Executive Summary */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Brain size={16} className="text-indigo-600" />
              AI Executive Summary
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">Groq AI analysis of current platform performance</p>
          </div>
          <button
            onClick={generateSummary}
            disabled={summaryLoading}
            className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
            {summaryLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {summaryLoading ? "Generating..." : aiSummary ? "Regenerate" : "Generate Summary"}
          </button>
        </div>
        {aiSummary && (
          <div className="mt-4 bg-white rounded-lg p-4 border border-indigo-100">
            <p className="text-sm text-gray-700 leading-relaxed">{aiSummary}</p>
          </div>
        )}
      </div>

      {/* Demand Trends & Forecast */}
      {forecast && (() => {
        const cols = forecast.listings.map((p, i) => ({
          label: p.label,
          listings: p.count,
          offers: forecast.offers[i]?.count ?? 0,
          projected: false,
        }));
        const proj = {
          label: "Next",
          listings: forecast.projection.listings ?? 0,
          offers: forecast.projection.offers ?? 0,
          projected: true,
        };
        const hasProjection = forecast.projection.offers !== null || forecast.projection.listings !== null;
        const all = hasProjection ? [...cols, proj] : cols;
        const maxVal = Math.max(1, ...all.flatMap((c) => [c.listings, c.offers]));
        const mo = forecast.momentum;
        const moStyle =
          mo === "rising" ? { cls: "bg-green-50 text-green-700", txt: "▲ Rising demand" } :
          mo === "falling" ? { cls: "bg-red-50 text-red-600", txt: "▼ Cooling demand" } :
          mo === "flat" ? { cls: "bg-gray-100 text-gray-600", txt: "→ Steady demand" } :
          { cls: "bg-gray-100 text-gray-400", txt: "Not enough data yet" };
        return (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <TrendingUp size={16} className="text-indigo-600" /> Demand Trends &amp; Forecast
              </h2>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${moStyle.cls}`}>{moStyle.txt}</span>
            </div>
            <p className="text-xs text-gray-400 mb-4">New listings vs. buyer offers over the last 6 months · projected next month</p>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-500" /> New listings</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-green-500" /> Buyer offers</span>
              {hasProjection && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-300 border border-dashed border-indigo-400" /> Forecast</span>}
            </div>

            <div className="flex items-end gap-3 h-40">
              {all.map((c) => (
                <div key={c.label} className={`flex-1 flex flex-col items-center gap-1 ${c.projected ? "opacity-90" : ""}`}>
                  <div className="flex items-end gap-1 h-32 w-full justify-center">
                    <div className={`w-1/2 max-w-[18px] rounded-t-sm ${c.projected ? "bg-indigo-300 border border-dashed border-indigo-400" : "bg-indigo-500"}`}
                      style={{ height: `${Math.max(3, (c.listings / maxVal) * 100)}%` }} title={`${c.listings} listings`} />
                    <div className={`w-1/2 max-w-[18px] rounded-t-sm ${c.projected ? "bg-green-300 border border-dashed border-green-400" : "bg-green-500"}`}
                      style={{ height: `${Math.max(3, (c.offers / maxVal) * 100)}%` }} title={`${c.offers} offers`} />
                  </div>
                  <span className={`text-[10px] text-center truncate w-full ${c.projected ? "font-semibold text-indigo-500" : "text-gray-400"}`}>{c.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {forecast.peakDemandMonth && (
                <div className="flex gap-2 p-3 rounded-lg bg-indigo-50 text-indigo-800">
                  <span>📈</span>
                  <span>Peak buyer interest was <strong>{forecast.peakDemandMonth.label}</strong> ({forecast.peakDemandMonth.count} events) — a seasonal window to prioritise.</span>
                </div>
              )}
              {hasProjection && (
                <div className="flex gap-2 p-3 rounded-lg bg-green-50 text-green-800">
                  <span>🔮</span>
                  <span>Forecast next month: <strong>~{forecast.projection.offers ?? 0} offers</strong> and <strong>~{forecast.projection.listings ?? 0} new listings</strong>, projected from the current trend.</span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Price Optimisation */}
      {priceBands.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-1">
            <Percent size={16} className="text-indigo-600" /> Price Optimisation
          </h2>
          <p className="text-xs text-gray-400 mb-4">Suggested competitive price bands, computed from real market listings and time-to-sell</p>
          <div className="space-y-3">
            {priceBands.slice(0, 6).map((b) => (
              <div key={b.breed} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                  <span className="font-semibold text-gray-900">{b.breed}</span>
                  <span className="text-xs text-gray-400">{b.count} listing{b.count !== 1 ? "s" : ""}{b.soldCount > 0 ? ` · ${b.soldCount} sold` : ""}</span>
                </div>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-sm text-gray-500">Suggested:</span>
                  <span className="text-base font-bold text-green-600">₦{b.suggestedMin.toLocaleString()}–₦{b.suggestedMax.toLocaleString()}</span>
                  <span className="text-xs text-gray-400">(market avg ₦{b.marketAvg.toLocaleString()})</span>
                </div>
                <p className="text-xs text-gray-600">{b.insight}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Geographic user distribution — admin only */}
      {isAdmin && geoData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-1">User Distribution by Location</h2>
          <p className="text-xs text-gray-400 mb-4">Top cities/states where users are registered</p>
          <div className="space-y-2">
            {geoData.slice(0, 10).map((g) => {
              const maxCount = geoData[0]?.count || 1;
              return (
                <div key={g.location}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 truncate flex-1">{g.location}</span>
                    <span className="font-semibold text-gray-900 ml-2">{g.count} user{g.count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div className="h-2 bg-indigo-500 rounded-full transition-all"
                      style={{ width: `${(g.count / maxCount) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">

        {/* Average price by breed */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Average Price by Breed</h2>
          <p className="text-xs text-gray-400 mb-4">Based on all active listings · ₦ Nigerian Naira</p>
          {breeds.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No listing data yet.</p>
          ) : (
            <div className="space-y-3">
              {breeds.slice(0, 8).map((b) => (
                <div key={b.breed}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700 truncate flex-1">{b.breed}</span>
                    <span className="font-semibold text-gray-900 ml-2">₦{b.avgPrice.toLocaleString()}</span>
                    <span className="text-xs text-gray-400 ml-2 w-14 text-right">{b.count} listing{b.count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div className="h-2 bg-purple-500 rounded-full transition-all"
                      style={{ width: `${(b.avgPrice / maxPrice) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Demand by breed (count) */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-1">Listings by Breed</h2>
          <p className="text-xs text-gray-400 mb-4">Volume of active listings per breed</p>
          {breeds.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">No listing data yet.</p>
          ) : (
            <div className="flex items-end gap-2 h-36">
              {breeds.slice(0, 8).map((b) => (
                <div key={b.breed} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-500">{b.count}</span>
                  <div className="w-full bg-indigo-500 rounded-t-sm transition-all"
                    style={{ height: `${Math.max(4, (b.count / maxCount) * 100)}px` }} />
                  <span className="text-[10px] text-gray-400 truncate w-full text-center" title={b.breed}>
                    {b.breed.split(" ")[0]}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Seller: views per listing chart */}
      {seller && topListings.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-1">My Listings — Views</h2>
          <p className="text-xs text-gray-400 mb-4">Views received per listing</p>
          <div className="flex items-end gap-3 h-32">
            {topListings.map((l) => (
              <div key={l.id} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-gray-500">{l.views ?? 0}</span>
                <div className="w-full bg-green-500 rounded-t-sm"
                  style={{ height: `${Math.max(4, ((l.views ?? 0) / maxViews) * 96)}px` }} />
                <span className="text-[10px] text-gray-400 truncate w-full text-center" title={l.name}>
                  {l.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seller: listing table */}
      {seller && seller.listings.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">My Listings Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-left px-4 py-3">Pet</th>
                  <th className="text-left px-4 py-3">Price</th>
                  <th className="text-left px-4 py-3">Views</th>
                  <th className="text-left px-4 py-3">Inquiries</th>
                  <th className="text-left px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {seller.listings.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {l.name} <span className="text-gray-400 font-normal">({l.breed})</span>
                    </td>
                    <td className="px-4 py-3 text-indigo-600 font-semibold">₦{Number(l.price).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-600">{l.views ?? 0}</td>
                    <td className="px-4 py-3 text-gray-600">{l.inquiries ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        l.status === "active" ? "bg-green-100 text-green-700" :
                        l.status === "sold" ? "bg-gray-100 text-gray-600" : "bg-yellow-100 text-yellow-600"
                      }`}>{l.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top breeds insight */}
      {breeds.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">Market Insights</h2>
          <div className="space-y-2">
            {breeds.slice(0, 3).map((b, i) => {
              const color = i === 0 ? "bg-green-50 text-green-800" : i === 1 ? "bg-indigo-50 text-indigo-800" : "bg-yellow-50 text-yellow-800";
              const emoji = i === 0 ? "🔥" : i === 1 ? "📈" : "💡";
              return (
                <div key={b.breed} className={`flex gap-3 p-3 rounded-lg text-sm ${color}`}>
                  <span>{emoji}</span>
                  <span>
                    <strong>{b.breed}</strong> — {b.count} active listing{b.count !== 1 ? "s" : ""}, avg price ₦{b.avgPrice.toLocaleString()}.
                    {i === 0 ? " Most listed breed on the platform." : i === 1 ? " Strong demand indicator." : " Consider pricing competitively."}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Export */}
      <div className="flex items-center gap-3 print:hidden flex-wrap">
        <Link
          href="/reports"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <FileText size={15} /> Open Reports
        </Link>
        {seller && (
          <button
            onClick={async () => {
              const mod = await import("@/lib/pdf-report");
              await mod.generateReport({
                meta: {
                  title: "My Analytics Report",
                  subtitle: "Listing performance and market pricing overview",
                  period: `As of ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
                  scope: "Your account",
                  preparedBy: `${user?.name ?? "Seller"} (${user?.role === "administrator" ? "Administrator" : "Seller"})`,
                },
                kpis: [
                  { label: "Total Listings", value: String(seller.totalListings) },
                  { label: "Total Views", value: seller.totalViews.toLocaleString() },
                  { label: "Total Inquiries", value: String(seller.totalInquiries) },
                  { label: "Pets Sold", value: String(seller.totalSold) },
                  { label: "Avg. Rating", value: seller.avgRating > 0 ? `${seller.avgRating}/5` : "—" },
                  { label: "Conversion", value: seller.conversionRate !== null ? `${seller.conversionRate}%` : "—" },
                ],
                table: {
                  columns: [
                    { header: "Pet" }, { header: "Breed" }, { header: "Price", align: "right" },
                    { header: "Views", align: "right" }, { header: "Inquiries", align: "right" }, { header: "Status", align: "center" },
                  ],
                  rows: seller.listings.map((l) => [l.name, l.breed, mod.money(l.price), l.views ?? 0, l.inquiries ?? 0, l.status]),
                },
                emptyNote: "You have no listings yet.",
                fileName: `PetMatchAI_My_Analytics_${new Date().toISOString().slice(0, 10)}.pdf`,
              });
            }}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
            <Download size={15} /> Download PDF
          </button>
        )}
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
          <Printer size={15} /> Print View
        </button>
      </div>

      {/* Custom Report Builder */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6 print:hidden">
        <button
          onClick={() => setReportOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-indigo-600" />
            <span className="font-semibold text-gray-900">Custom Report Builder</span>
            <span className="text-xs text-gray-400 ml-1">Filter listings by date, species, and status</span>
          </div>
          {reportOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>

        {reportOpen && (
          <div className="border-t border-gray-100 px-5 py-4">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">From</label>
                <input type="date" value={reportFrom} onChange={(e) => setReportFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">To</label>
                <input type="date" value={reportTo} onChange={(e) => setReportTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">Species</label>
                <select value={reportSpecies} onChange={(e) => setReportSpecies(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">All Species</option>
                  <option value="dog">Dog</option>
                  <option value="cat">Cat</option>
                  <option value="bird">Bird</option>
                  <option value="rabbit">Rabbit</option>
                  <option value="fish">Fish</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">Status</label>
                <select value={reportStatus} onChange={(e) => setReportStatus(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="all">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="sold">Sold</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 font-medium">Sort By</label>
                <select value={reportSort} onChange={(e) => setReportSort(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="views">Most Viewed</option>
                  <option value="inquiries">Most Inquiries</option>
                  <option value="price">Highest Price</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  setReportLoading(true);
                  setReportData(null);
                  const params = new URLSearchParams({ custom: "true", from: reportFrom, to: reportTo, sortBy: reportSort });
                  if (reportSpecies) params.set("species", reportSpecies);
                  if (reportStatus !== "all") params.set("status", reportStatus);
                  // Scope report to this seller's listings if not admin
                  if (isSeller && user?.id) params.set("sellerId", user.id);
                  const res = await api.get(`/api/analytics?${params.toString()}`);
                  setReportData(res.data ?? []);
                  setReportSummary(res.summary ?? null);
                  setReportLoading(false);
                }}
                disabled={reportLoading}
                className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                {reportLoading ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
                Generate Report
              </button>
              {reportData && reportData.length > 0 && (
                <button
                  onClick={async () => {
                    const mod = await import("@/lib/pdf-report");
                    const fmt = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                    await mod.generateReport({
                      meta: {
                        title: "Custom Listings Report",
                        subtitle: "Filtered listing performance",
                        period: `${fmt(reportFrom)}  to  ${fmt(reportTo)}`,
                        scope: isAdmin ? "Platform-wide" : "Your account",
                        preparedBy: `${user?.name ?? "User"} (${isAdmin ? "Administrator" : "Seller"})`,
                        filters: [
                          `Species: ${reportSpecies || "All"}`,
                          `Status: ${reportStatus}`,
                          `Sorted by: ${reportSort}`,
                        ],
                      },
                      kpis: reportSummary ? [
                        { label: "Total Pets", value: String(reportSummary.totalPets) },
                        { label: "Total Views", value: reportSummary.totalViews.toLocaleString() },
                        { label: "Total Inquiries", value: String(reportSummary.totalInquiries) },
                        { label: "Avg Price", value: mod.money(reportSummary.avgPrice) },
                      ] : [],
                      table: {
                        columns: [
                          { header: "Pet" }, { header: "Breed" }, { header: "Species", align: "center" },
                          { header: "Price", align: "right" }, { header: "Views", align: "right" },
                          { header: "Inquiries", align: "right" }, { header: "Status", align: "center" },
                          { header: "Seller" }, { header: "Listed On", align: "center" },
                        ],
                        rows: reportData.map((r) => [
                          r.name, r.breed, r.species, mod.money(r.price), r.views ?? 0,
                          r.inquiries ?? 0, r.status, (r.seller as any)?.name ?? "—",
                          r.created_at ? fmt(r.created_at) : "—",
                        ]),
                      },
                      fileName: `PetMatchAI_Custom_${reportFrom}_to_${reportTo}.pdf`,
                    });
                  }}
                  className="flex items-center gap-1.5 border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
                  <Download size={14} /> Download PDF
                </button>
              )}
            </div>

            {reportData !== null && (
              <div className="mt-4">
                {reportSummary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: "Total Pets", value: reportSummary.totalPets },
                      { label: "Total Views", value: reportSummary.totalViews.toLocaleString() },
                      { label: "Total Inquiries", value: reportSummary.totalInquiries },
                      { label: "Avg Price (₦)", value: `₦${reportSummary.avgPrice.toLocaleString()}` },
                    ].map((s) => (
                      <div key={s.label} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs text-gray-500">{s.label}</p>
                        <p className="text-lg font-bold text-gray-900">{s.value}</p>
                      </div>
                    ))}
                  </div>
                )}
                {reportData.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No listings match these filters.</p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs text-gray-500">
                        <tr>
                          <th className="text-left px-3 py-2">Pet</th>
                          <th className="text-left px-3 py-2">Species</th>
                          <th className="text-left px-3 py-2">Price</th>
                          <th className="text-left px-3 py-2">Views</th>
                          <th className="text-left px-3 py-2">Inquiries</th>
                          <th className="text-left px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {reportData.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-900">{r.name} <span className="text-gray-400 font-normal">({r.breed})</span></td>
                            <td className="px-3 py-2 capitalize text-gray-600">{r.species}</td>
                            <td className="px-3 py-2 text-indigo-600 font-semibold">₦{Number(r.price).toLocaleString()}</td>
                            <td className="px-3 py-2 text-gray-600">{r.views ?? 0}</td>
                            <td className="px-3 py-2 text-gray-600">{r.inquiries ?? 0}</td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                r.status === "active" ? "bg-green-100 text-green-700" :
                                r.status === "sold" ? "bg-gray-100 text-gray-600" : "bg-yellow-100 text-yellow-700"
                              }`}>{r.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          nav, footer, button, .print\\:hidden { display: none !important; }
          body { background: white !important; }
          .rounded-xl { border-radius: 0 !important; }
          * { box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
