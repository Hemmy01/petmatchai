"use client";
import { use, useState, useEffect } from "react";
import { Save, Loader2, CheckCircle, Trash2, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import ImageUpload from "@/components/listings/ImageUpload";
import VideoUpload from "@/components/listings/VideoUpload";
import LocationSelect from "@/components/ui/LocationSelect";

const SPECIES = ["dog", "cat", "other"] as const;
const GENDERS = ["male", "female"] as const;

export default function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [loadingPet, setLoadingPet] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<"dog" | "cat" | "other">("dog");
  const [breed, setBreed] = useState("");
  const [ageYears, setAgeYears] = useState("0");
  const [ageMonths, setAgeMonths] = useState("0");
  const [gender, setGender] = useState<"male" | "female">("male");
  const [color, setColor] = useState("");
  const [vaccinated, setVaccinated] = useState(false);
  const [dewormed, setDewormed] = useState(false);
  const [microchipped, setMicrochipped] = useState(false);
  const [hasPedigree, setHasPedigree] = useState(false);
  const [pedigree, setPedigree] = useState("");
  const [registrationInfo, setRegistrationInfo] = useState("");
  const [price, setPrice] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [featured, setFeatured] = useState(false);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);
  const [newImageUrls, setNewImageUrls] = useState<string[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Danger zone state
  const [marking, setMarking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [petStatus, setPetStatus] = useState("");

  const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  useEffect(() => {
    if (!user) return;
    supabase
      .from("pets")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data: pet }) => {
        if (!pet || pet.seller_id !== user.id) {
          setNotFound(true);
          setLoadingPet(false);
          return;
        }
        // Pre-fill state
        setName(pet.name ?? "");
        setSpecies((pet.species as typeof SPECIES[number]) ?? "dog");
        setBreed(pet.breed ?? "");
        const totalMonths = pet.age_months ?? 0;
        setAgeYears(String(Math.floor(totalMonths / 12)));
        setAgeMonths(String(totalMonths % 12));
        setGender((pet.gender as typeof GENDERS[number]) ?? "male");
        setColor(pet.color ?? "");
        setVaccinated(pet.vaccinated ?? false);
        setDewormed(pet.dewormed ?? false);
        setMicrochipped(pet.microchipped ?? false);
        setHasPedigree(!!(pet.pedigree));
        setPedigree(pet.pedigree ?? "");
        setRegistrationInfo(pet.registration_info ?? "");
        setPrice(String(pet.price ?? ""));
        setLocation(pet.location ?? "");
        setDescription(pet.description ?? "");
        setFeatured(pet.featured ?? false);
        setPetStatus(pet.status ?? "active");
        if (pet.image_url) setExistingImageUrl(pet.image_url);
        setLoadingPet(false);
      });
  }, [user, id]);

  async function handleSave() {
    if (!name.trim()) { setError("Pet name is required."); return; }
    if (!breed.trim()) { setError("Breed is required."); return; }
    if (!price || Number(price) <= 0) { setError("Please enter a valid price."); return; }
    if (!location.trim()) { setError("Location is required."); return; }

    setError("");
    setSuccess("");
    setSubmitting(true);

    const totalMonths = (Number(ageYears) * 12) + Number(ageMonths);

    const res = await api.patch("/api/pets", {
      id,
      name: name.trim(),
      species,
      breed: breed.trim(),
      age_months: totalMonths,
      gender,
      color: color.trim() || null,
      price: Number(price),
      location: location.trim(),
      description: description.trim() || null,
      vaccinated,
      dewormed,
      microchipped,
      pedigree: hasPedigree ? pedigree.trim() || null : null,
      registration_info: registrationInfo.trim() || null,
      image_url: newImageUrls[0] ?? existingImageUrl ?? null,
      featured,
    });

    setSubmitting(false);
    if (res.error) { setError(res.error); return; }
    setSuccess("Listing updated successfully!");
    setTimeout(() => setSuccess(""), 3000);
  }

  async function handleMarkSold() {
    const target = petStatus === "sold" ? "active" : "sold";
    setMarking(true);
    const res = await api.patch("/api/pets", { id, status: target });
    setMarking(false);
    if (!res.error) setPetStatus(target);
  }

  async function handleDelete() {
    setDeleting(true);
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/pets?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    });
    setDeleting(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Delete failed.");
      setConfirmDelete(false);
      return;
    }
    router.push("/dashboard");
  }

  if (authLoading || loadingPet) {
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

  if (notFound) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <p className="text-gray-500 text-sm">Listing not found or you don't own it.</p>
        <Link href="/dashboard" className="text-indigo-600 text-sm underline mt-2 block">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Edit Listing</h1>
        <Link href={`/listings/${id}`} className="text-sm text-indigo-600 hover:underline">View listing →</Link>
      </div>

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
              <select value={species} onChange={(e) => setSpecies(e.target.value as typeof species)} className={inp}>
                {SPECIES.map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
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
                  <input type="number" min={0} max={30} value={ageYears} onChange={(e) => setAgeYears(e.target.value)} className={inp} />
                  <p className="text-xs text-gray-400 mt-0.5">years</p>
                </div>
                <div className="flex-1">
                  <input type="number" min={0} max={11} value={ageMonths} onChange={(e) => setAgeMonths(e.target.value)} className={inp} />
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
          </div>
        </section>

        {/* 2 — Photos */}
        <section>
          <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full text-xs flex items-center justify-center font-bold">2</span>
            Photos
          </h2>
          <p className="text-xs text-gray-500 mb-3">Upload new photos to replace existing ones. Up to 5 photos.</p>
          {existingImageUrl && newImageUrls.length === 0 && (
            <div className="mb-3 flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <img src={existingImageUrl} alt="Current photo" className="w-16 h-16 object-cover rounded-lg border border-gray-200" />
              <div>
                <p className="text-xs font-medium text-gray-700">Current photo</p>
                <button onClick={() => setExistingImageUrl(null)} className="text-xs text-red-500 hover:underline mt-0.5">Remove</button>
              </div>
            </div>
          )}
          <ImageUpload bucket="pet-images" maxFiles={5} onChange={setNewImageUrls} />
        </section>

        {/* 3 — Video */}
        <section>
          <h2 className="font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <span className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-full text-xs flex items-center justify-center font-bold">3</span>
            Video <span className="text-gray-400 font-normal text-sm">(optional)</span>
          </h2>
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
            placeholder="Describe the pet's personality, habits, training, diet..." />
          <p className="text-xs text-gray-400 mt-1">{description.length} characters</p>
        </section>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2">
            <CheckCircle size={14} /> {success}
          </div>
        )}

        {/* Save */}
        <button onClick={handleSave} disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60">
          {submitting ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : <><Save size={16} /> Save Changes</>}
        </button>
      </div>

      {/* Danger Zone */}
      <div className="mt-6 bg-white rounded-2xl border border-red-200 p-6">
        <h2 className="font-semibold text-red-700 mb-4 flex items-center gap-2">
          <AlertTriangle size={16} /> Listing Management
        </h2>
        <div className="flex gap-3 flex-wrap">
          <button onClick={handleMarkSold} disabled={marking}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-colors disabled:opacity-50 ${
              petStatus === "sold"
                ? "border-green-600 text-green-700 hover:bg-green-50"
                : "border-orange-400 text-orange-700 hover:bg-orange-50"
            }`}>
            {marking && <Loader2 size={14} className="animate-spin" />}
            {petStatus === "sold" ? "Relist as Active" : "Mark as Sold"}
          </button>

          {!confirmDelete ? (
            <button onClick={() => setConfirmDelete(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-red-300 text-red-600 hover:bg-red-50">
              <Trash2 size={14} /> Delete Listing
            </button>
          ) : (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              <span className="text-xs text-red-700 font-medium">Are you sure?</span>
              <button onClick={handleDelete} disabled={deleting}
                className="bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50">
                {deleting ? "Deleting…" : "Yes, Delete"}
              </button>
              <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5">
                Cancel
              </button>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-3">Deleting a listing is permanent and cannot be undone.</p>
      </div>
    </div>
  );
}
