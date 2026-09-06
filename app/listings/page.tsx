"use client";
import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { Search, SlidersHorizontal, MapPin, Loader2, X, Map, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import PetCard, { PetCardData } from "@/components/listings/PetCard";
const PetMap = dynamic(() => import("@/components/listings/PetMap"), { ssr: false, loading: () => <div className="w-full h-[420px] bg-gray-100 rounded-xl animate-pulse" /> });

const speciesOptions = [
  { value: "All",   label: "All"    },
  { value: "dog",   label: "Dogs"   },
  { value: "cat",   label: "Cats"   },
  { value: "other", label: "Others" },
];
const genderOptions = ["Any", "male", "female"];
const VERIFIED_FILTER_KEY = "petmatchai_verified_only";
const sortOptions = [
  { value: "created_at", label: "Newest First" },
  { value: "views", label: "Most Popular" },
  { value: "price-asc", label: "Price: Low to High" },
  { value: "price-desc", label: "Price: High to Low" },
  { value: "age_months", label: "Youngest First" },
];

function ListingsContent() {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [type, setType] = useState(searchParams.get("type") ?? "All");
  const [gender, setGender] = useState("Any");
  const [maxPrice, setMaxPrice] = useState(5000000);
  const [sort, setSort] = useState("created_at");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [pets, setPets] = useState<PetCardData[]>([]);
  const [mapView, setMapView] = useState(false);
  const [loading, setLoading] = useState(true);

  // Autocomplete
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allBreeds, setAllBreeds] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Fetch distinct breeds once on mount
  useEffect(() => {
    supabase
      .from("pets")
      .select("breed")
      .eq("status", "active")
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map((r: { breed: string }) => r.breed).filter(Boolean))].sort();
          setAllBreeds(unique as string[]);
        }
      });
  }, []);

  // Filter suggestions as the user types
  useEffect(() => {
    if (search.trim().length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    const q = search.toLowerCase();
    const matches = allBreeds.filter((b) => b.toLowerCase().includes(q)).slice(0, 6);
    setSuggestions(matches);
    setShowSuggestions(matches.length > 0);
  }, [search, allBreeds]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchPets = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("pets")
      .select("*, seller:profiles!pets_seller_id_fkey(id, name, location, is_verified)")
      .eq("status", "active")
      .lte("price", maxPrice);

    if (type === "other") {
      // Catch all species that are not dog or cat
      query = query.neq("species", "dog").neq("species", "cat");
    } else if (type !== "All") {
      query = query.eq("species", type);
    }
    if (gender !== "Any") query = query.eq("gender", gender);
    if (verifiedOnly) query = (query as any).eq("seller.is_verified", true);
    if (search) query = query.or(`name.ilike.%${search}%,breed.ilike.%${search}%`);

    if (sort === "price-asc") query = query.order("price", { ascending: true });
    else if (sort === "price-desc") query = query.order("price", { ascending: false });
    else if (sort === "age_months") query = query.order("age_months", { ascending: true });
    else if (sort === "views") query = query.order("views", { ascending: false });
    else query = query.order("created_at", { ascending: false });

    const { data } = await query;
    setPets(data ?? []);
    setLoading(false);
  }, [search, type, gender, maxPrice, sort, verifiedOnly]);

  useEffect(() => {
    const timer = setTimeout(fetchPets, 300);
    return () => clearTimeout(timer);
  }, [fetchPets]);

  function saveSearch(term: string) {
    if (!term.trim()) return;
    const existing: string[] = JSON.parse(localStorage.getItem("petmatchai_searches") ?? "[]");
    const updated = [term.trim(), ...existing.filter((s) => s !== term.trim())].slice(0, 5);
    localStorage.setItem("petmatchai_searches", JSON.stringify(updated));
  }

  function applySuggestion(breed: string) {
    setSearch(breed);
    setShowSuggestions(false);
    saveSearch(breed);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && search.trim()) {
      setShowSuggestions(false);
      saveSearch(search);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Find Your Pet</h1>
        <div className="flex gap-2">
          {/* Search with autocomplete */}
          <div className="relative flex-1" ref={searchRef}>
            <Search size={16} className="absolute left-3 top-3 text-gray-400 z-10" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Search by name or breed…"
              className="w-full pl-9 pr-8 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setShowSuggestions(false); }}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                aria-label="Clear search">
                <X size={15} />
              </button>
            )}

            {showSuggestions && (
              <ul className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {suggestions.map((breed) => (
                  <li key={breed}>
                    <button
                      onMouseDown={(e) => { e.preventDefault(); applySuggestion(breed); }}
                      className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2">
                      <Search size={12} className="text-gray-400 shrink-0" />
                      {breed}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={() => setMapView((v) => !v)}
            title={mapView ? "Switch to grid view" : "Switch to map view"}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium ${mapView ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
            <Map size={16} /> Map
          </button>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-sm font-medium ${showFilters ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>
            <SlidersHorizontal size={16} /> Filters
          </button>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
            {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {showFilters && (
          <div className="mt-3 bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Species</label>
              <div className="flex gap-2 flex-wrap">
                {speciesOptions.map((s) => (
                  <button key={s.value} onClick={() => setType(s.value)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border ${type === s.value ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
              <div className="flex gap-2 flex-wrap">
                {genderOptions.map((g) => (
                  <button key={g} onClick={() => setGender(g)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border capitalize ${gender === g ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Price: ₦{maxPrice.toLocaleString()}</label>
              <input
                type="range" min={10000} max={5000000} step={10000}
                value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-indigo-600" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Seller Trust</label>
              <button
                onClick={() => setVerifiedOnly((v) => !v)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${verifiedOnly ? "bg-blue-600 text-white border-blue-600" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                <ShieldCheck size={12} /> Verified Sellers Only
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <MapPin size={14} className="text-gray-400" />
        <span className="text-sm text-gray-500">
          {loading ? "Loading…" : `${pets.length} pet${pets.length !== 1 ? "s" : ""} available`}
        </span>
        {/* Active filter chips */}
        {(type !== "All" || gender !== "Any") && (
          <div className="flex gap-1 ml-2">
            {type !== "All" && (
              <span className="flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">
                {speciesOptions.find((s) => s.value === type)?.label ?? type}
                <button onClick={() => setType("All")} aria-label="Remove species filter"><X size={11} /></button>
              </span>
            )}
            {gender !== "Any" && (
              <span className="flex items-center gap-1 bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full capitalize">
                {gender}
                <button onClick={() => setGender("Any")} aria-label="Remove gender filter"><X size={11} /></button>
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-indigo-600" />
        </div>
      ) : pets.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">🔍</div>
          <p className="font-medium">No pets found. Try adjusting your filters.</p>
        </div>
      ) : mapView ? (
        <PetMap pets={pets} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {pets.map((pet) => <PetCard key={pet.id} pet={pet} />)}
        </div>
      )}
    </div>
  );
}

export default function ListingsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <ListingsContent />
    </Suspense>
  );
}
