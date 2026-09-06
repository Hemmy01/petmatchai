"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Heart, CheckCircle, Scale } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api-client";
import { useCompare } from "@/lib/compare-context";
import VerifiedBadge from "@/components/ui/VerifiedBadge";
import type { PetCardData } from "@/types/pet";

export type { PetCardData };

export default function PetCard({ pet }: { pet: PetCardData }) {
  const { user } = useAuth();
  const { add, remove, has } = useCompare();
  const [saved, setSaved] = useState(pet.initialSaved ?? false);
  const [saving, setSaving] = useState(false);
  const inCompare = has(pet.id);

  const species = pet.species ?? pet.type ?? "dog";
  const ageDisplay =
    pet.age_months != null
      ? pet.age_months < 12
        ? `${pet.age_months}mo`
        : `${Math.round(pet.age_months / 12)}yr`
      : pet.age != null
      ? `${pet.age}yr`
      : "";
  const sellerName = pet.seller?.name ?? pet.sellerName ?? "";

  async function handleSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user || saving) return;
    setSaving(true);
    await api.post("/api/matches", { petId: pet.id, action: saved ? "unsave" : "save" });
    setSaved(!saved);
    setSaving(false);
  }

  function handleCompare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    inCompare
      ? remove(pet.id)
      : add({
          id: pet.id,
          name: pet.name,
          breed: pet.breed,
          price: pet.price,
          species: pet.species ?? pet.type,
          image_url: pet.image_url,
        });
  }

  return (
    <Link
      href={`/listings/${pet.id}`}
      className="group block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-200 overflow-hidden"
    >
      {/* ── Image ────────────────────────────────── */}
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-50">
        {pet.image_url ? (
          <Image
            src={pet.image_url}
            alt={pet.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-100 text-5xl">
            {species === "cat" || species === "Cat" ? "🐱" : "🐶"}
          </div>
        )}

        {/* Top-left: status badge */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          {pet.status && pet.status !== "active" && (
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full leading-none capitalize ${
                pet.status === "sold"
                  ? "bg-red-500 text-white"
                  : "bg-yellow-400 text-gray-900"
              }`}
            >
              {pet.status}
            </span>
          )}
        </div>

        {/* Top-right: match score */}
        {pet.matchScore != null && pet.matchScore > 0 && (
          <span className="absolute top-2.5 right-2.5 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            {pet.matchScore}% match
          </span>
        )}

        {/* Bottom-right: save heart */}
        <button
          onClick={handleSave}
          aria-label={
            user
              ? saved
                ? `Remove ${pet.name} from saved`
                : `Save ${pet.name}`
              : "Sign in to save pets"
          }
          aria-pressed={saved}
          className={`absolute bottom-2.5 right-2.5 p-1.5 rounded-full shadow-md transition-all ${
            saved
              ? "bg-white text-red-500"
              : "bg-white/80 backdrop-blur-sm text-gray-400 hover:text-red-500"
          } ${!user ? "opacity-50 cursor-default" : ""}`}
        >
          <Heart size={15} className={saved ? "fill-red-500" : ""} />
        </button>
      </div>

      {/* ── Content ──────────────────────────────── */}
      <div className="p-4">
        {/* Name + compare */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-bold text-gray-900 text-[15px] leading-snug truncate">
            {pet.name}
          </h3>
          <button
            onClick={handleCompare}
            title={inCompare ? "Remove from compare" : "Add to compare"}
            aria-label={
              inCompare
                ? `Remove ${pet.name} from compare`
                : `Add ${pet.name} to compare`
            }
            aria-pressed={inCompare}
            className={`shrink-0 p-1 rounded-md transition-colors ${
              inCompare
                ? "text-indigo-600 bg-indigo-50"
                : "text-gray-300 hover:text-indigo-500 hover:bg-indigo-50"
            }`}
          >
            <Scale size={14} />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-1 truncate">
          {pet.breed}
          {ageDisplay ? ` · ${ageDisplay}` : ""}
          {" · "}
          <span className="capitalize">{pet.gender}</span>
        </p>

        {sellerName && (
          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1 min-w-0">
            <span className="truncate">{sellerName}</span>
            {pet.seller?.is_verified && <VerifiedBadge size={12} />}
          </p>
        )}

        <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
          <MapPin size={11} className="shrink-0" />
          <span className="truncate">{pet.location}</span>
        </div>

        {pet.vaccinated && (
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 mb-3">
            <CheckCircle size={11} /> Vaccinated
          </div>
        )}

        {/* Price + CTA */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <span className="font-bold text-indigo-600 text-[15px]">
            ₦{pet.price.toLocaleString()}
          </span>
          <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
            View →
          </span>
        </div>
      </div>
    </Link>
  );
}
