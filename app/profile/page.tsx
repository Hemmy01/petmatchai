"use client";
import { useState, useEffect } from "react";
import { User, Loader2, Check, Lock, Camera, Bell, BellOff } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api-client";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRef } from "react";
import LocationSelect from "@/components/ui/LocationSelect";
import PhoneInput from "@/components/ui/PhoneInput";
import { isValidNigerianMobile, toNationalDigits } from "@/lib/nigeria";

const tabs = ["Profile", "Preferences", "Notifications", "Security", "My Reviews"] as const;
type Tab = typeof tabs[number];

const PURPOSES = ["companionship", "breeding", "service", "show", "guard"] as const;
const HEALTH_OPTIONS = ["vaccinated", "dewormed", "microchipped"] as const;
const SPECIES_OPTIONS = ["dog", "cat", "other"] as const;

const inp = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Profile");

  // Profile state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");

  // Preferences state
  const [prefSpecies, setPrefSpecies] = useState<string[]>([]);
  const [prefBreeds, setPrefBreeds] = useState("");
  const [ageMin, setAgeMin] = useState("0");
  const [ageMax, setAgeMax] = useState("120");
  const [budgetMin, setBudgetMin] = useState("0");
  const [budgetMax, setBudgetMax] = useState("1000000");
  const [prefLocation, setPrefLocation] = useState("");
  const [prefGender, setPrefGender] = useState("any");
  const [purpose, setPurpose] = useState("companionship");
  const [healthReqs, setHealthReqs] = useState<string[]>([]);
  const [prefLoading, setPrefLoading] = useState(true);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefMsg, setPrefMsg] = useState("");

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url ?? "");
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Push notification state
  const [pushStatus, setPushStatus] = useState<NotificationPermission | "unsupported">("default");
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMsg, setPushMsg] = useState("");

  useEffect(() => {
    if (typeof Notification === "undefined") {
      setPushStatus("unsupported");
    } else {
      setPushStatus(Notification.permission);
    }
  }, []);

  async function enablePush() {
    setPushLoading(true);
    setPushMsg("");
    try {
      const permission = await Notification.requestPermission();
      setPushStatus(permission);
      if (permission !== "granted") { setPushMsg("Permission denied."); setPushLoading(false); return; }

      const reg = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: vapidKey,
      });
      const { supabase: sb } = await import("@/lib/supabase");
      const { data: { session } } = await sb.auth.getSession();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token ?? ""}` },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      setPushMsg(res.ok ? "Push notifications enabled!" : "Failed to save subscription.");
    } catch (e: any) {
      setPushMsg(e?.message ?? "Failed to enable push notifications.");
    }
    setPushLoading(false);
    setTimeout(() => setPushMsg(""), 4000);
  }

  async function disablePush() {
    setPushLoading(true);
    const { supabase: sb } = await import("@/lib/supabase");
    const { data: { session } } = await sb.auth.getSession();
    await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
    });
    setPushMsg("Push notifications disabled.");
    setPushLoading(false);
    setTimeout(() => setPushMsg(""), 3000);
  }

  // Notification prefs state
  const [notifPrefs, setNotifPrefs] = useState({
    new_matches: true, messages: true, price_changes: true, new_listings: true,
    channel_inapp: true, channel_email: true, channel_sms: false,
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState("");

  // Security state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [secMsg, setSecMsg] = useState("");
  const [secSaving, setSecSaving] = useState(false);

  // My Reviews state
  const [myReviews, setMyReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setPhone(user.phone ?? "");
      setLocation(user.location ?? "");
      setAvatarUrl(user.avatar_url ?? "");
    }
  }, [user]);

  useEffect(() => {
    if (!user || tab !== "My Reviews") return;
    setReviewsLoading(true);
    api.get(`/api/reviews?reviewerId=${user.id}`).then((res) => {
      setMyReviews(res.data ?? []);
      setReviewsLoading(false);
    });
  }, [user, tab]);

  useEffect(() => {
    if (!user) return;
    api.get("/api/users").then((res) => {
      const prefs = res.data?.notification_prefs;
      if (prefs) setNotifPrefs((prev) => ({ ...prev, ...prefs }));
      if (res.data?.business_name) setBusinessName(res.data.business_name);
      if (res.data?.license_number) setLicenseNumber(res.data.license_number);
    });
  }, [user]);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const form = new FormData();
    form.append("file", file);
    form.append("bucket", "pet-images");
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: form,
    });
    setAvatarUploading(false);
    if (!res.ok) return;
    const json = await res.json();
    const url = json.url as string;
    setAvatarUrl(url);
    await api.patch("/api/users", { avatar_url: url });
  }

  useEffect(() => {
    if (!user) return;
    api.get("/api/preferences").then((res) => {
      if (res.data) {
        const p = res.data;
        setPrefSpecies(p.preferred_species ?? []);
        setPrefBreeds((p.preferred_breeds ?? []).join(", "));
        setAgeMin(String(p.age_min ?? 0));
        setAgeMax(String(p.age_max ?? 120));
        setBudgetMin(String(p.budget_min ?? 0));
        setBudgetMax(String(p.budget_max ?? 1000000));
        setPrefLocation(p.preferred_location ?? "");
        setPrefGender(p.preferred_gender ?? "any");
        setPurpose(p.purpose ?? "companionship");
        setHealthReqs(p.health_requirements ?? []);
      }
      setPrefLoading(false);
    });
  }, [user]);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 size={28} className="animate-spin text-indigo-600" /></div>;
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="text-4xl mb-3">🔒</div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in required</h2>
        <Link href="/auth/login" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 text-sm">
          Sign In
        </Link>
      </div>
    );
  }

  async function saveProfile() {
    if (phone && !isValidNigerianMobile(toNationalDigits(phone))) {
      setProfileMsg("Error: Enter a valid Nigerian phone number (e.g. 0803 123 4567).");
      return;
    }
    setProfileSaving(true);
    setProfileMsg("");
    const payload: Record<string, string> = { name, phone, location };
    if (user?.role === "seller") {
      payload.business_name = businessName;
      payload.license_number = licenseNumber;
    }
    const res = await api.patch("/api/users", payload);
    setProfileSaving(false);
    setProfileMsg(res.error ? `Error: ${res.error}` : "Profile updated.");
    setTimeout(() => setProfileMsg(""), 3000);
  }

  function toggleSpecies(s: string) {
    setPrefSpecies((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  }
  function toggleHealth(h: string) {
    setHealthReqs((prev) => prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]);
  }

  async function savePreferences() {
    setPrefSaving(true);
    setPrefMsg("");
    const breeds = prefBreeds.split(",").map((b) => b.trim()).filter(Boolean);
    const res = await api.post("/api/preferences", {
      preferred_species: prefSpecies,
      preferred_breeds: breeds,
      age_min: Number(ageMin),
      age_max: Number(ageMax),
      budget_min: Number(budgetMin),
      budget_max: Number(budgetMax),
      preferred_location: prefLocation,
      preferred_gender: prefGender,
      purpose,
      health_requirements: healthReqs,
    });
    setPrefSaving(false);
    setPrefMsg(res.error ? `Error: ${res.error}` : "Preferences saved — AI matching will use these next time.");
    setTimeout(() => setPrefMsg(""), 4000);
  }

  async function changePassword() {
    if (!newPassword || newPassword !== confirmPassword) {
      setSecMsg("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setSecMsg("Password must be at least 8 characters.");
      return;
    }
    setSecSaving(true);
    setSecMsg("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSecSaving(false);
    if (error) {
      setSecMsg(`Error: ${error.message}`);
    } else {
      setNewPassword("");
      setConfirmPassword("");
      setSecMsg("Password updated successfully.");
    }
    setTimeout(() => setSecMsg(""), 4000);
  }

  const initials = name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">My Profile</h1>

      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6">

        {/* ── PROFILE ── */}
        {tab === "Profile" && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative shrink-0">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-xl font-bold text-indigo-700 overflow-hidden">
                  {avatarUrl
                    ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    : initials}
                </div>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute -bottom-1 -right-1 bg-indigo-600 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 shadow">
                  {avatarUploading ? <Loader2 size={11} className="animate-spin" /> : <Camera size={11} />}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{name || "—"}</p>
                <p className="text-sm text-gray-500 capitalize">{user.role} · {user.email}</p>
                <p className="text-xs text-gray-400 mt-0.5">Click the camera icon to change photo</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input value={user.email} readOnly className={`${inp} bg-gray-50 text-gray-400 cursor-not-allowed`} />
              <p className="text-xs text-gray-400 mt-0.5">Email cannot be changed here</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <PhoneInput value={phone} onChange={setPhone} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <LocationSelect value={location} onChange={setLocation} />
            </div>

            {user.role === "seller" && (
              <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3">
                <p className="text-xs font-semibold text-purple-700">Business Information</p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business / Kennel Name</label>
                  <input value={businessName} onChange={(e) => setBusinessName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g. Hemmy Kennel" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">License / Registration Number</label>
                  <input value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g. NVA-2024-XXXXX" />
                  <p className="text-xs text-gray-400 mt-0.5">Shown on your listings once admin-verified</p>
                </div>
              </div>
            )}

            {profileMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg ${profileMsg.startsWith("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                {profileMsg}
              </p>
            )}
            <button onClick={saveProfile} disabled={profileSaving}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60">
              {profileSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {profileSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}

        {/* ── PREFERENCES ── */}
        {tab === "Preferences" && (
          prefLoading ? (
            <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-indigo-600" /></div>
          ) : (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-gray-500 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 mb-4">
                  These preferences power the matching engine — it uses them to score every pet and rank the best matches for you.
                </p>

                <h3 className="font-semibold text-gray-900 mb-3">Preferred Species</h3>
                <div className="flex gap-3">
                  {SPECIES_OPTIONS.map((s) => (
                    <button key={s} onClick={() => toggleSpecies(s)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border capitalize transition-colors ${prefSpecies.includes(s) ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 text-gray-600 hover:border-indigo-400"}`}>
                      {s === "dog" ? "🐕 Dog" : s === "cat" ? "🐈 Cat" : "🐾 Other"}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Breeds</label>
                <input value={prefBreeds} onChange={(e) => setPrefBreeds(e.target.value)}
                  className={inp} placeholder="Golden Retriever, Poodle, Labrador (comma-separated)" />
                <p className="text-xs text-gray-400 mt-0.5">Leave blank to match any breed</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Age (months)</label>
                  <input type="number" min={0} value={ageMin} onChange={(e) => setAgeMin(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Age (months)</label>
                  <input type="number" min={0} value={ageMax} onChange={(e) => setAgeMax(e.target.value)} className={inp} />
                  <p className="text-xs text-gray-400 mt-0.5">e.g. 24 = 2 years old</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Min Budget (₦)</label>
                  <input type="number" min={0} value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Budget (₦)</label>
                  <input type="number" min={0} value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} className={inp} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Location</label>
                  <LocationSelect id="pref-location" value={prefLocation} onChange={setPrefLocation} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Gender</label>
                  <select value={prefGender} onChange={(e) => setPrefGender(e.target.value)} className={inp}>
                    <option value="any">Any</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className={inp}>
                  {PURPOSES.map((p) => (
                    <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Health Requirements</label>
                <div className="flex gap-4">
                  {HEALTH_OPTIONS.map((h) => (
                    <label key={h} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer capitalize select-none">
                      <input type="checkbox" checked={healthReqs.includes(h)} onChange={() => toggleHealth(h)}
                        className="accent-indigo-600 w-4 h-4" />
                      {h}
                    </label>
                  ))}
                </div>
              </div>

              {prefMsg && (
                <p className={`text-sm px-3 py-2 rounded-lg ${prefMsg.startsWith("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                  {prefMsg}
                </p>
              )}
              <button onClick={savePreferences} disabled={prefSaving}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60">
                {prefSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {prefSaving ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          )
        )}

        {/* ── NOTIFICATIONS ── */}
        {tab === "Notifications" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 mb-2">Notification Preferences</h3>
            {[
              { key: "new_matches", label: "New matches", desc: "Get notified when AI finds a new match" },
              { key: "messages", label: "Messages", desc: "Alerts for new messages from sellers" },
              { key: "price_changes", label: "Price changes", desc: "Notify when saved listings change price" },
              { key: "new_listings", label: "New listings", desc: "Alerts for new pets matching your preferences" },
            ].map((n) => (
              <div key={n.key} className="flex items-center justify-between py-2 border-b border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">{n.label}</p>
                  <p className="text-xs text-gray-500">{n.desc}</p>
                </div>
                <input type="checkbox"
                  checked={notifPrefs[n.key as keyof typeof notifPrefs] as boolean}
                  onChange={(e) => setNotifPrefs((prev) => ({ ...prev, [n.key]: e.target.checked }))}
                  className="accent-indigo-600 w-4 h-4" />
              </div>
            ))}
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Channels</p>
              <div className="flex gap-4">
                {[
                  { key: "channel_inapp", label: "In-App" },
                  { key: "channel_email", label: "Email" },
                  { key: "channel_sms", label: "SMS" },
                ].map((c) => (
                  <label key={c.key} className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input type="checkbox"
                      checked={notifPrefs[c.key as keyof typeof notifPrefs] as boolean}
                      onChange={(e) => setNotifPrefs((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                      className="accent-indigo-600" />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            {/* Browser Push Notifications */}
            <div className="border border-gray-200 rounded-xl p-4 mt-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">Browser Push Notifications</p>
                  <p className="text-xs text-gray-500">Receive alerts even when the app is closed</p>
                </div>
                {pushStatus === "granted" ? (
                  <button onClick={disablePush} disabled={pushLoading}
                    className="flex items-center gap-1.5 text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50">
                    {pushLoading ? <Loader2 size={12} className="animate-spin" /> : <BellOff size={12} />}
                    Disable
                  </button>
                ) : pushStatus === "denied" ? (
                  <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">Blocked in browser</span>
                ) : pushStatus === "unsupported" ? (
                  <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg">Not supported</span>
                ) : (
                  <button onClick={enablePush} disabled={pushLoading}
                    className="flex items-center gap-1.5 text-xs text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 disabled:opacity-50">
                    {pushLoading ? <Loader2 size={12} className="animate-spin" /> : <Bell size={12} />}
                    Enable
                  </button>
                )}
              </div>
              {pushMsg && (
                <p className={`text-xs px-2 py-1 rounded ${pushMsg.includes("!") ? "text-green-700 bg-green-50" : "text-red-600 bg-red-50"}`}>
                  {pushMsg}
                </p>
              )}
            </div>

            {notifMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg ${notifMsg.startsWith("Error") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                {notifMsg}
              </p>
            )}
            <button
              onClick={async () => {
                setNotifSaving(true);
                setNotifMsg("");
                const res = await api.patch("/api/users", { notification_prefs: notifPrefs });
                setNotifSaving(false);
                setNotifMsg(res.error ? `Error: ${res.error}` : "Notification preferences saved.");
                setTimeout(() => setNotifMsg(""), 3000);
              }}
              disabled={notifSaving}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60">
              {notifSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {notifSaving ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        )}

        {/* ── SECURITY ── */}
        {tab === "Security" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg text-sm text-green-700 mb-4">
              <Lock size={16} /> Your password is encrypted and your account is protected with industry-standard security.
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                className={inp} placeholder="At least 8 characters" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className={inp} placeholder="Repeat the password" />
            </div>

            {secMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg ${secMsg.startsWith("Error") || secMsg.startsWith("Password") ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                {secMsg}
              </p>
            )}

            <button onClick={changePassword} disabled={secSaving}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60">
              {secSaving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              {secSaving ? "Updating..." : "Update Password"}
            </button>

            <div className="flex items-center justify-between py-3 border-t border-gray-100 mt-2">
              <div>
                <p className="text-sm font-medium text-gray-900">Two-Factor Authentication</p>
                <p className="text-xs text-gray-500">Coming in a future update</p>
              </div>
              <button disabled className="text-sm text-gray-400 border border-gray-200 px-3 py-1.5 rounded-lg cursor-not-allowed">
                Enable 2FA
              </button>
            </div>
          </div>
        )}

        {/* ── MY REVIEWS ── */}
        {tab === "My Reviews" && (
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Reviews I've Written</h3>
            {reviewsLoading ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-indigo-400" /></div>
            ) : myReviews.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-3">⭐</div>
                <p className="text-sm">You haven't written any reviews yet.</p>
                <p className="text-xs text-gray-400 mt-1">After a completed purchase, review the seller from the Offers page.</p>
              </div>
            ) : (
              myReviews.map((r: any) => (
                <div key={r.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        For: {r.seller?.name ?? "Seller"}
                      </p>
                      <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className={`text-${i < r.rating ? "yellow-400" : "gray-300"} text-sm`}>★</span>
                      ))}
                    </div>
                  </div>
                  {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
                  {r.is_verified && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full mt-2">
                      ✓ Verified purchase
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
