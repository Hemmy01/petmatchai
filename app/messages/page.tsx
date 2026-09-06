"use client";
import { useState, useEffect, useRef } from "react";
import { Send, Loader2, MessageSquare, Flag, Search, Archive, ArchiveRestore, CheckCheck, Check, Clock, AlertCircle, RotateCw, Video, Shield } from "lucide-react";
import VideoCallModal from "@/components/modals/VideoCallModal";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { supabase } from "@/lib/supabase";

const MESSAGE_TEMPLATES = [
  "Is this pet still available?",
  "Can I schedule a visit to meet the pet?",
  "What vaccinations has the pet received?",
  "Is the price negotiable?",
  "Can you share more photos or a video?",
];

type Thread = {
  id: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  dispute_status?: string | null;   // null | 'open' (under review) | 'resolved'
  pet: { id: string; name: string; breed: string; image_url: string | null } | null;
  buyer: { id: string; name: string } | null;
  seller: { id: string; name: string } | null;
};

type Message = {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  delivered_at?: string | null;
  created_at: string;
  message_type?: string;   // 'text' | 'admin_note' | 'admin_decision'
  sender: { id: string; name: string } | null;
  pending?: boolean;   // send in flight (optimistic)
  failed?: boolean;    // send failed — offer retry
};

type MsgStatus = "sending" | "sent" | "delivered" | "seen" | "failed";
function messageStatus(m: Message): MsgStatus {
  if (m.failed) return "failed";
  if (m.pending) return "sending";
  if (m.is_read) return "seen";
  if (m.delivered_at) return "delivered";
  return "sent";
}
const STATUS_LABEL: Record<MsgStatus, string> = {
  sending: "Sending…", sent: "Sent", delivered: "Delivered", seen: "Seen", failed: "Not sent",
};

function timeLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth();

  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [threadSearch, setThreadSearch] = useState("");
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [reporting, setReporting] = useState(false);
  const [reportMsg, setReportMsg] = useState("");

  const [showVideoCall, setShowVideoCall] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingBroadcast = useRef(0);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load thread list + archived IDs from localStorage
  useEffect(() => {
    if (!user) return;
    const stored = localStorage.getItem(`petmatchai_archived_${user.id}`);
    if (stored) setArchivedIds(new Set(JSON.parse(stored)));
    api.get("/api/messages").then((res) => {
      const data: Thread[] = res.data ?? [];
      setThreads(data);
      setThreadsLoading(false);
      const wantedThreadId = new URLSearchParams(window.location.search).get("thread");
      if (wantedThreadId) {
        const match = data.find((t) => t.id === wantedThreadId);
        if (match) setActiveThread(match);
      }
    });
  }, [user]);

  function toggleArchive(threadId: string) {
    setArchivedIds((prev) => {
      const next = new Set(prev);
      next.has(threadId) ? next.delete(threadId) : next.add(threadId);
      if (user) localStorage.setItem(`petmatchai_archived_${user.id}`, JSON.stringify([...next]));
      return next;
    });
  }

  // Load messages when thread is selected
  useEffect(() => {
    if (!activeThread) return;
    setMessagesLoading(true);
    setMessages([]);
    api.get(`/api/messages?threadId=${activeThread.id}`).then((res) => {
      setMessages(res.data ?? []);
      setMessagesLoading(false);
      // Mark thread as read locally
      setThreads((prev) =>
        prev.map((t) => (t.id === activeThread.id ? { ...t, unread_count: 0 } : t))
      );
    });
  }, [activeThread?.id]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription — new messages + read receipt updates
  useEffect(() => {
    if (!activeThread || !user) return;
    const otherName =
      user.id === activeThread.buyer?.id
        ? (activeThread.seller?.name ?? "Unknown")
        : (activeThread.buyer?.name ?? "Unknown");
    const channel = supabase
      .channel(`messages:${activeThread.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${activeThread.id}` },
        (payload) => {
          const raw = payload.new as { id: string; thread_id: string; sender_id: string; content: string; is_read: boolean; created_at: string; message_type?: string };
          if (raw.sender_id === user.id) return;
          const isAdmin = raw.message_type === "admin_note" || raw.message_type === "admin_decision";
          setMessages((prev) => {
            if (prev.some((m) => m.id === raw.id)) return prev;
            return [...prev, { id: raw.id, thread_id: raw.thread_id, sender_id: raw.sender_id, content: raw.content, is_read: raw.is_read, created_at: raw.created_at, message_type: raw.message_type, sender: { id: raw.sender_id, name: isAdmin ? "PetMatch Admin" : otherName } }];
          });
          setThreads((prev) =>
            prev.map((t) => t.id === raw.thread_id ? { ...t, last_message: raw.content, last_message_at: raw.created_at } : t)
          );
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `thread_id=eq.${activeThread.id}` },
        (payload) => {
          const updated = payload.new as { id: string; is_read: boolean; delivered_at: string | null; sender_id: string };
          // Reflect delivered/seen receipts on the sender's own messages.
          if (updated.sender_id === user.id) {
            setMessages((prev) => prev.map((m) => m.id === updated.id
              ? { ...m, is_read: updated.is_read, delivered_at: updated.delivered_at }
              : m));
          }
        }
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [activeThread?.id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Typing indicator — broadcast channel per thread
  useEffect(() => {
    if (!activeThread || !user) return;
    setOtherTyping(false);
    const ch = supabase.channel(`typing:${activeThread.id}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.userId === user.id) return;
        setOtherTyping(true);
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setOtherTyping(false), 3000);
      })
      .subscribe();
    typingChannel.current = ch;
    return () => {
      void supabase.removeChannel(ch);
      typingChannel.current = null;
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
    };
  }, [activeThread?.id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Send (or retry) a message; updates the optimistic bubble's status.
  async function deliver(content: string, optimisticId: string, threadId: string) {
    const res = await api.post("/api/messages", { threadId, content }).catch(() => ({ error: "network" }));
    if (res.error || !res.data) {
      setMessages((prev) => prev.map((m) => m.id === optimisticId ? { ...m, pending: false, failed: true } : m));
      return;
    }
    setMessages((prev) => prev.map((m) => m.id === optimisticId
      ? { ...m, id: res.data.id, pending: false, failed: false, created_at: res.data.created_at ?? m.created_at }
      : m));
    setThreads((prev) => prev.map((t) =>
      t.id === threadId ? { ...t, last_message: content, last_message_at: new Date().toISOString() } : t));
  }

  async function sendMessage() {
    if (!input.trim() || !activeThread || sending) return;
    const content = input.trim();
    setInput("");
    setSending(true);
    const optimisticId = `opt-${Date.now()}`;
    const optimistic: Message = {
      id: optimisticId,
      thread_id: activeThread.id,
      sender_id: user!.id,
      content,
      is_read: false,
      delivered_at: null,
      created_at: new Date().toISOString(),
      sender: { id: user!.id, name: user!.name ?? "You" },
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    await deliver(content, optimisticId, activeThread.id);
    setSending(false);
  }

  async function retryMessage(msg: Message) {
    setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, pending: true, failed: false } : m));
    await deliver(msg.content, msg.id, msg.thread_id);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
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
        <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to view messages</h2>
        <Link href="/auth/login" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 text-sm">
          Sign In
        </Link>
      </div>
    );
  }

  function otherParty(thread: Thread) {
    return user!.id === thread.buyer?.id ? thread.seller : thread.buyer;
  }

  // One sidebar row — reused for both the normal list and the disputed section.
  const threadRow = (t: Thread) => {
    const other = otherParty(t);
    const initials = (other?.name ?? "?")[0].toUpperCase();
    const isDisputed = t.dispute_status === "open";
    const isResolved = t.dispute_status === "resolved";
    return (
      <div key={t.id} className="group relative">
        <button
          onClick={() => setActiveThread(t)}
          className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
            activeThread?.id === t.id ? "bg-indigo-50 border-l-2 border-l-indigo-600" : isDisputed ? "border-l-2 border-l-red-400" : ""
          }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-700 flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center gap-1">
                <span className="text-sm font-medium text-gray-900 truncate">
                  {other?.name ?? "Unknown"}
                </span>
                <span className="text-[11px] text-gray-400 flex-shrink-0">
                  {t.last_message_at ? timeLabel(t.last_message_at) : ""}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {t.pet?.name ? <span className="text-indigo-500">{t.pet.name}</span> : null}
                {t.pet?.name && t.last_message ? " · " : ""}
                {t.last_message ?? "No messages yet"}
              </p>
              {isDisputed && (
                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-1.5 py-0.5">
                  <AlertCircle size={9} /> Under review
                </span>
              )}
              {isResolved && (
                <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-semibold text-green-600 bg-green-50 border border-green-200 rounded-full px-1.5 py-0.5">
                  <Check size={9} /> Dispute resolved
                </span>
              )}
            </div>
            {t.unread_count > 0 && (
              <span className="bg-indigo-600 text-white text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                {t.unread_count}
              </span>
            )}
          </div>
        </button>
        {/* Archive button on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); toggleArchive(t.id); }}
          title={archivedIds.has(t.id) ? "Unarchive" : "Archive"}
          className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-gray-600 bg-white rounded-lg shadow-sm transition-opacity">
          {archivedIds.has(t.id) ? <ArchiveRestore size={14} /> : <Archive size={14} />}
        </button>
      </div>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Messages</h1>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex h-[620px]">

        {/* ── Thread sidebar ── */}
        <div className={`${activeThread ? "hidden sm:flex" : "flex"} w-full sm:w-72 border-r border-gray-200 flex-col flex-shrink-0`}>
          <div className="p-3 border-b border-gray-100 space-y-2">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={threadSearch}
                onChange={(e) => setThreadSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <button
              onClick={() => setShowArchived((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 px-1">
              {showArchived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
              {showArchived ? "Hide archived" : "Show archived"}
            </button>
          </div>

          <div className="overflow-y-auto flex-1">
            {threadsLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 size={20} className="animate-spin text-indigo-400" />
              </div>
            ) : threads.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-10 px-4 text-center">
                <MessageSquare size={32} className="text-gray-300 mb-2" />
                <p className="text-sm text-gray-400">No conversations yet.</p>
                <p className="text-xs text-gray-400 mt-1">Message a seller from any listing page.</p>
              </div>
            ) : (() => {
              const visible = threads.filter((t) => {
                const isArchived = archivedIds.has(t.id);
                if (showArchived) return isArchived;
                if (isArchived) return false;
                if (!threadSearch.trim()) return true;
                const q = threadSearch.toLowerCase();
                const other = otherParty(t);
                return (
                  (other?.name ?? "").toLowerCase().includes(q) ||
                  (t.pet?.name ?? "").toLowerCase().includes(q) ||
                  (t.last_message ?? "").toLowerCase().includes(q)
                );
              });
              const disputed = visible.filter((t) => t.dispute_status === "open");
              const normal = visible.filter((t) => t.dispute_status !== "open");
              return (
                <>
                  {disputed.length > 0 && (
                    <div>
                      <div className="px-3 py-2 bg-red-50 border-b border-red-100 flex items-center gap-1.5">
                        <AlertCircle size={12} className="text-red-500" />
                        <span className="text-[11px] font-semibold text-red-600 uppercase tracking-wide">Disputed · under review</span>
                      </div>
                      {disputed.map(threadRow)}
                    </div>
                  )}
                  {normal.map(threadRow)}
                </>
              );
            })()}
          </div>
        </div>

        {/* ── Chat area ── */}
        {!activeThread ? (
          <div className="hidden sm:flex flex-1 items-center justify-center flex-col gap-3 text-center px-6">
            <MessageSquare size={40} className="text-gray-200" />
            <p className="text-sm text-gray-400">Select a conversation to start chatting</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-w-0">
            {/* Chat header */}
            <div className="p-4 border-b border-gray-200 flex items-center gap-3">
              <button
                onClick={() => setActiveThread(null)}
                className="sm:hidden text-xs text-indigo-600 mr-1">
                ← Back
              </button>
              <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-sm font-bold text-indigo-700 shrink-0">
                {(otherParty(activeThread)?.name ?? "?")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">
                  {otherParty(activeThread)?.name ?? "Unknown"}
                </p>
                {activeThread.pet && (
                  <Link href={`/listings/${activeThread.pet.id}`}
                    className="text-xs text-indigo-600 hover:underline truncate block">
                    Re: {activeThread.pet.name} ({activeThread.pet.breed})
                  </Link>
                )}
              </div>

              {/* Video call button */}
              <button
                onClick={() => setShowVideoCall(true)}
                aria-label="Start video call"
                title="Video call"
                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors shrink-0">
                <Video size={15} />
              </button>

              {/* Report button */}
              <div className="relative shrink-0">
                <button
                  onClick={() => { setShowReport((v) => !v); setReportMsg(""); }}
                  aria-label="Report this user"
                  title="Report user"
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Flag size={15} />
                </button>
                {showReport && (
                  <div className="absolute right-0 top-9 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-4 w-64">
                    <p className="text-sm font-semibold text-gray-900 mb-2">Report this user</p>
                    <select
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      aria-label="Report reason"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3">
                      <option value="spam">Spam or scam</option>
                      <option value="harassment">Harassment or abuse</option>
                      <option value="fake_listing">Fake listing</option>
                      <option value="inappropriate">Inappropriate content</option>
                      <option value="other">Other</option>
                    </select>
                    {reportMsg && (
                      <p className="text-xs text-green-600 mb-2">{reportMsg}</p>
                    )}
                    <div className="flex gap-2">
                      <button
                        disabled={reporting}
                        onClick={async () => {
                          const other = otherParty(activeThread);
                          if (!other?.id) return;
                          setReporting(true);
                          await api.post("/api/admin", {
                            type: "report",
                            reportedUserId: other.id,
                            reason: reportReason,
                            context: `Message thread: ${activeThread.id}`,
                          });
                          setReporting(false);
                          setReportMsg("Report submitted. Our team will review it.");
                          setTimeout(() => setShowReport(false), 2000);
                        }}
                        className="flex-1 bg-red-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50">
                        {reporting ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Submit Report"}
                      </button>
                      <button
                        onClick={() => setShowReport(false)}
                        className="text-xs text-gray-500 px-3 py-2 hover:text-gray-700">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Dispute review banner */}
            {activeThread.dispute_status === "open" && (
              <div className="px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-start gap-2">
                <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-xs text-red-700">
                  This conversation is under dispute review. An admin has been notified and will help resolve it — please keep all communication here.
                </p>
              </div>
            )}
            {activeThread.dispute_status === "resolved" && (
              <div className="px-4 py-2.5 bg-green-50 border-b border-green-100 flex items-start gap-2">
                <Check size={14} className="text-green-600 mt-0.5 shrink-0" />
                <p className="text-xs text-green-700">This dispute has been resolved by an admin.</p>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messagesLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={20} className="animate-spin text-indigo-400" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
                  <p className="text-sm text-gray-400">No messages yet. Say hello!</p>
                </div>
              ) : (
                (() => {
                  let lastMineIdx = -1;
                  messages.forEach((m, i) => { if (m.sender_id === user.id) lastMineIdx = i; });
                  return messages.map((msg, idx) => {
                    // Admin-mediated dispute messages: shown full-width and
                    // highlighted so both parties clearly see the intervention.
                    if (msg.message_type === "admin_note" || msg.message_type === "admin_decision") {
                      const isDecision = msg.message_type === "admin_decision";
                      return (
                        <div key={msg.id} className="flex justify-center px-2">
                          <div className={`max-w-md w-full rounded-2xl px-4 py-3 text-sm border ${isDecision ? "bg-amber-50 border-amber-300 text-amber-900" : "bg-indigo-50 border-indigo-200 text-indigo-900"}`}>
                            <p className="text-[11px] font-bold uppercase tracking-wide mb-1 flex items-center gap-1.5">
                              <Shield size={13} /> {isDecision ? "Admin decision" : "PetMatch Admin"}
                            </p>
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            <p className="text-[11px] mt-1.5 opacity-70">{timeLabel(msg.created_at)}</p>
                          </div>
                        </div>
                      );
                    }
                    const isMe = msg.sender_id === user.id;
                    const status = messageStatus(msg);
                    return (
                      <div key={msg.id}>
                        <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-xs lg:max-w-sm px-4 py-2.5 rounded-2xl text-sm ${
                            isMe
                              ? `text-white rounded-br-sm ${status === "failed" ? "bg-red-500" : "bg-indigo-600"}`
                              : "bg-gray-100 text-gray-800 rounded-bl-sm"
                          }`}>
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            <p className={`text-[11px] mt-1 flex items-center gap-1 ${isMe ? "justify-end text-indigo-200" : "text-gray-400"}`}>
                              {timeLabel(msg.created_at)}
                              {isMe && status === "sending" && <Clock size={11} aria-label="Sending" />}
                              {isMe && status === "sent" && <Check size={12} aria-label="Sent" />}
                              {isMe && status === "delivered" && <CheckCheck size={12} aria-label="Delivered" />}
                              {isMe && status === "seen" && <CheckCheck size={12} className="text-white" aria-label="Seen" />}
                              {isMe && status === "failed" && <AlertCircle size={12} className="text-white" aria-label="Not sent" />}
                            </p>
                          </div>
                        </div>
                        {isMe && (status === "failed" || idx === lastMineIdx) && (
                          <div className="flex justify-end items-center mt-0.5 pr-1 text-[11px]">
                            {status === "failed" ? (
                              <button onClick={() => retryMessage(msg)}
                                className="flex items-center gap-1 text-red-500 hover:underline font-medium">
                                <AlertCircle size={12} /> Not sent · <RotateCw size={11} /> Retry
                              </button>
                            ) : (
                              <span className={`flex items-center gap-0.5 ${status === "seen" ? "text-indigo-500 font-medium" : "text-gray-400"}`}>
                                {STATUS_LABEL[status]}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()
              )}
              <div ref={bottomRef} />
            </div>

            {/* Typing indicator */}
            {otherTyping && (
              <div className="px-4 pb-1 flex items-center gap-2">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-xs text-gray-400">typing…</span>
              </div>
            )}

            {/* Message Templates */}
            {showTemplates && (
              <div className="px-4 pb-2 flex flex-wrap gap-1.5 border-t border-gray-100 pt-2">
                {MESSAGE_TEMPLATES.map((t) => (
                  <button key={t} type="button"
                    onClick={() => { setInput(t); setShowTemplates(false); inputRef.current?.focus(); }}
                    className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full px-3 py-1 hover:bg-indigo-100 transition-colors">
                    {t}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2 items-end">
                <button
                  type="button"
                  onClick={() => setShowTemplates((v) => !v)}
                  title="Quick replies"
                  className={`p-2.5 rounded-xl border transition-colors shrink-0 ${showTemplates ? "bg-indigo-50 border-indigo-300 text-indigo-600" : "border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-300"}`}>
                  <MessageSquare size={16} />
                </button>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    const now = Date.now();
                    if (typingChannel.current && now - lastTypingBroadcast.current > 2000) {
                      lastTypingBroadcast.current = now;
                      typingChannel.current.send({ type: "broadcast", event: "typing", payload: { userId: user!.id, name: user!.name } });
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  aria-label="Message input"
                  placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  style={{ maxHeight: "120px" }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${el.scrollHeight}px`;
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  aria-label="Send message"
                  className="bg-indigo-600 text-white p-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 shrink-0 transition-colors">
                  {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
              <p className="text-[11px] text-gray-400 mt-1.5 px-1">Enter to send · Shift+Enter for new line</p>
            </div>
          </div>
        )}
      </div>

      {showVideoCall && activeThread && (
        <VideoCallModal
          threadId={activeThread.id}
          otherName={otherParty(activeThread)?.name ?? "the other person"}
          onClose={() => setShowVideoCall(false)}
        />
      )}
    </div>
  );
}
