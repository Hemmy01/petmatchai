"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { useAuth, Role } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import AuthVideoPanel from "@/components/auth/AuthVideoPanel";
import LocationSelect from "@/components/ui/LocationSelect";

const roleConfig: { role: Role; label: string; emoji: string; desc: string; active: string }[] = [
  { role: "buyer", label: "Buyer", emoji: "🛒", desc: "Browse and adopt pets", active: "border-indigo-500 bg-indigo-50" },
  { role: "seller", label: "Seller", emoji: "🏪", desc: "List pets for sale", active: "border-purple-500 bg-purple-50" },
];

export default function SelectRolePage() {
  const router = useRouter();
  const { user, loading, refreshUser, logout } = useAuth();

  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role>("buyer");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");

  // Buyer quick preferences (step 3)
  const [prefSpecies, setPrefSpecies] = useState<string[]>([]);
  const [prefBudget, setPrefBudget] = useState("1000000");
  const [prefPurpose, setPrefPurpose] = useState("companionship");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Must be signed in to onboard. Already-onboarded users skip this page.
  useEffect(() => {
    if (loading) return;
    if (user) {
      if (user.onboarded) { router.replace("/dashboard"); return; }
      // Prefill the name Google gave us so the user can confirm/adjust it.
      if (user.name) setName((n) => n || user.name);
      return;
    }
    // No user in context yet. Right after the OAuth callback the session is still
    // propagating, so the context `user` is briefly null. Don't bounce to login on
    // that transient state — verify the real session (from storage) first, and only
    // redirect if there genuinely isn't one. The effect re-runs once `user` loads.
    let active = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active && !session) router.replace("/auth/login");
    });
    return () => { active = false; };
  }, [user, loading, router]);

  // Persists profile + (for buyers) preferences, marks onboarded, then continues.
  async function finish(savePrefs: boolean) {
    setSaving(true);
    setError("");
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) { router.replace("/auth/login"); return; }

    const profile: Record<string, string | boolean> = {
      role,
      name: name.trim(),
      phone,
      location,
      onboarded: true,
    };
    if (role === "seller") {
      if (businessName) profile.business_name = businessName;
      if (licenseNumber) profile.license_number = licenseNumber;
    }

    const { error: pErr } = await supabase.from("profiles").update(profile).eq("id", authUser.id);
    if (pErr) { setError(pErr.message); setSaving(false); return; }

    if (role === "buyer" && savePrefs && prefSpecies.length > 0) {
      await supabase.from("buyer_preferences").upsert({
        user_id: authUser.id,
        preferred_species: prefSpecies,
        budget_max: Number(prefBudget),
        purpose: prefPurpose,
        preferred_breeds: [],
        age_min: 0,
        age_max: 120,
        budget_min: 0,
        preferred_location: location,
        preferred_gender: "any",
      }, { onConflict: "user_id" });
    }

    await refreshUser();
    router.replace("/dashboard");
  }

  // Validate step 2 before advancing/finishing.
  function submitDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Please enter your name."); return; }
    setError("");
    if (role === "buyer") setStep(3);
    else finish(false);
  }

  // Avoid a flash of the form for users who shouldn't see this page.
  if (loading || !user || user.onboarded) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-gray-400">
        <Loader2 size={28} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  const totalSteps = role === "buyer" ? 3 : 2;

  return (
    <div className="w-screen relative left-1/2 -translate-x-1/2 -mt-4 -mb-24 md:-mb-6 min-h-[100dvh] grid lg:grid-cols-[minmax(360px,460px)_1fr] bg-white">
      <div className="flex flex-col justify-center overflow-y-auto px-6 py-10 sm:px-12 lg:px-20">
        <div className="mx-auto w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🐾</div>
            <h1 className="text-2xl font-bold text-gray-900">Complete your profile</h1>
            <p className="text-sm text-gray-500 mt-1">
              Welcome{name ? `, ${name.split(" ")[0]}` : ""}! Just a few details to finish setting up.
            </p>
          </div>

          <div className="flex items-center gap-2 mb-6">
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s) => (
              <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${step >= s ? "bg-indigo-600" : "bg-gray-200"}`} />
            ))}
          </div>

          {/* Step 1 — role */}
          {step === 1 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">I want to join as a...</p>
              <div className="space-y-3 mb-6">
                {roleConfig.map(({ role: r, label, emoji, desc, active }) => (
                  <button key={r} type="button" onClick={() => setRole(r)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${role === r ? active : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                    <span className="text-3xl">{emoji}</span>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{label}</p>
                      <p className="text-xs text-gray-500">{desc}</p>
                    </div>
                    {role === r && <div className="ml-auto w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center"><span className="text-white text-xs">✓</span></div>}
                  </button>
                ))}
              </div>
              <button onClick={() => setStep(2)}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700">
                Continue <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Step 2 — profile details */}
          {step === 2 && (
            <form onSubmit={submitDetails} className="space-y-4">
              <button type="button" onClick={() => { setError(""); setStep(1); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
                <ChevronLeft size={16} /> Back
              </button>

              <div>
                <label htmlFor="ob-name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input id="ob-name" required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Emmanuel Familoni" />
              </div>

              <div>
                <label htmlFor="ob-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input id="ob-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="+234 XXX XXX XXXX" />
              </div>

              <div>
                <label htmlFor="ob-location" className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <LocationSelect id="ob-location" value={location} onChange={setLocation} />
              </div>

              {role === "seller" && (
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3">
                  <p className="text-xs font-semibold text-purple-700">Business Information</p>
                  <div>
                    <label htmlFor="ob-business" className="block text-sm font-medium text-gray-700 mb-1">Business / Kennel Name</label>
                    <input id="ob-business" value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Hemmy Kennel" />
                  </div>
                  <div>
                    <label htmlFor="ob-license" className="block text-sm font-medium text-gray-700 mb-1">License / Registration Number</label>
                    <input id="ob-license" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="e.g. NVA-2024-XXXXX" />
                    <p className="text-xs text-gray-400 mt-0.5">Optional — helps with verification</p>
                  </div>
                </div>
              )}

              {error && <p role="alert" className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <button type="submit" disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {role === "buyer" ? <>Continue <ChevronRight size={16} /></> : (saving ? "Finishing..." : "Finish")}
              </button>
            </form>
          )}

          {/* Step 3 — buyer preferences */}
          {step === 3 && (
            <div className="space-y-5">
              <button type="button" onClick={() => { setError(""); setStep(2); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
                <ChevronLeft size={16} /> Back
              </button>
              <div className="text-center">
                <p className="text-sm font-semibold text-gray-700">Quick Preferences <span className="text-gray-400 font-normal">(optional)</span></p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">What type of pet are you looking for?</p>
                <div className="flex gap-3">
                  {["dog", "cat", "other"].map((s) => (
                    <button key={s} type="button"
                      onClick={() => setPrefSpecies((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])}
                      className={`flex-1 py-3 rounded-xl border-2 text-sm font-medium capitalize transition-all ${prefSpecies.includes(s) ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                      {s === "dog" ? "🐕" : s === "cat" ? "🐈" : "🐾"}<br />{s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Budget (₦)</label>
                <input type="number" value={prefBudget} onChange={(e) => setPrefBudget(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. 500000" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                <select value={prefPurpose} onChange={(e) => setPrefPurpose(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {["companionship", "breeding", "service", "show", "guard"].map((p) => (
                    <option key={p} value={p} className="capitalize">{p}</option>
                  ))}
                </select>
              </div>

              {error && <p role="alert" className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <button onClick={() => finish(true)} disabled={saving}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? "Finishing..." : "Finish"}
              </button>
              <button onClick={() => finish(false)} disabled={saving} className="w-full text-sm text-gray-400 hover:text-gray-600 py-1">
                Skip for now
              </button>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 mt-6">
            Not {user.name ? user.name.split(" ")[0] : "you"}?{" "}
            <button
              type="button"
              onClick={async () => { await logout(); router.replace("/auth/login"); }}
              className="text-indigo-600 font-medium hover:underline"
            >
              Sign out
            </button>
          </p>
        </div>
      </div>

      <AuthVideoPanel caption="Where loving homes meet loyal friends." />
    </div>
  );
}
