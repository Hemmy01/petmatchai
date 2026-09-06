"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import { useAuth, Role } from "@/lib/auth-context";
import AuthVideoPanel from "@/components/auth/AuthVideoPanel";
import LocationSelect from "@/components/ui/LocationSelect";
import PhoneInput from "@/components/ui/PhoneInput";
import { isValidNigerianMobile, toNationalDigits } from "@/lib/nigeria";

const roleConfig: { role: Role; label: string; emoji: string; desc: string; active: string }[] = [
  { role: "buyer", label: "Buyer", emoji: "🛒", desc: "Browse and adopt pets", active: "border-indigo-500 bg-indigo-50" },
  { role: "seller", label: "Seller", emoji: "🏪", desc: "List pets for sale", active: "border-purple-500 bg-purple-50" },
];

const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"];
const strengthColor = ["", "bg-red-400", "bg-yellow-400", "bg-blue-400", "bg-green-500"];

function checkStrength(val: string) {
  let s = 0;
  if (val.length >= 8) s++;
  if (/[A-Z]/.test(val)) s++;
  if (/[0-9]/.test(val)) s++;
  if (/[^A-Za-z0-9]/.test(val)) s++;
  return s;
}

export default function RegisterPage() {
  const router = useRouter();
  const { register, loginWithGoogle } = useAuth();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<Role>("buyer");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [strength, setStrength] = useState(0);
  const [showPw, setShowPw] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Buyer quick preferences (step 3)
  const [prefSpecies, setPrefSpecies] = useState<string[]>([]);
  const [prefBudget, setPrefBudget] = useState("1000000");
  const [prefPurpose, setPrefPurpose] = useState("companionship");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidNigerianMobile(toNationalDigits(phone))) {
      setError("Please enter a valid Nigerian phone number (e.g. 0803 123 4567).");
      return;
    }
    if (!location) { setError("Please select your location."); return; }
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError("");
    setLoading(true);

    const fullName = `${firstName} ${lastName}`.trim();
    const { error: err } = await register(email, password, fullName, role);
    setLoading(false);

    if (err) { setError(err); return; }

    // Save extra profile data
    try {
      const { supabase } = await import("@/lib/supabase");
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const extra: Record<string, string> = { phone, location };
        if (role === "seller") {
          if (businessName) extra.business_name = businessName;
          if (licenseNumber) extra.license_number = licenseNumber;
        }
        await supabase.from("profiles").update(extra).eq("id", user.id);
      }
    } catch { /* non-critical */ }

    // Buyers proceed to preferences step before confirming email
    if (role === "buyer") {
      setStep(3);
      return;
    }

    sessionStorage.setItem("pending_email", email);
    router.push(`/auth/confirm-email?email=${encodeURIComponent(email)}`);
  }

  async function handleSavePrefs() {
    setLoading(true);
    try {
      const { supabase: sb } = await import("@/lib/supabase");
      const { data: { user } } = await sb.auth.getUser();
      if (user && prefSpecies.length > 0) {
        await sb.from("buyer_preferences").upsert({
          user_id: user.id,
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
    } catch { /* non-critical */ }
    setLoading(false);
    sessionStorage.setItem("pending_email", email);
    router.push(`/auth/confirm-email?email=${encodeURIComponent(email)}`);
  }

  return (
    <div className="w-screen relative left-1/2 -translate-x-1/2 -mt-4 -mb-24 md:-mb-6 min-h-[100dvh] grid lg:grid-cols-[minmax(360px,460px)_1fr] bg-white">
        <div className="flex flex-col justify-center overflow-y-auto px-6 py-10 sm:px-12 lg:px-20">
          <div className="mx-auto w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🐾</div>
            <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
            <p className="text-sm text-gray-500 mt-1">Join PetMatchAI today</p>
          </div>

          <div className="flex items-center gap-2 mb-6">
            {(role === "buyer" ? [1, 2, 3] : [1, 2]).map((s) => (
              <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${step >= s ? "bg-indigo-600" : "bg-gray-200"}`} />
            ))}
          </div>

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

          {step === 2 && (
            <>
            <form onSubmit={handleSubmit} className="space-y-4" aria-label="Create account form">
              <button type="button" onClick={() => setStep(1)} aria-label="Go back to role selection" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
                <ChevronLeft size={16} aria-hidden="true" /> Back
              </button>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="reg-firstname" className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input id="reg-firstname" required value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Emmanuel" />
                </div>
                <div>
                  <label htmlFor="reg-lastname" className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input id="reg-lastname" required value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Familoni" />
                </div>
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input id="reg-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="you@example.com" />
              </div>

              <div>
                <label htmlFor="reg-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <PhoneInput id="reg-phone" value={phone} onChange={setPhone} required />
              </div>

              <div>
                <label htmlFor="reg-location" className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <LocationSelect id="reg-location" value={location} onChange={setLocation} required />
              </div>

              {role === "seller" && (
                <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3">
                  <p className="text-xs font-semibold text-purple-700">Business Information</p>
                  <div>
                    <label htmlFor="reg-business" className="block text-sm font-medium text-gray-700 mb-1">Business / Kennel Name</label>
                    <input id="reg-business" value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Hemmy Kennel" />
                  </div>
                  <div>
                    <label htmlFor="reg-license" className="block text-sm font-medium text-gray-700 mb-1">License / Registration Number</label>
                    <input id="reg-license" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="e.g. NVA-2024-XXXXX" />
                    <p className="text-xs text-gray-400 mt-0.5">Optional — helps with verification</p>
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input id="reg-password" type={showPw ? "text" : "password"} required value={password} autoComplete="new-password"
                    onChange={(e) => { setPassword(e.target.value); setStrength(checkStrength(e.target.value)); }}
                    aria-describedby="reg-password-strength"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                    placeholder="••••••••" />
                  <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? "Hide password" : "Show password"} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                  </button>
                </div>
                {strength > 0 && (
                  <div id="reg-password-strength" className="mt-2" aria-live="polite">
                    <div className="flex gap-1 mb-1" aria-hidden="true">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor[strength] : "bg-gray-200"}`} />
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">Strength: <span className="font-medium">{strengthLabel[strength]}</span></p>
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="reg-confirm-password" className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <input id="reg-confirm-password" type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="••••••••" />
              </div>

              {error && <p id="reg-error" role="alert" className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <label className="flex items-start gap-2 text-xs text-gray-500 cursor-pointer">
                <input type="checkbox" required className="accent-indigo-600 mt-0.5" />
                I agree to the <Link href="#" className="text-indigo-600 hover:underline">Terms of Service</Link> and <Link href="#" className="text-indigo-600 hover:underline">Privacy Policy</Link>
              </label>

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60">
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? "Creating account..." : "Create Account"}
              </button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center text-xs text-gray-400 bg-white px-3">or register with</div>
            </div>

            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                const { error: err } = await loginWithGoogle();
                if (err) { setError(err); setLoading(false); }
              }}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-50 disabled:opacity-60 transition-colors">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>
            </>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="text-center mb-2">
                <p className="text-sm font-semibold text-gray-700">Quick Preferences <span className="text-gray-400 font-normal">(optional — you can update these later)</span></p>
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
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 500000" />
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
              <button onClick={handleSavePrefs} disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60">
                {loading && <Loader2 size={16} className="animate-spin" />}
                {loading ? "Saving..." : "Save & Continue →"}
              </button>
              <button onClick={() => { sessionStorage.setItem("pending_email", email); router.push(`/auth/confirm-email?email=${encodeURIComponent(email)}`); }}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-1">
                Skip for now
              </button>
            </div>
          )}

          <p className="text-center text-sm text-gray-500 mt-5">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-indigo-600 font-medium hover:underline">Sign in</Link>
          </p>
          </div>
        </div>

        <AuthVideoPanel caption="Thousands of loyal companions await." />
      </div>
  );
}
