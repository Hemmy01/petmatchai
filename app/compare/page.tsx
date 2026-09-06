"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft, Scale, CheckCircle, X, Loader2 } from "lucide-react";
import { useCompare } from "@/lib/compare-context";
import VerifiedBadge from "@/components/ui/VerifiedBadge";

type Pet = {
  id: string; name: string; species: string; breed: string; age_months: number;
  gender: string; color: string | null; price: number; location: string;
  description: string | null; vaccinated: boolean; dewormed: boolean;
  microchipped: boolean; registration_info: string | null; image_url: string | null;
  views: number; status: string;
  seller: { name: string; is_verified: boolean } | null;
};

function ageLabel(months: number) {
  if (months < 12) return `${months} month${months !== 1 ? "s" : ""}`;
  const y = Math.floor(months / 12), m = months % 12;
  return m > 0 ? `${y}y ${m}m` : `${y} yr${y !== 1 ? "s" : ""}`;
}

function BoolCell({ val }: { val: boolean }) {
  return val
    ? <span className="flex items-center gap-1 text-green-600 text-sm"><CheckCircle size={13} /> Yes</span>
    : <span className="text-gray-300 text-sm">—</span>;
}

const ROWS: { label: string; render: (p: Pet) => React.ReactNode }[] = [
  { label: "Species",       render: (p) => <span className="capitalize text-sm">{p.species}</span> },
  { label: "Breed",         render: (p) => <span className="text-sm">{p.breed}</span> },
  { label: "Age",           render: (p) => <span className="text-sm">{ageLabel(p.age_months)}</span> },
  { label: "Gender",        render: (p) => <span className="capitalize text-sm">{p.gender}</span> },
  { label: "Price",         render: (p) => <span className="font-bold text-indigo-600 text-sm">₦{p.price.toLocaleString()}</span> },
  { label: "Location",      render: (p) => <span className="text-sm">{p.location}</span> },
  { label: "Color",         render: (p) => <span className="text-sm capitalize">{p.color ?? "—"}</span> },
  { label: "Vaccinated",    render: (p) => <BoolCell val={p.vaccinated} /> },
  { label: "Dewormed",      render: (p) => <BoolCell val={p.dewormed} /> },
  { label: "Microchipped",  render: (p) => <BoolCell val={p.microchipped} /> },
  { label: "Registration",  render: (p) => <span className="text-sm">{p.registration_info ?? "—"}</span> },
  { label: "Seller",        render: (p) => (
    <span className="flex items-center gap-1 text-sm">
      {p.seller?.name ?? "—"}
      {p.seller?.is_verified && <VerifiedBadge size={13} />}
    </span>
  )},
  { label: "Views",         render: (p) => <span className="text-sm">{p.views}</span> },
  { label: "Status",        render: (p) => <span className="capitalize text-sm">{p.status}</span> },
];

function CompareContent() {
  const params = useSearchParams();
  const router = useRouter();
  const { remove } = useCompare();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ids = (params.get("ids") ?? "").split(",").filter(Boolean).slice(0, 3);
    if (ids.length === 0) { setLoading(false); return; }

    supabase
      .from("pets")
      .select("*, seller:profiles!pets_seller_id_fkey(name, is_verified)")
      .in("id", ids)
      .then(({ data }) => {
        const map = new Map((data ?? []).map((p: Pet) => [p.id, p]));
        setPets(ids.map((id) => map.get(id)).filter(Boolean) as Pet[]);
        setLoading(false);
      });
  }, [params]);

  function handleRemove(id: string) {
    remove(id);
    const remaining = pets.filter((p) => p.id !== id);
    if (remaining.length < 2) {
      router.push("/listings");
      return;
    }
    router.replace(`/compare?ids=${remaining.map((p) => p.id).join(",")}`);
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  if (pets.length < 2) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <Scale size={48} className="mx-auto text-indigo-300 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Select pets to compare</h2>
        <p className="text-sm text-gray-500 mb-6">
          Use the compare button on any pet card, then click "Compare" in the tray at the bottom.
        </p>
        <Link href="/listings"
          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 text-sm">
          Browse Listings
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/listings" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
          <ArrowLeft size={14} /> Back to listings
        </Link>
        <div className="flex items-center gap-2 ml-2">
          <Scale size={18} className="text-indigo-600" />
          <h1 className="text-xl font-bold text-gray-900">Compare Pets</h1>
          <span className="text-sm text-gray-400">({pets.length} selected)</span>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 px-4">
        <table className="w-full border-separate border-spacing-0" style={{ minWidth: `${pets.length * 220 + 120}px` }}>
          {/* Pet header cards */}
          <thead>
            <tr>
              <th className="w-28" />
              {pets.map((pet) => (
                <th key={pet.id} className="pb-4 px-2 align-top">
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden text-left">
                    <div className="h-40 bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-6xl overflow-hidden relative">
                      {pet.image_url
                        ? <img src={pet.image_url} alt={pet.name} className="w-full h-full object-cover" />
                        : (pet.species === "cat" ? "🐱" : "🐶")
                      }
                      <button
                        onClick={() => handleRemove(pet.id)}
                        aria-label={`Remove ${pet.name}`}
                        className="absolute top-2 right-2 bg-white rounded-full p-1 shadow text-gray-500 hover:text-red-500">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="p-3">
                      <p className="font-bold text-gray-900">{pet.name}</p>
                      <p className="text-xs text-gray-500 mb-2">{pet.breed}</p>
                      <Link href={`/listings/${pet.id}`}
                        className="block text-center text-xs bg-indigo-600 text-white py-1.5 rounded-lg hover:bg-indigo-700">
                        View Listing
                      </Link>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Attribute rows */}
          <tbody>
            {ROWS.map((row, i) => (
              <tr key={row.label} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                <td className="py-3 px-3 text-xs font-medium text-gray-500 align-middle whitespace-nowrap rounded-l-lg">
                  {row.label}
                </td>
                {pets.map((pet) => (
                  <td key={pet.id} className="py-3 px-5 align-middle last:rounded-r-lg">
                    {row.render(pet)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Description comparison */}
      {pets.some((p) => p.description) && (
        <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: `repeat(${pets.length}, 1fr)` }}>
          {pets.map((pet) => (
            <div key={pet.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500 mb-1">{pet.name} — Description</p>
              <p className="text-sm text-gray-700 leading-relaxed">{pet.description ?? "No description provided."}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center py-20">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
      </div>
    }>
      <CompareContent />
    </Suspense>
  );
}
