"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, CheckCircle, XCircle, ArrowLeftRight, ChevronDown, ChevronUp, Star, ImagePlus, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import PaymentPanel from "@/components/payments/PaymentPanel";

type Offer = {
  id: string;
  pet_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  counter_amount: number | null;
  note: string | null;
  status: string;
  created_at: string;
  updated_at: string | null;
  buyer: { id: string; name: string } | null;
  seller: { id: string; name: string } | null;
  pet: { id: string; name: string; price: number } | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700",
  accepted:  "bg-green-100 text-green-700",
  rejected:  "bg-red-100 text-red-600",
  countered: "bg-blue-100 text-blue-700",
};

function formatTimestamp(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 0) return `Today at ${time}`;
  if (diffDays === 1) return `Yesterday at ${time}`;
  if (diffDays < 7) return `${d.toLocaleDateString([], { weekday: "long" })} at ${time}`;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })} at ${time}`;
}

function StarPicker({ value, onChange, size = 20 }: { value: number; onChange: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button"
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i)}
          className="text-yellow-400 transition-transform hover:scale-110">
          <Star size={size} className={(hover || value) >= i ? "fill-yellow-400" : "text-gray-200 fill-gray-200"} />
        </button>
      ))}
    </div>
  );
}

function ReviewForm({ offer, onDone }: { offer: Offer; onDone: () => void }) {
  const [rating, setRating] = useState(0);
  const [commRating, setCommRating] = useState(0);
  const [healthRating, setHealthRating] = useState(0);
  const [accuracyRating, setAccuracyRating] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 3 - photos.length);
    const next = [...photos, ...files].slice(0, 3);
    setPhotos(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
    e.target.value = "";
  }

  function removePhoto(i: number) {
    URL.revokeObjectURL(previews[i]);
    setPhotos((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) { setError("Please select an overall rating."); return; }
    setError("");
    setSubmitting(true);

    // Upload photos first
    const photoUrls: string[] = [];
    if (photos.length > 0) {
      const { data: { session } } = await supabase.auth.getSession();
      for (const file of photos) {
        const form = new FormData();
        form.append("file", file);
        form.append("bucket", "pet-images");
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
          body: form,
        });
        if (res.ok) {
          const json = await res.json();
          photoUrls.push(json.url);
        }
      }
    }

    const res = await api.post("/api/reviews", {
      sellerId: offer.seller_id,
      petId: offer.pet_id,
      rating,
      communicationRating: commRating || null,
      healthRating: healthRating || null,
      accuracyRating: accuracyRating || null,
      comment: comment.trim() || null,
      photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
    });
    setSubmitting(false);
    if (res.error) { setError(res.error); return; }
    onDone();
  }

  return (
    <form onSubmit={submit} className="mt-3 bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
      <p className="text-sm font-semibold text-gray-800">Leave a review for {offer.seller?.name}</p>

      <div>
        <p className="text-xs font-medium text-gray-600 mb-1">Overall Rating *</p>
        <StarPicker value={rating} onChange={setRating} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Communication", value: commRating, set: setCommRating },
          { label: "Accuracy", value: accuracyRating, set: setAccuracyRating },
          { label: "Pet Health", value: healthRating, set: setHealthRating },
        ].map(({ label, value, set }) => (
          <div key={label}>
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <StarPicker value={value} onChange={set} size={15} />
          </div>
        ))}
      </div>

      <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)}
        placeholder="Share your experience with this seller..."
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />

      {/* Photo attachments */}
      <div>
        <p className="text-xs font-medium text-gray-600 mb-2">Photos (up to 3)</p>
        <div className="flex gap-2 flex-wrap">
          {previews.map((src, i) => (
            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shrink-0">
              <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80">
                <X size={10} />
              </button>
            </div>
          ))}
          {photos.length < 3 && (
            <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors shrink-0">
              <ImagePlus size={16} className="text-gray-400" />
              <span className="text-[10px] text-gray-400 mt-0.5">Add</span>
              <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp"
                multiple onChange={handlePhotoChange} />
            </label>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={submitting}
          className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50">
          {submitting && <Loader2 size={12} className="animate-spin" />}
          {submitting ? "Submitting…" : "Submit Review"}
        </button>
        <button type="button" onClick={onDone}
          className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2">
          Skip
        </button>
      </div>
    </form>
  );
}

function DisputeForm({ offer, currentUserId, onDone }: { offer: Offer; currentUserId: string; onDone: () => void }) {
  const SUBJECTS = [
    "Payment not received",
    "Pet condition not as described",
    "Seller unresponsive after acceptance",
    "Pet never delivered",
    "Fraudulent listing",
    "Other",
  ];
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [customSubject, setCustomSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const finalSubject = subject === "Other" ? customSubject.trim() : subject;
    if (!finalSubject) { setError("Please describe the issue."); return; }
    setError("");
    setSubmitting(true);
    // The respondent is always the OTHER party to this offer — whoever isn't filing.
    const respondentId = offer.seller_id === currentUserId ? offer.buyer_id : offer.seller_id;
    const res = await api.post("/api/disputes", {
      respondentId,
      offerId: offer.id,
      subject: finalSubject,
      description: description.trim() || null,
      context: `Offer ID: ${offer.id} | Pet: ${offer.pet?.name ?? "—"} | Amount: ₦${Number(offer.amount).toLocaleString()}`,
    });
    setSubmitting(false);
    if (res.error) { setError(res.error); return; }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
        <CheckCircle size={20} className="text-green-600 mx-auto mb-1.5" />
        <p className="text-sm font-semibold text-green-800">Dispute filed successfully</p>
        <p className="text-xs text-green-600 mt-1">Our admin team will review and contact you within 24–48 hours.</p>
        <button onClick={onDone} className="mt-3 text-xs text-green-700 underline">Close</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-3 bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={14} className="text-red-600 shrink-0" />
        <p className="text-sm font-semibold text-red-800">File a Dispute</p>
      </div>
      <p className="text-xs text-red-600">
        Use this if you have a genuine issue with this transaction. False disputes may result in account suspension.
      </p>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Issue Type</label>
        <select value={subject} onChange={(e) => setSubject(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
          {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {subject === "Other" && (
        <input
          value={customSubject}
          onChange={(e) => setCustomSubject(e.target.value)}
          placeholder="Briefly describe the issue"
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
      )}

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Additional Details (optional)</label>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="Provide any extra context that will help us investigate..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={submitting}
          className="flex items-center gap-1.5 bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-red-700 disabled:opacity-50">
          {submitting && <Loader2 size={12} className="animate-spin" />}
          {submitting ? "Submitting…" : "Submit Dispute"}
        </button>
        <button type="button" onClick={onDone} className="text-xs text-gray-500 hover:text-gray-700 px-3 py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function OffersPage() {
  const { user, loading: authLoading } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [counterInputs, setCounterInputs] = useState<Record<string, string>>({});
  const [showCounter, setShowCounter] = useState<Record<string, boolean>>({});
  const [showReview, setShowReview] = useState<Record<string, boolean>>({});
  const [showDispute, setShowDispute] = useState<Record<string, boolean>>({});
  const [reviewedOffers, setReviewedOffers] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    api.get("/api/offers").then((res) => {
      setOffers(res.data ?? []);
      setLoading(false);
    });
  }, [user]);

  async function act(offerId: string, status: string, counterAmount?: number) {
    setActing(offerId);
    const res = await api.patch("/api/offers", { id: offerId, status, counterAmount });
    setActing(null);
    if (res.error) { setMsg(`Error: ${res.error}`); return; }
    setOffers((prev) => prev.map((o) =>
      o.id === offerId ? { ...o, status, counter_amount: counterAmount ?? o.counter_amount } : o
    ));
    setShowCounter((prev) => ({ ...prev, [offerId]: false }));
    setMsg(status === "accepted" ? "Offer accepted!" : status === "rejected" ? "Offer rejected." : "Counter-offer sent.");
    setTimeout(() => setMsg(""), 3000);
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

  const received = offers.filter((o) => o.seller_id === user.id);
  const sent     = offers.filter((o) => o.buyer_id  === user.id);
  const active   = tab === "received" ? received : sent;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Offers</h1>

      {msg && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-2.5 rounded-xl mb-4">{msg}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 w-fit">
        {(["received", "sent"] as const).map((t) => {
          const count = t === "received" ? received.length : sent.length;
          return (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${tab === t ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
              {t} {count > 0 && (
                <span className={`ml-1 text-xs rounded-full px-1.5 py-0.5 font-bold ${tab === t ? "bg-white/30 text-white" : "bg-gray-100 text-gray-600"}`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {active.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <p className="text-gray-400 text-sm">No {tab} offers yet.</p>
          {tab === "sent" && (
            <Link href="/listings" className="text-indigo-600 text-sm underline mt-2 block">Browse listings to make an offer</Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {active.map((offer) => {
            const isSeller = offer.seller_id === user.id;
            const other = isSeller ? offer.buyer : offer.seller;
            const canAct = isSeller && offer.status === "pending";
            const isActing = acting === offer.id;
            const canReview = !isSeller && offer.status === "accepted" && !reviewedOffers.has(offer.id);
            const statusChanged = offer.updated_at && offer.updated_at !== offer.created_at;

            return (
              <div key={offer.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">

                {/* ── Card header ── */}
                <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/listings/${offer.pet_id}`}
                      className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors text-sm">
                      {offer.pet?.name ?? "Pet"}
                    </Link>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_STYLES[offer.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {offer.status}
                    </span>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-[11px] text-gray-400">{isSeller ? "Received" : "Sent"}</p>
                    <p className="text-xs font-medium text-gray-600">{formatTimestamp(offer.created_at)}</p>
                  </div>
                </div>

                <div className="p-5 space-y-4">

                  {/* ── Parties + listed price ── */}
                  <p className="text-xs text-gray-500">
                    {isSeller ? "From buyer:" : "To seller:"}{" "}
                    <span className="font-semibold text-gray-800">{other?.name ?? "—"}</span>
                    {offer.pet?.price && (
                      <span className="ml-2 text-gray-400">· Listed at ₦{Number(offer.pet.price).toLocaleString()}</span>
                    )}
                  </p>

                  {/* ── Message bubble ── */}
                  {offer.note ? (
                    <div className={`flex ${isSeller ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-xs sm:max-w-sm rounded-2xl px-4 py-3 text-sm ${
                        isSeller
                          ? "bg-gray-100 text-gray-800 rounded-bl-sm"
                          : "bg-indigo-600 text-white rounded-br-sm"
                      }`}>
                        <p className="whitespace-pre-wrap break-words leading-relaxed">{offer.note}</p>
                        <p className={`text-[11px] mt-2 ${isSeller ? "text-gray-400" : "text-indigo-200"}`}>
                          {isSeller ? `${offer.buyer?.name ?? "Buyer"} · ` : "You · "}{formatTimestamp(offer.created_at)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No message included with this offer.</p>
                  )}

                  {/* ── Amounts ── */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="bg-indigo-50 rounded-xl px-4 py-2">
                      <p className="text-[10px] text-indigo-500 font-semibold uppercase tracking-wide">Offer Amount</p>
                      <p className="text-lg font-bold text-indigo-700">₦{Number(offer.amount).toLocaleString()}</p>
                    </div>
                    {offer.counter_amount && (
                      <>
                        <ArrowLeftRight size={14} className="text-gray-300" />
                        <div className="bg-blue-50 rounded-xl px-4 py-2">
                          <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide">Counter Offer</p>
                          <p className="text-lg font-bold text-blue-700">₦{Number(offer.counter_amount).toLocaleString()}</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* ── Status update timestamp ── */}
                  {statusChanged && (
                    <p className="text-[11px] text-gray-400">
                      {offer.status === "accepted" && "✓ Accepted"}
                      {offer.status === "rejected" && "✕ Rejected"}
                      {offer.status === "countered" && "↩ Counter sent"}
                      {" · "}{formatTimestamp(offer.updated_at!)}
                    </p>
                  )}

                  {/* ── Seller actions ── */}
                  {canAct && (
                    <div className="flex gap-2 flex-wrap items-center pt-1">
                      <button onClick={() => act(offer.id, "accepted")} disabled={isActing}
                        className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-green-700 disabled:opacity-50">
                        {isActing ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Accept
                      </button>
                      <button onClick={() => act(offer.id, "rejected")} disabled={isActing}
                        className="flex items-center gap-1.5 border border-red-300 text-red-600 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-red-50 disabled:opacity-50">
                        <XCircle size={12} /> Reject
                      </button>
                      <button
                        onClick={() => setShowCounter((prev) => ({ ...prev, [offer.id]: !prev[offer.id] }))}
                        className="flex items-center gap-1.5 border border-gray-300 text-gray-600 px-4 py-2 rounded-xl text-xs font-semibold hover:bg-gray-50">
                        <ArrowLeftRight size={12} /> Counter
                        {showCounter[offer.id] ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                    </div>
                  )}

                  {/* ── Counter input ── */}
                  {showCounter[offer.id] && (
                    <div className="flex gap-2 items-center">
                      <div className="relative flex-1 max-w-[200px]">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 font-medium">₦</span>
                        <input type="number" min={1} value={counterInputs[offer.id] ?? ""}
                          onChange={(e) => setCounterInputs((prev) => ({ ...prev, [offer.id]: e.target.value }))}
                          placeholder="Your price"
                          className="w-full border border-gray-300 rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <button disabled={!counterInputs[offer.id] || isActing}
                        onClick={() => act(offer.id, "countered", Number(counterInputs[offer.id]))}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-50">
                        Send Counter
                      </button>
                    </div>
                  )}

                  {/* ── Buyer: accepted ── */}
                  {!isSeller && offer.status === "accepted" && (
                    <div>
                      <div className="text-xs text-green-700 bg-green-50 rounded-xl px-4 py-3 mb-3">
                        🎉 Your offer was accepted! Pay securely below, then arrange the handover with the seller.
                      </div>

                      {/* Secure escrow payment */}
                      <PaymentPanel offer={offer} isSeller={false} />

                      <div className="flex gap-2 flex-wrap mt-3">
                        {canReview && !showReview[offer.id] && (
                          <button
                            onClick={() => setShowReview((prev) => ({ ...prev, [offer.id]: true }))}
                            className="flex items-center gap-1.5 text-xs text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-xl hover:bg-indigo-50">
                            <Star size={12} /> Leave a Review
                          </button>
                        )}
                        {!showDispute[offer.id] && (
                          <button
                            onClick={() => {
                              setShowReview((prev) => ({ ...prev, [offer.id]: false }));
                              setShowDispute((prev) => ({ ...prev, [offer.id]: true }));
                            }}
                            className="flex items-center gap-1.5 text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50">
                            <AlertTriangle size={12} /> Report an Issue
                          </button>
                        )}
                      </div>
                      {showReview[offer.id] && (
                        <ReviewForm
                          offer={offer}
                          onDone={() => {
                            setShowReview((prev) => ({ ...prev, [offer.id]: false }));
                            setReviewedOffers((prev) => new Set([...prev, offer.id]));
                            setMsg("Review submitted — thank you!");
                            setTimeout(() => setMsg(""), 3000);
                          }}
                        />
                      )}
                      {reviewedOffers.has(offer.id) && (
                        <p className="text-xs text-green-600 mt-1">✓ Review submitted</p>
                      )}
                      {showDispute[offer.id] && (
                        <DisputeForm
                          offer={offer}
                          currentUserId={user.id}
                          onDone={() => setShowDispute((prev) => ({ ...prev, [offer.id]: false }))}
                        />
                      )}
                    </div>
                  )}

                  {/* ── Seller: accepted → escrow status ── */}
                  {isSeller && offer.status === "accepted" && (
                    <div>
                      <PaymentPanel offer={offer} isSeller={true} />
                      <div className="flex gap-2 flex-wrap mt-3">
                        {!showDispute[offer.id] && (
                          <button
                            onClick={() => setShowDispute((prev) => ({ ...prev, [offer.id]: true }))}
                            className="flex items-center gap-1.5 text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50">
                            <AlertTriangle size={12} /> Report an Issue
                          </button>
                        )}
                      </div>
                      {showDispute[offer.id] && (
                        <DisputeForm
                          offer={offer}
                          currentUserId={user.id}
                          onDone={() => setShowDispute((prev) => ({ ...prev, [offer.id]: false }))}
                        />
                      )}
                    </div>
                  )}

                  {/* ── Buyer: countered ── */}
                  {!isSeller && offer.status === "countered" && offer.counter_amount && (
                    <div className="text-xs text-blue-700 bg-blue-50 rounded-xl px-4 py-3">
                      Seller countered at <strong>₦{Number(offer.counter_amount).toLocaleString()}</strong>. Contact them to negotiate further.
                    </div>
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
