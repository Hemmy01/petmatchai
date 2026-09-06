"use client";
import { use, useEffect, useRef, useState } from "react";
import { MapPin, CheckCircle, MessageSquare, Heart, Share2, Star, Loader2, ArrowLeft, Pencil, Layers, ThumbsUp, ChevronLeft, ChevronRight, Play, Check, ImagePlus, X as XIcon } from "lucide-react";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import PetCard, { PetCardData } from "@/components/listings/PetCard";

type Pet = {
  id: string; name: string; species: string; breed: string; age_months: number;
  gender: string; color: string | null; price: number; location: string;
  description: string | null; vaccinated: boolean; dewormed: boolean;
  microchipped: boolean; registration_info: string | null; pedigree: string | null;
  status: string; image_url: string | null; views: number; inquiries: number;
  seller: { id: string; name: string; location: string | null; is_verified: boolean } | null;
};

type Review = {
  id: string; rating: number; comment: string | null; is_verified: boolean;
  communication_rating: number | null; accuracy_rating: number | null; health_rating: number | null;
  seller_reply: string | null; seller_reply_at: string | null;
  photo_urls: string[] | null;
  helpful_count: number | null;
  created_at: string;
  reviewer: { name: string } | null;
};

export default function PetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, session } = useAuth();
  const viewedRef = useRef<string | null>(null);

  const [pet, setPet] = useState<Pet | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"details" | "reviews">("details");

  // message form
  const [message, setMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgSent, setMsgSent] = useState(false);

  // offer form
  const [offer, setOffer] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [sendingOffer, setSendingOffer] = useState(false);
  const [offerSent, setOfferSent] = useState(false);

  // save state
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // seller reply state
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});
  const [showReply, setShowReply] = useState<Record<string, boolean>>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);

  // helpful votes
  const [helpfulVoted, setHelpfulVoted] = useState<Set<string>>(new Set());
  const [helpfulCounts, setHelpfulCounts] = useState<Record<string, number>>({});

  // similar pets
  const [similarPets, setSimilarPets] = useState<PetCardData[]>([]);

  // review form
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewCommRating, setReviewCommRating] = useState(0);
  const [reviewHealthRating, setReviewHealthRating] = useState(0);
  const [reviewAccuracyRating, setReviewAccuracyRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewPhotos, setReviewPhotos] = useState<File[]>([]);
  const [reviewPreviews, setReviewPreviews] = useState<string[]>([]);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewDone, setReviewDone] = useState(false);
  const [reviewHover, setReviewHover] = useState(0);

  // media carousel
  const [mediaItems, setMediaItems] = useState<{ type: "image" | "video"; url: string }[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const msgTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Load pet + reviews + record a view once per page visit (intentionally excludes `user`
  // from deps — it resolves asynchronously after mount and would otherwise re-trigger this and
  // double-count the view).
  useEffect(() => {
    async function load() {
      const [{ data: petData }, { data: reviewData }, { data: petImages }, { data: videoData }] = await Promise.all([
        supabase
          .from("pets")
          .select("*, seller:profiles!pets_seller_id_fkey(id, name, location, is_verified)")
          .eq("id", id)
          .single(),
        supabase
          .from("reviews")
          .select("*, reviewer:profiles!reviews_reviewer_id_fkey(name)")
          .eq("seller_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("pet_images")
          .select("url")
          .eq("pet_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("pet_videos")
          .select("url")
          .eq("pet_id", id)
          .limit(1)
          .maybeSingle(),
      ]);

      // Build ordered media: images first, video last
      const images = petImages && petImages.length > 0
        ? petImages.map((img) => ({ type: "image" as const, url: img.url }))
        : petData?.image_url ? [{ type: "image" as const, url: petData.image_url }] : [];
      const video = videoData?.url ? [{ type: "video" as const, url: videoData.url }] : [];
      setMediaItems([...images, ...video]);

      // Also fetch reviews by pet_id
      const { data: petReviews } = await supabase
        .from("reviews")
        .select("*, reviewer:profiles!reviews_reviewer_id_fkey(name)")
        .eq("pet_id", id)
        .order("created_at", { ascending: false });

      setPet(petData);
      const allReviews = [...(reviewData ?? []), ...(petReviews ?? [])];
      const unique = allReviews.filter((r, i, a) => a.findIndex((x) => x.id === r.id) === i);
      setReviews(unique);
      // Initialise helpful counts from DB
      setHelpfulCounts(Object.fromEntries(unique.map((r) => [r.id, r.helpful_count ?? 0])));
      setLoading(false);

      // Increment views + record per-buyer view history (fire-and-forget; server-side, bypasses RLS).
      // Raw fetch (not api.post) since views should count for anonymous visitors too, not just logged-in users.
      if (petData && viewedRef.current !== id) {
        viewedRef.current = id;
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        fetch(`/api/pets/${id}/view`, {
          method: "POST",
          headers: currentSession?.access_token ? { Authorization: `Bearer ${currentSession.access_token}` } : {},
        }).catch(() => {});
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Separately check saved status once auth resolves, without re-fetching pet/reviews/views
  useEffect(() => {
    if (!user) return;
    supabase
      .from("saved_pets")
      .select("id")
      .eq("user_id", user.id)
      .eq("pet_id", id)
      .single()
      .then(({ data }) => setSaved(!!data));
  }, [id, user]);

  // Fetch similar pets once the main pet is known
  useEffect(() => {
    if (!pet) return;
    supabase
      .from("pets")
      .select("*, seller:profiles!pets_seller_id_fkey(id, name, location, is_verified)")
      .eq("status", "active")
      .eq("species", pet.species)
      .neq("id", pet.id)
      .order("views", { ascending: false })
      .limit(4)
      .then(({ data }) => setSimilarPets(data ?? []));
  }, [pet]);

  async function handleSendMessage() {
    if (!message.trim() || !pet?.seller?.id) return;
    setSendingMsg(true);
    await api.post("/api/messages", {
      petId: id,
      sellerId: pet.seller.id,
      content: message,
    });
    setSendingMsg(false);
    setMsgSent(true);
    setMessage("");
  }

  async function handleSendOffer() {
    if (!offer || !pet) return;
    setSendingOffer(true);
    await api.post("/api/offers", { petId: id, amount: Number(offer), note: offerNote });
    setSendingOffer(false);
    setOfferSent(true);
    setOffer("");
    setOfferNote("");
  }

  async function handleSellerReply(reviewId: string) {
    const reply = replyInputs[reviewId]?.trim();
    if (!reply) return;
    setReplyingTo(reviewId);
    const res = await api.patch("/api/reviews", { id: reviewId, sellerReply: reply });
    setReplyingTo(null);
    if (!res.error) {
      setReviews((prev) => prev.map((r) =>
        r.id === reviewId ? { ...r, seller_reply: reply, seller_reply_at: new Date().toISOString() } : r
      ));
      setShowReply((prev) => ({ ...prev, [reviewId]: false }));
    }
  }

  async function handleSave() {
    if (!user) return;
    const action = saved ? "unsave" : "save";
    await api.post("/api/matches", { petId: id, action });
    setSaved(!saved);
  }

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: pet?.name ?? "PetMatchAI", text: `Check out ${pet?.name} on PetMatchAI`, url }); return; } catch { /* cancelled */ }
    }
    let success = false;
    try {
      await navigator.clipboard.writeText(url);
      success = true;
    } catch {
      // clipboard API blocked on HTTP — use execCommand fallback
      try {
        const el = document.createElement("textarea");
        el.value = url;
        el.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
        document.body.appendChild(el);
        el.select();
        success = document.execCommand("copy");
        document.body.removeChild(el);
      } catch { /* ignore */ }
    }
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  async function handleHelpfulVote(reviewId: string) {
    if (!user) return;
    const res = await api.post("/api/reviews/helpful", { reviewId });
    if (!res.error) {
      setHelpfulCounts((prev) => ({ ...prev, [reviewId]: res.helpfulCount }));
      setHelpfulVoted((prev) => {
        const next = new Set(prev);
        res.voted ? next.add(reviewId) : next.delete(reviewId);
        return next;
      });
    }
  }

  async function handleReviewPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 3 - reviewPhotos.length);
    const next = [...reviewPhotos, ...files].slice(0, 3);
    setReviewPhotos(next);
    setReviewPreviews(next.map((f) => URL.createObjectURL(f)));
    e.target.value = "";
  }

  function removeReviewPhoto(i: number) {
    URL.revokeObjectURL(reviewPreviews[i]);
    setReviewPhotos((p) => p.filter((_, idx) => idx !== i));
    setReviewPreviews((p) => p.filter((_, idx) => idx !== i));
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (reviewRating === 0) { setReviewError("Please select an overall rating."); return; }
    if (!pet?.seller?.id) return;
    setReviewError("");
    setReviewSubmitting(true);

    const photoUrls: string[] = [];
    if (reviewPhotos.length > 0) {
      const { data: { session } } = await supabase.auth.getSession();
      for (const file of reviewPhotos) {
        const form = new FormData();
        form.append("file", file);
        form.append("bucket", "pet-images");
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
          body: form,
        });
        if (res.ok) { const j = await res.json(); photoUrls.push(j.url); }
      }
    }

    const res = await api.post("/api/reviews", {
      sellerId: pet.seller.id,
      petId: id,
      rating: reviewRating,
      communicationRating: reviewCommRating || null,
      healthRating: reviewHealthRating || null,
      accuracyRating: reviewAccuracyRating || null,
      comment: reviewComment.trim() || null,
      photoUrls: photoUrls.length > 0 ? photoUrls : undefined,
    });

    setReviewSubmitting(false);
    if (res.error) { setReviewError(res.error); return; }

    const newReview = {
      ...res.data,
      reviewer: { name: user?.name ?? "You" },
      helpful_count: 0,
    };
    setReviews((prev) => [newReview, ...prev]);
    setHelpfulCounts((prev) => ({ ...prev, [newReview.id]: 0 }));
    setReviewDone(true);
    setShowReviewForm(false);
  }

  function RatingDistribution() {
    if (reviews.length === 0) return null;
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="flex items-center gap-5">
          <div className="text-center shrink-0">
            <div className="text-4xl font-bold text-gray-900">{avg.toFixed(1)}</div>
            <div className="flex justify-center gap-0.5 my-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={12} className={i < Math.round(avg) ? "text-yellow-400 fill-yellow-400" : "text-gray-200 fill-gray-200"} />
              ))}
            </div>
            <div className="text-xs text-gray-400">{reviews.length} review{reviews.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="flex-1 space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviews.filter((r) => r.rating === star).length;
              const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-3 shrink-0">{star}</span>
                  <Star size={10} className="text-yellow-400 fill-yellow-400 shrink-0" />
                  <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 w-4 text-right shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-3">🐾</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Pet not found</h2>
        <Link href="/listings" className="text-indigo-600 hover:underline text-sm">← Back to listings</Link>
      </div>
    );
  }

  const ageDisplay = pet.age_months < 12
    ? `${pet.age_months} month${pet.age_months !== 1 ? "s" : ""}`
    : `${Math.round(pet.age_months / 12)} yr${Math.round(pet.age_months / 12) !== 1 ? "s" : ""}`;

  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/listings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ArrowLeft size={14} /> Back to listings
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Media Carousel */}
        <div className="flex flex-col gap-2">
          {/* Main slide */}
          <div
            className="relative rounded-2xl overflow-hidden bg-black aspect-[4/3] select-none"
            onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              if (touchStartX.current === null || mediaItems.length < 2) return;
              const delta = touchStartX.current - e.changedTouches[0].clientX;
              if (Math.abs(delta) > 40) {
                setCurrentSlide((prev) => delta > 0
                  ? (prev + 1) % mediaItems.length
                  : (prev - 1 + mediaItems.length) % mediaItems.length);
              }
              touchStartX.current = null;
            }}
          >
            {mediaItems.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-8xl bg-gradient-to-br from-indigo-100 to-purple-100">
                {pet.species === "cat" ? "🐱" : "🐶"}
              </div>
            ) : mediaItems[currentSlide].type === "image" ? (
              <img
                src={mediaItems[currentSlide].url}
                alt={`${pet.name} photo ${currentSlide + 1}`}
                className="w-full h-full object-contain"
              />
            ) : (
              <video
                key={mediaItems[currentSlide].url}
                src={mediaItems[currentSlide].url}
                controls
                className="w-full h-full object-contain"
              />
            )}

            {/* Prev / Next arrows */}
            {mediaItems.length > 1 && (
              <>
                <button
                  onClick={() => setCurrentSlide((p) => (p - 1 + mediaItems.length) % mediaItems.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors backdrop-blur-sm"
                  aria-label="Previous">
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setCurrentSlide((p) => (p + 1) % mediaItems.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors backdrop-blur-sm"
                  aria-label="Next">
                  <ChevronRight size={20} />
                </button>
              </>
            )}

            {/* Slide counter */}
            {mediaItems.length > 1 && (
              <div className="absolute top-3 right-3 bg-black/50 text-white text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm">
                {currentSlide + 1} / {mediaItems.length}
              </div>
            )}

            {/* Dot indicators */}
            {mediaItems.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {mediaItems.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={`rounded-full transition-all duration-200 ${i === currentSlide ? "bg-white w-5 h-2" : "bg-white/50 w-2 h-2"}`}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Thumbnail strip */}
          {mediaItems.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {mediaItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${i === currentSlide ? "border-indigo-500 opacity-100" : "border-transparent opacity-60 hover:opacity-90"}`}
                >
                  {item.type === "image" ? (
                    <img src={item.url} alt={`Thumb ${i + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-900 flex items-center justify-center">
                      <Play size={20} className="text-white" fill="white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-start justify-between mb-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{pet.name}</h1>
              <p className="text-gray-500 text-sm">
                <Link href={`/listings?breed=${encodeURIComponent(pet.breed)}`} className="hover:text-indigo-600 hover:underline">{pet.breed}</Link>
                {" · "}{ageDisplay} · {pet.gender}
              </p>
            </div>
            {pet.status !== "active" && (
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${pet.status === "sold" ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-700"}`}>
                {pet.status}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 text-sm text-gray-500 mb-3">
            <MapPin size={14} /> {pet.location}
          </div>

          {/* Health badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {pet.vaccinated && (
              <span className="flex items-center gap-1 bg-green-50 text-green-700 text-xs px-2 py-1 rounded-full">
                <CheckCircle size={12} /> Vaccinated
              </span>
            )}
            {pet.dewormed && (
              <span className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-full">
                <CheckCircle size={12} /> Dewormed
              </span>
            )}
            {pet.microchipped && (
              <span className="flex items-center gap-1 bg-purple-50 text-purple-700 text-xs px-2 py-1 rounded-full">
                <CheckCircle size={12} /> Microchipped
              </span>
            )}
            {pet.color && (
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full capitalize">{pet.color}</span>
            )}
          </div>

          {pet.description && (
            <p className="text-gray-600 text-sm mb-4 leading-relaxed">{pet.description}</p>
          )}

          <div className="text-2xl font-bold text-indigo-600 mb-1">₦{pet.price.toLocaleString()}</div>

          {reviews.length > 0 && (
            <div className="flex items-center gap-1 mb-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={13} className={i < Math.round(avgRating) ? "text-yellow-400 fill-yellow-400" : "text-gray-200"} />
              ))}
              <span className="text-xs text-gray-500 ml-1">{avgRating.toFixed(1)} ({reviews.length} review{reviews.length !== 1 ? "s" : ""})</span>
            </div>
          )}

          {/* Seller */}
          {pet.seller && (
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
              <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xs">
                {pet.seller.name[0]}
              </div>
              <span>{pet.seller.name}</span>
              {pet.seller.is_verified && <VerifiedBadge size={15} />}
            </div>
          )}

          {/* Meta */}
          <div className="flex gap-4 text-xs text-gray-400 mb-4">
            <span>{pet.views} views</span>
            <span>{pet.inquiries} inquiries</span>
          </div>

          <div className="flex gap-2">
            {user?.id === pet.seller?.id ? (
              <Link href={`/listings/${id}/edit`}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 text-sm">
                <Pencil size={16} /> Edit Listing
              </Link>
            ) : (
              <button
                onClick={() => {
                  setTab("details");
                  setTimeout(() => {
                    msgTextareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                    msgTextareaRef.current?.focus();
                  }, 50);
                }}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 text-sm">
                <MessageSquare size={16} /> Message Seller
              </button>
            )}
            <button
              onClick={handleSave}
              className={`p-2.5 border rounded-xl transition-colors ${saved ? "border-red-300 text-red-500 bg-red-50" : "border-gray-300 text-gray-500 hover:text-red-500 hover:border-red-300"}`}>
              <Heart size={18} className={saved ? "fill-red-500" : ""} />
            </button>
            <button
              onClick={handleShare}
              className={`flex items-center gap-1.5 px-3 py-2.5 border rounded-xl text-sm font-medium transition-all ${copied ? "border-green-300 text-green-600 bg-green-50" : "border-gray-300 text-gray-500 hover:bg-gray-50"}`}>
              {copied ? <><Check size={16} /> Copied!</> : <><Share2 size={16} /> Share</>}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-8">
        <div className="flex border-b border-gray-200 mb-4">
          {(["details", "reviews"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${tab === t ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t} {t === "reviews" && reviews.length > 0 && `(${reviews.length})`}
            </button>
          ))}
        </div>

        {tab === "details" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contact + offer forms — hidden on your own listing (you can't message/offer yourself) */}
            {user?.id !== pet.seller?.id && (<>
            {/* Message form */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Send Inquiry</h3>
              {!session ? (
                <p className="text-sm text-gray-500">
                  <Link href="/auth/login" className="text-indigo-600 hover:underline">Sign in</Link> to message the seller.
                </p>
              ) : msgSent ? (
                <div className="text-center py-4">
                  <div className="text-3xl mb-2">✅</div>
                  <p className="text-sm text-green-700 font-medium">Message sent!</p>
                  <button onClick={() => setMsgSent(false)} className="text-xs text-indigo-600 mt-1 hover:underline">Send another</button>
                </div>
              ) : (
                <>
                  <textarea ref={msgTextareaRef} value={message} onChange={(e) => setMessage(e.target.value)} rows={3}
                    placeholder="Hi, I'm interested in this pet..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3 resize-none" />
                  <button onClick={handleSendMessage} disabled={sendingMsg || !message.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                    {sendingMsg && <Loader2 size={14} className="animate-spin" />}
                    {sendingMsg ? "Sending..." : "Send Message"}
                  </button>
                </>
              )}
            </div>

            {/* Offer form */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <h3 className="font-semibold text-gray-900 mb-3">Make an Offer</h3>
              {!session ? (
                <p className="text-sm text-gray-500">
                  <Link href="/auth/login" className="text-indigo-600 hover:underline">Sign in</Link> to make an offer.
                </p>
              ) : offerSent ? (
                <div className="text-center py-4">
                  <div className="text-3xl mb-2">🎉</div>
                  <p className="text-sm text-green-700 font-medium">Offer submitted!</p>
                  <button onClick={() => setOfferSent(false)} className="text-xs text-indigo-600 mt-1 hover:underline">Make another offer</button>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-2">Listed price: <span className="font-semibold">₦{pet.price.toLocaleString()}</span></p>
                  <input type="number" value={offer} onChange={(e) => setOffer(e.target.value)}
                    placeholder="Your offer amount (₦)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2" />
                  <textarea value={offerNote} onChange={(e) => setOfferNote(e.target.value)} rows={2}
                    placeholder="Optional note to seller..."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3 resize-none" />
                  <button onClick={handleSendOffer} disabled={sendingOffer || !offer}
                    className="w-full flex items-center justify-center gap-2 border border-indigo-600 text-indigo-600 py-2 rounded-lg text-sm font-medium hover:bg-indigo-50 disabled:opacity-50">
                    {sendingOffer && <Loader2 size={14} className="animate-spin" />}
                    {sendingOffer ? "Submitting..." : "Submit Offer"}
                  </button>
                </>
              )}
            </div>
            </>)}

            {/* Extra details */}
            {(pet.registration_info || pet.pedigree) && (
              <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="font-semibold text-gray-900 mb-3">Additional Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {pet.registration_info && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Registration</p>
                      <p className="text-gray-800">{pet.registration_info}</p>
                    </div>
                  )}
                  {pet.pedigree && (
                    <div>
                      <p className="text-xs text-gray-500 mb-0.5">Pedigree</p>
                      <p className="text-gray-800">{pet.pedigree}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "reviews" && (
          <div className="space-y-4">
            <RatingDistribution />

            {/* Write a review — visible to any logged-in buyer who isn't the seller */}
            {user && user.id !== pet.seller?.id && (
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                {reviewDone ? (
                  <p className="text-sm text-green-700 font-medium">✓ Your review has been submitted. Thank you!</p>
                ) : showReviewForm ? (
                  <form onSubmit={submitReview} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-gray-900 text-sm">Write a Review</p>
                      <button type="button" onClick={() => setShowReviewForm(false)} className="text-gray-400 hover:text-gray-600"><XIcon size={16} /></button>
                    </div>

                    {/* Overall star rating */}
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Overall Rating *</p>
                      <div className="flex gap-1">
                        {[1,2,3,4,5].map((i) => (
                          <button key={i} type="button"
                            onMouseEnter={() => setReviewHover(i)} onMouseLeave={() => setReviewHover(0)}
                            onClick={() => setReviewRating(i)}
                            className="text-yellow-400 transition-transform hover:scale-110">
                            <Star size={24} className={(reviewHover || reviewRating) >= i ? "fill-yellow-400" : "text-gray-200 fill-gray-200"} />
                          </button>
                        ))}
                        {reviewRating > 0 && (
                          <span className="ml-2 text-sm text-gray-500 self-center">
                            {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][reviewRating]}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Sub-ratings */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "Communication", value: reviewCommRating, set: setReviewCommRating },
                        { label: "Accuracy", value: reviewAccuracyRating, set: setReviewAccuracyRating },
                        { label: "Pet Health", value: reviewHealthRating, set: setReviewHealthRating },
                      ].map(({ label, value, set }) => (
                        <div key={label}>
                          <p className="text-xs text-gray-500 mb-1">{label}</p>
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map((i) => (
                              <button key={i} type="button" onClick={() => set(i)} className="text-yellow-400">
                                <Star size={13} className={value >= i ? "fill-yellow-400" : "text-gray-200 fill-gray-200"} />
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <textarea rows={3} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Share your experience with this seller and pet..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />

                    {/* Photo upload */}
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-2">Photos (up to 3, optional)</p>
                      <div className="flex gap-2 flex-wrap">
                        {reviewPreviews.map((src, i) => (
                          <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                            <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                            <button type="button" onClick={() => removeReviewPhoto(i)}
                              className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80">
                              <XIcon size={10} />
                            </button>
                          </div>
                        ))}
                        {reviewPhotos.length < 3 && (
                          <label className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors shrink-0">
                            <ImagePlus size={16} className="text-gray-400" />
                            <span className="text-[10px] text-gray-400 mt-0.5">Add</span>
                            <input type="file" className="hidden" accept="image/jpeg,image/png,image/webp" multiple onChange={handleReviewPhoto} />
                          </label>
                        )}
                      </div>
                    </div>

                    {reviewError && <p className="text-xs text-red-600">{reviewError}</p>}

                    <div className="flex gap-2">
                      <button type="submit" disabled={reviewSubmitting}
                        className="flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                        {reviewSubmitting && <Loader2 size={13} className="animate-spin" />}
                        {reviewSubmitting ? "Submitting…" : "Submit Review"}
                      </button>
                      <button type="button" onClick={() => setShowReviewForm(false)}
                        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button onClick={() => setShowReviewForm(true)}
                    className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700">
                    <Star size={15} className="fill-yellow-400 text-yellow-400" />
                    Write a Review for this seller
                  </button>
                )}
              </div>
            )}

            {reviews.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Star size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No reviews yet for this seller.</p>
              </div>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 text-xs font-bold">
                        {r.reviewer?.name?.[0] ?? "?"}
                      </div>
                      <span className="font-medium text-sm text-gray-900">{r.reviewer?.name ?? "Anonymous"}</span>
                      {r.is_verified && (
                        <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <CheckCircle size={10} /> Verified
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={13} className={i < r.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-200"} />
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-sm text-gray-600 mb-2">{r.comment}</p>}
                  {r.photo_urls && r.photo_urls.length > 0 && (
                    <div className="flex gap-2 mb-2 flex-wrap">
                      {r.photo_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                          className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 block shrink-0 hover:opacity-90 transition-opacity">
                          <img src={url} alt={`Review photo ${i + 1}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 mb-2">
                    {r.communication_rating && <span>Communication: {r.communication_rating}/5</span>}
                    {r.health_rating && <span>Pet Health: {r.health_rating}/5</span>}
                    {r.accuracy_rating && <span>Accuracy: {r.accuracy_rating}/5</span>}
                    <span>{new Date(r.created_at).toLocaleDateString()}</span>
                    <button
                      onClick={() => handleHelpfulVote(r.id)}
                      disabled={!user}
                      className={`ml-auto flex items-center gap-1 px-2.5 py-1 rounded-full border transition-colors ${
                        helpfulVoted.has(r.id)
                          ? "bg-indigo-50 border-indigo-300 text-indigo-600"
                          : "border-gray-200 text-gray-400 hover:text-indigo-600 hover:border-indigo-300"
                      } disabled:opacity-40 disabled:cursor-default`}>
                      <ThumbsUp size={11} fill={helpfulVoted.has(r.id) ? "currentColor" : "none"} />
                      Helpful {(helpfulCounts[r.id] ?? 0) > 0 && `(${helpfulCounts[r.id]})`}
                    </button>
                  </div>

                  {/* Seller reply */}
                  {r.seller_reply && (
                    <div className="bg-indigo-50 border-l-2 border-indigo-300 rounded-r-lg px-3 py-2 mt-1">
                      <p className="text-xs font-semibold text-indigo-700 mb-0.5">Seller reply</p>
                      <p className="text-xs text-gray-700">{r.seller_reply}</p>
                    </div>
                  )}

                  {/* Seller reply form */}
                  {user?.id === pet.seller?.id && !r.seller_reply && (
                    <div className="mt-2">
                      {!showReply[r.id] ? (
                        <button onClick={() => setShowReply((p) => ({ ...p, [r.id]: true }))}
                          className="text-xs text-indigo-600 hover:underline">Reply to this review</button>
                      ) : (
                        <div className="flex gap-2 items-start">
                          <textarea rows={2} value={replyInputs[r.id] ?? ""} onChange={(e) => setReplyInputs((p) => ({ ...p, [r.id]: e.target.value }))}
                            placeholder="Write a public reply…"
                            className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
                          <div className="flex flex-col gap-1">
                            <button onClick={() => handleSellerReply(r.id)} disabled={replyingTo === r.id}
                              className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                              {replyingTo === r.id ? "…" : "Post"}
                            </button>
                            <button onClick={() => setShowReply((p) => ({ ...p, [r.id]: false }))}
                              className="text-xs text-gray-400 hover:text-gray-600 px-3 py-1">Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Similar pets */}
      {similarPets.length > 0 && (
        <section className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Layers size={16} className="text-indigo-600" />
            <h2 className="font-semibold text-gray-900">Similar {pet.species}s you may like</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {similarPets.map((p) => <PetCard key={p.id} pet={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
