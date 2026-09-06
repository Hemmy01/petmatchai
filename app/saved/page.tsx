"use client";
import { useState, useEffect } from "react";
import { Heart, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import PetCard, { PetCardData } from "@/components/listings/PetCard";

export default function SavedPage() {
  const { user, loading: authLoading } = useAuth();
  const [pets, setPets] = useState<PetCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    api.get("/api/matches?saved=true").then((res) => {
      setPets(res.data ?? []);
      setLoading(false);
    });
  }, [user]);

  if (authLoading || loading) {
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
        <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in required</h2>
        <Link href="/auth/login" className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 text-sm">
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Heart size={22} className="text-red-500 fill-red-500" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saved Pets</h1>
          <p className="text-sm text-gray-500">{pets.length} pet{pets.length !== 1 ? "s" : ""} saved</p>
        </div>
      </div>

      {pets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <Heart size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 mb-2">No saved pets yet.</p>
          <Link href="/listings" className="text-indigo-600 text-sm hover:underline">
            Browse listings and tap the heart icon to save pets
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {pets.map((pet) => (
            <PetCard key={pet.id} pet={{ ...pet, initialSaved: true }} />
          ))}
        </div>
      )}
    </div>
  );
}
