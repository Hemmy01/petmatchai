"use client";
import { useState, useEffect, useRef } from "react";
import { Save, Loader2, CheckCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import Link from "next/link";
import ImageUpload from "@/components/listings/ImageUpload";
import VideoUpload from "@/components/listings/VideoUpload";
import LocationSelect from "@/components/ui/LocationSelect";
import type { PriceHint } from "@/lib/forecast";

const SPECIES = [
  { value: "dog",   label: "Dog"                      },
  { value: "cat",   label: "Cat"                      },
  { value: "other", label: "Other (Bird, Rabbit, etc.)" },
] as const;
const GENDERS = ["male", "female"] as const;
const SIZES = [
  { value: "small", label: "Small (< 10 kg)" },
  { value: "medium", label: "Medium (10–25 kg)" },
  { value: "large", label: "Large (25–45 kg)" },
  { value: "extra_large", label: "Extra Large (45+ kg)" },
] as const;
const TRAIT_OPTIONS = ["Friendly", "Playful", "Calm", "Energetic", "Loyal", "Independent", "Good with kids", "Good with other pets", "Trained", "House-trained"] as const;

// Read the saved draft once. Called inside useState lazy initializers so it
// runs exactly once per mount, client-side only, with no useEffect needed.
function readDraft(): Record<string, any> | null {
  try {
    const raw = localStorage.getItem("pet_draft");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function NewListingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Each useState lazy-initializer calls readDraft() independently.
  // React caches the result across all of them within the same render.
  const [name, setName] = useState(() => readDraft()?.name ?? "");
  const [species, setSpecies] = useState<"dog" | "cat" | "other">(() => readDraft()?.species ?? "dog");
  const [breed, setBreed] = useState(() => readDraft()?.breed ?? "");
  const [ageYears, setAgeYears] = useState(() => String(readDraft()?.ageYears ?? "0"));
  const [ageMonths, setAgeMonths] = useState(() => String(readDraft()?.ageMonths ?? "0"));
  const [gender, setGender] = useState<"male" | "female">(() => readDraft()?.gender ?? "male");
  const [color, setColor] = useState(() => readDraft()?.color ?? "");
  const [vaccinated, setVaccinated] = useState(() => readDraft()?.vaccinated ?? false);
  const [dewormed, setDewormed] = useState(() => readDraft()?.dewormed ?? false);
  const [microchipped, setMicrochipped] = useState(() => readDraft()?.microchipped ?? false);
  const [hasPedigree, setHasPedigree] = useState(() => readDraft()?.hasPedigree ?? false);
  const [pedigree, setPedigree] = useState(() => readDraft()?.pedigree ?? "");
  const [registrationInfo, setRegistrationInfo] = useState(() => readDraft()?.registrationInfo ?? "");
  const [size, setSize] = useState(() => readDraft()?.size ?? "");
  const [selectedTraits, setSelectedTraits] = useState<string[]>(() => readDraft()?.selectedTraits ?? []);
  const [price, setPrice] = useState(() => String(readDraft()?.price ?? ""));
  const [location, setLocation] = useState(() => readDraft()?.location ?? "");
  const [description, setDescription] = useState(() => readDraft()?.description ?? "");
  const [featured, setFeatured] = useState(() => readDraft()?.featured ?? false);

  const [healthCertUrl, setHealthCertUrl] = useState<string | null>(null);
  const [certUploading, setCertUploading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [priceTip, setPriceTip] = useState<PriceHint | null>(null);

  // Live, debounced market price hint as the seller types breed + price.
  useEffect(() => {
    const p = Number(price);
    if (!breed.trim() || !p) { setPriceTip(null); return; }
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/api/analytics?priceHint=true&breed=${encodeURIComponent(breed.trim())}&price=${p}`);
        setPriceTip(res.hint ?? null);
      } catch { setPriceTip(null); }
    }, 500);
    return () => clearTimeout(t);
  }, [breed, price]);

  // Skip auto-save on the very first run (values just came from the draft).
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    try {
      localStorage.setItem("pet_draft", JSON.stringify({
        name, species, breed, ageYears, ageMonths, gender, color,
        vaccinated, dewormed, microchipped, hasPedigree, pedigree, registrationInfo,
        size, selectedTraits, price, location, description, featured,
      }));
    } catch {}
  }, [
    name, species, breed, ageYears, ageMonths, gender, color,
    vaccinated, dewormed, microchipped, hasPedigree, pedigree, registrationInfo,
    size, selectedTraits, price, location, description, featured,
  ]);

  // Set location from user profile if not already in draft
  useEffect(() => {
    if (user?.location && !location) setLocation(user.location);
  }, [user?.location]);

  const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-indigo-600" /></div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in required</h2>
        <p className="text-sm text-gray-500 mb-4">You need a seller account to create a listing.</p>
        <Link href="/auth/login" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 text-sm">
          Sign In
        </Link>
      </div>
    );
  }

  if (user.role !== "seller" && user.role !== "administrator") {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="text-4xl mb-3">🏪</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Seller account needed</h2>
        <p className="text-sm text-gray-500">Only sellers can create pet listings.</p>
      </div>
    );
  }

  async function handleSubmit(status: "active" | "pending") {
    if (!name.trim()) { setError("Pet name is required."); return; }
    if (!breed.trim()) { setError("Breed is required."); return; }
    if (!price || Number(price) <= 0) { setError("Please enter a valid price."); return; }
    if (!location.trim()) { setError("Location is required."); return; }
    if (imageUrls.length === 0) { setError("Please upload at least one photo before publishing."); return; }

    setError("");
    setSubmitting(true);

    const totalMonths = (Number(ageYears) * 12) + Number(ageMonths);

    const res = await api.post("/api/pets", {
      name: name.trim(),
      species,
      breed: breed.trim(),
      age_months: totalMonths,
      gender,
      color: color.trim() || null,
      size: size || null,
      traits: selectedTraits,
      health_certificate_url: healthCertUrl,
      price: Number(price),
      location: location.trim(),
      description: description.trim() || null,
      vaccinated,
      dewormed,
      microchipped,
      pedigree: hasPedigree ? pedigree.trim() || null : null,
      registration_info: registrationInfo.trim() || null,
      image_urls: imageUrls,
      video_url: videoUrl,
      featured,
      status,
    });

    setSubmitting(false);

    if (res.error) {
      setError(res.error);
      return;
    }

    localStorage.removeItem("pet_draft");
    router.push(`/listings/${res.data.id}`);
  }

  async function handleCertUpload(file: File) {
    setCertUploading(true);
    const { supabase: sb } = await import("@/lib/supabase");
    const path = `health-certs/${Date.now()}-${file.name}`;
    const { data } = await sb.storage.from("pet-images").upload(path, file, { upsert: true });
    if (data?.path) {
      const { data: { publicUrl } } = sb.storage.from("pet-images").getPublicUrl(data.path);
      setHealthCertUrl(publicUrl);
    }
    setCertUploading(false);
  }

  function toggleTrait(t: string) {
    setSelectedTraits((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  function handleSaveDraft() {
    try {
      localStorage.setItem("pet_draft", JSON.stringify({
        name, species, breed, ageYears, ageMonths, gender, color,
        vaccinated, dewormed, microchipped, hasPedigree, pedigree, registrationInfo,
        size, selectedTraits, price, location, description, featured,
      }));
    } catch {}
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Pet Listing</h1>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-8">

        {/* 1 — Pet Details */}
        <section>
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full text-xs flex items-center justify-center font-bold">1</span>
            Pet Details
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Pet Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inp} placeholder="e.g. Buddy" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Species *</label>
              <select value={species} onChange={(e) => setSpecies(e.target.value as "dog" | "cat" | "other")} className={inp}>
                {SPECIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Breed *</label>
              <input value={breed} onChange={(e) => setBreed(e.target.value)} className={inp} placeholder="e.g. Golden Retriever" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Age</label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input type="number" min={0} max={30} value={ageYears} onChange={(e) => setAgeYears(e.target.value)} className={inp} placeholder="0" />
                  <p className="text-xs text-gray-400 mt-0.5">years</p>
                </div>
                <div className="flex-1">
                  <input type="number" min={0} max={11} value={ageMonths} onChange={(e) => setAgeMonths(e.target.value)} className={inp} placeholder="0" />
                  <p className="text-xs text-gray-400 mt-0.5">months</p>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
              <select value={gender} onChange={(e) => setGender(e.target.value as typeof gender)} className={inp}>
                {GENDERS.map((g) => <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <input value={color} onChange={(e) => setColor(e.target.value)} className={inp} placeholder="e.g. Golden, Black & White" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Size</label>
              <select value={size} onChange={(e) => setSize(e.target.value)} className={inp}>
                <option value="">Select size</option>
                {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Personality Traits */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Personality Traits</label>
            <div className="flex flex-wrap gap-2">
              {TRAIT_OPTIONS.map((t) => (
                <button key={t} type="button" onClick={() => toggleTrait(t)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedTraits.includes(t)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-gray-300 text-gray-600 hover:border-indigo-400"
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 2 — Photos */}
        <section>
          <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full text-xs flex items-center justify-center font-bold">2</span>
            Photos <span className="text-red-500">*</span>
          </h2>
          <p className="text-xs text-gray-500 mb-3">Add up to 5 photos. The first photo is the primary thumbnail.</p>
          <ImageUpload bucket="pet-images" maxFiles={5} onChange={setImageUrls} />
        </section>

        {/* 3 — Video */}
        <section>
          <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full text-xs flex items-center justify-center font-bold">3</span>
            Video <span className="text-gray-400 font-normal text-sm">(optional)</span>
          </h2>
          <p className="text-xs text-gray-500 mb-3">A short clip helps buyers see the pet's personality. Recommended: 15–60 seconds.</p>
          <VideoUpload onChange={setVideoUrl} />
        </section>

        {/* 4 — Health */}
        <section>
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full text-xs flex items-center justify-center font-bold">4</span>
            Health Status
          </h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "Vaccinated", value: vaccinated, set: setVaccinated },
              { label: "Dewormed", value: dewormed, set: setDewormed },
              { label: "Microchipped", value: microchipped, set: setMicrochipped },
              { label: "Has Pedigree Papers", value: hasPedigree, set: setHasPedigree },
            ].map(({ label, value, set }) => (
              <label key={label} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                <input type="checkbox" checked={value} onChange={(e) => set(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
                {value && <CheckCircle size={14} className="text-green-500" />}
                {label}
              </label>
            ))}
          </div>
          {hasPedigree && (
            <div className="space-y-3 bg-gray-50 rounded-xl p-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Pedigree Details</label>
                <input value={pedigree} onChange={(e) => setPedigree(e.target.value)} className={inp} placeholder="e.g. Champion bloodline, AKC registered" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Registration Number</label>
                <input value={registrationInfo} onChange={(e) => setRegistrationInfo(e.target.value)} className={inp} placeholder="e.g. AKC-123456" />
              </div>
            </div>
          )}

          {/* Health Certificate Upload */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Health Certificate <span className="text-gray-400 font-normal text-xs">(optional PDF/image)</span></label>
            <div className="flex items-center gap-3">
              <label className="cursor-pointer flex items-center gap-2 text-sm border border-dashed border-gray-300 rounded-lg px-4 py-2 hover:border-indigo-400 text-gray-500 hover:text-indigo-600 transition-colors">
                <CheckCircle size={15} />
                {certUploading ? "Uploading…" : healthCertUrl ? "Replace certificate" : "Upload certificate"}
                <input type="file" accept="image/*,.pdf" className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleCertUpload(e.target.files[0]); }} />
              </label>
              {healthCertUrl && (
                <a href={healthCertUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-indigo-600 underline">View uploaded</a>
              )}
            </div>
          </div>
        </section>

        {/* 5 — Pricing & Location */}
        <section>
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full text-xs flex items-center justify-center font-bold">5</span>
            Pricing & Location
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Price (₦) *</label>
              <input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} className={inp} placeholder="150000" />
              {priceTip && (
                <p className={`text-xs mt-1 flex items-start gap-1 ${
                  priceTip.verdict === "above" ? "text-amber-600" :
                  priceTip.verdict === "below" ? "text-blue-600" : "text-green-600"
                }`}>
                  <span>{priceTip.verdict === "above" ? "⚠" : priceTip.verdict === "below" ? "↓" : "✓"}</span>
                  <span>{priceTip.message}</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
              <LocationSelect value={location} onChange={setLocation} required />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 mt-3 cursor-pointer select-none">
            <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="accent-indigo-600 w-4 h-4" />
            Feature this listing (shown on homepage)
          </label>
        </section>

        {/* 6 — Description */}
        <section>
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full text-xs flex items-center justify-center font-bold">6</span>
            Description
          </h2>
          <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
            className={`${inp} resize-none`}
            placeholder="Describe the pet's personality, habits, training, diet, and any other details buyers should know..." />
          <p className="text-xs text-gray-400 mt-1">{description.length} characters</p>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={handleSaveDraft} disabled={submitting}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50">
            <Save size={16} /> Save Draft
          </button>
          <button type="button" onClick={() => handleSubmit("pending")} disabled={submitting}
            className="px-4 py-2.5 border border-indigo-600 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-50 disabled:opacity-50">
            Save as Pending
          </button>
          <button type="button" onClick={() => handleSubmit("active")} disabled={submitting}
            className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60">
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "Publishing…" : "Publish & Verify →"}
          </button>
        </div>
      </div>
    </div>
  );
}
