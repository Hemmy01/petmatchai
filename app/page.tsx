import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import PetCard from "@/components/listings/PetCard";

async function getFeaturedPets() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase
    .from("pets")
    .select("*, seller:profiles!pets_seller_id_fkey(id, name, location, is_verified)")
    .eq("status", "active")
    .eq("featured", true)
    .order("created_at", { ascending: false })
    .limit(6);

  if (!data || data.length === 0) {
    const { data: newest } = await supabase
      .from("pets")
      .select("*, seller:profiles!pets_seller_id_fkey(id, name, location, is_verified)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(6);
    return newest ?? [];
  }
  return data;
}

async function getPlatformStats() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [{ count: pets }, { count: users }] = await Promise.all([
    supabase.from("pets").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("profiles").select("*", { count: "exact", head: true }),
  ]);
  return { pets: pets ?? 0, users: users ?? 0 };
}

export default async function Home() {
  const [featured, stats] = await Promise.all([getFeaturedPets(), getPlatformStats()]);

  return (
    <div>
      {/* Hero */}
      <section className="text-center py-16 px-4">
        <div className="text-6xl mb-4">🐾</div>
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Find Your Perfect Pet Match</h1>
        <p className="text-lg text-gray-500 mb-8 max-w-xl mx-auto">
          AI-powered matchmaking connecting pet buyers and sellers based on your preferences and live market data.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/listings" className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-indigo-700">
            Browse Pets
          </Link>
          <Link href="/auth/register" className="border border-indigo-600 text-indigo-600 px-6 py-3 rounded-xl font-semibold hover:bg-indigo-50">
            Get Started
          </Link>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        {[
          { label: "Active Listings", value: stats.pets > 0 ? `${stats.pets}` : "—" },
          { label: "Registered Users", value: stats.users > 0 ? `${stats.users}` : "—" },
          { label: "AI Matches Made", value: "Live" },
          { label: "Powered by", value: "Smart Engine ⚡" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">{s.value}</p>
            <p className="text-sm text-gray-500">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Featured Pets */}
      <section className="mb-14">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Featured Pets</h2>
            <p className="text-sm text-gray-500 mt-0.5">Hand-picked listings ready for adoption</p>
          </div>
          <Link
            href="/listings"
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            View all →
          </Link>
        </div>

        {featured.length === 0 ? (
          <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200">
            <div className="text-5xl mb-3">🐾</div>
            <p className="font-medium text-gray-500 mb-1">No listings yet</p>
            <Link href="/auth/register" className="text-indigo-600 text-sm hover:underline">
              Be the first seller →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((pet) => (
              <PetCard key={pet.id} pet={pet} />
            ))}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="bg-white rounded-2xl border border-gray-200 p-8 mb-12">
        <h2 className="text-xl font-bold text-gray-900 text-center mb-8">How PetMatchAI Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          {[
            { icon: "📝", title: "Create Profile", desc: "Register and set your pet preferences or list your pets for sale." },
            { icon: "🤖", title: "Smart Matching", desc: "Our matching engine analyzes your preferences and live market data to find the best compatible pets instantly." },
            { icon: "🤝", title: "Connect & Adopt", desc: "Message sellers, make offers, and find your perfect companion." },
          ].map((step) => (
            <div key={step.title}>
              <div className="text-4xl mb-3">{step.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-1">{step.title}</h3>
              <p className="text-sm text-gray-500">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
