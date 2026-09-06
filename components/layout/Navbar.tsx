"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, MessageSquare, Home, Search, Heart, BarChart2, Shield, User, PlusCircle, Zap, LogOut, Menu, X, Tag, Bookmark, Megaphone, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/lib/toast-context";
import { api } from "@/lib/api-client";

const buyerLinks = [
  { href: "/dashboard/buyer", label: "Home", icon: Home },
  { href: "/listings", label: "Search", icon: Search },
  { href: "/matchmaking", label: "Match", icon: Zap },
  { href: "/recommendations", label: "For You", icon: Heart },
  { href: "/offers", label: "Offers", icon: Tag },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/want-ads", label: "Wants", icon: Megaphone },
  { href: "/reports", label: "Reports", icon: FileText },
];

const sellerLinks = [
  { href: "/dashboard/seller", label: "Home", icon: Home },
  { href: "/listings/new", label: "List Pet", icon: PlusCircle },
  { href: "/want-ads", label: "Buyer Requests", icon: Megaphone },
  { href: "/offers", label: "Offers", icon: Tag },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/reports", label: "Reports", icon: FileText },
];

const adminLinks = [
  { href: "/dashboard/admin", label: "Home", icon: Home },
  { href: "/admin", label: "Admin", icon: Shield },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/messages", label: "Messages", icon: MessageSquare },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { addToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [msgUnread, setMsgUnread] = useState(0);
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  // Authoritative unread count straight from the DB — the single source of truth
  // for the bell badge, so it always matches the notifications list. Debounced so
  // a "mark all as read" (one Realtime event per row) collapses into one query.
  const unreadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshUnread = useCallback(() => {
    if (!user) { setUnread(0); return; }
    if (unreadTimer.current) clearTimeout(unreadTimer.current);
    unreadTimer.current = setTimeout(() => {
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false)
        .then(({ count }) => setUnread(count ?? 0));
    }, 200);
  }, [user]);
  useEffect(() => () => { if (unreadTimer.current) clearTimeout(unreadTimer.current); }, []);

  // Initial load + re-sync on every navigation, so reading notifications (which
  // marks them read in the DB) brings the bell badge back in line with reality.
  useEffect(() => { refreshUnread(); }, [refreshUnread, pathname]);

  // Unread message count for the Messages nav badge — refreshed on navigation.
  useEffect(() => {
    if (!user) { setMsgUnread(0); return; }
    api.get("/api/messages").then((res) => setMsgUnread(res.unreadMessages ?? 0)).catch(() => {});
  }, [user, pathname]);

  // Realtime — increment badge when a new notification is inserted for this user
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`navbar-notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setUnread((n) => n + 1);
          const n = payload.new as { type?: string; title?: string; message?: string };
          if (n.type === "message" && pathnameRef.current !== "/messages") setMsgUnread((m) => m + 1);
          const typeMap: Record<string, string> = {
            message: "New Message", offer: "New Offer", match: "New Match",
            system: "Announcement", listing_view: "Listing Viewed",
          };
          addToast({
            type: "info",
            title: typeMap[n.type ?? ""] ?? n.title ?? "New Notification",
            message: n.message ?? undefined,
          });
        }
      )
      .on(
        // When notifications are marked read (single or "mark all"), re-sync the
        // badge from the DB so it clears live, without needing a navigation/reload.
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => refreshUnread()
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAuthPage = pathname.startsWith("/auth");
  if (isAuthPage) return null;

  const links =
    user?.role === "seller" ? sellerLinks :
    user?.role === "administrator" ? adminLinks :
    buyerLinks;

  const dashboardHref =
    user?.role === "seller" ? "/dashboard/seller" :
    user?.role === "administrator" ? "/dashboard/admin" :
    "/dashboard/buyer";

  async function handleLogout() {
    await logout();
    router.push("/auth/login");
  }

  const roleColors: Record<string, string> = {
    buyer: "bg-indigo-100 text-indigo-700",
    seller: "bg-purple-100 text-purple-700",
    administrator: "bg-red-100 text-red-700",
  };

  return (
    <>
      {/* Top bar */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <Link href={dashboardHref} className="font-bold text-indigo-600 text-lg flex items-center gap-1 shrink-0">
            🐾 <span className="hidden sm:inline">PetMatchAI</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}
                className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname === href || pathname.startsWith(href + "/")
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`}>
                <Icon size={15} />{label}
                {href === "/messages" && msgUnread > 0 && (
                  <span className="ml-0.5 bg-red-500 text-white text-[10px] rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center font-bold">
                    {msgUnread > 99 ? "99+" : msgUnread}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {user && (
              <span className={`hidden sm:inline text-xs font-medium px-2 py-1 rounded-full capitalize ${roleColors[user.role]}`}>
                {user.role}
              </span>
            )}
            <Link href="/notifications" aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`} className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
              <Bell size={18} aria-hidden="true" />
              {unread > 0 && (
                <span aria-hidden="true" className="absolute top-1 right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{unread}</span>
              )}
            </Link>
            <Link href="/profile" aria-label="My profile" className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg hidden md:block">
              <User size={18} aria-hidden="true" />
            </Link>
            <button onClick={handleLogout} aria-label="Sign out" className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg hidden md:block">
              <LogOut size={18} aria-hidden="true" />
            </button>
            {/* Mobile menu toggle */}
            <button onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg md:hidden">
              {menuOpen ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="md:hidden bg-white border-t border-gray-100 px-4 py-3 space-y-1">
            {user && (
              <div className="flex items-center gap-3 pb-3 mb-2 border-b border-gray-100">
                <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">
                  {user.name[0]}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{user.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                </div>
              </div>
            )}
            <Link href="/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              <User size={16} /> Profile
            </Link>
            <Link href="/notifications" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
              <Bell size={16} /> Notifications {unread > 0 && <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-1.5">{unread}</span>}
            </Link>
            <button onClick={handleLogout} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50">
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        )}
      </nav>

      {/* Mobile bottom tab bar */}
      <nav aria-label="Mobile navigation" className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 flex">
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} onClick={() => setMenuOpen(false)}
            aria-label={msgUnread > 0 && href === "/messages" ? `${label}, ${msgUnread} unread` : label}
            aria-current={pathname === href || pathname.startsWith(href + "/") ? "page" : undefined}
            className={`relative flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
              pathname === href || pathname.startsWith(href + "/")
                ? "text-indigo-600"
                : "text-gray-400"
            }`}>
            <Icon size={20} aria-hidden="true" />
            {label}
            {href === "/messages" && msgUnread > 0 && (
              <span className="absolute top-1 right-1/2 translate-x-3 bg-red-500 text-white text-[9px] rounded-full min-w-[15px] h-[15px] px-1 flex items-center justify-center font-bold">
                {msgUnread > 9 ? "9+" : msgUnread}
              </span>
            )}
          </Link>
        ))}
      </nav>
    </>
  );
}
