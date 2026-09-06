"use client"
import { useEffect, useState, useRef } from "react"
import type { Map as LeafletMap } from "leaflet"

type PetPin = {
  id: string
  name: string
  breed: string
  price: number
  location: string
  species?: string
  image_url?: string | null
}

interface Props {
  pets: PetPin[]
  onPetClick?: (petId: string) => void
}

type GeoCache = Record<string, { lat: number; lng: number } | null>

export default function PetMap({ pets, onPetClick }: Props) {
  const mapRef = useRef<LeafletMap | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [geoCache, setGeoCache] = useState<GeoCache>({})
  const [loading, setLoading] = useState(true)

  // Geocode all unique locations
  useEffect(() => {
    const unique = [...new Set(pets.map((p) => p.location).filter(Boolean))]
    if (!unique.length) { setLoading(false); return }

    let remaining = unique.length
    const results: GeoCache = {}

    unique.forEach((loc, i) => {
      // Stagger requests to respect Nominatim rate limit
      setTimeout(async () => {
        try {
          const res = await fetch(`/api/geocode?location=${encodeURIComponent(loc)}`)
          const data = await res.json()
          results[loc] = data.lat ? { lat: data.lat, lng: data.lng } : null
        } catch {
          results[loc] = null
        }
        remaining--
        if (remaining === 0) {
          setGeoCache(results)
          setLoading(false)
        }
      }, i * 300)
    })
  }, [pets])

  // Initialize Leaflet map after geocoding completes
  useEffect(() => {
    if (loading || !containerRef.current || mapRef.current) return

    const initMap = async () => {
      const L = (await import("leaflet")).default

      // Fix default icon paths
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      const map = L.map(containerRef.current!, {
        center: [9.082, 8.6753], // Nigeria center
        zoom: 6,
      })

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map)

      // Add markers for each pet
      const bounds: [number, number][] = []
      pets.forEach((pet) => {
        const geo = geoCache[pet.location]
        if (!geo) return
        bounds.push([geo.lat, geo.lng])

        const popup = `
          <div style="min-width:160px">
            <div style="font-weight:600;font-size:14px;margin-bottom:4px">${pet.name}</div>
            <div style="font-size:12px;color:#6b7280;margin-bottom:4px">${pet.breed} · ₦${Number(pet.price).toLocaleString()}</div>
            <div style="font-size:12px;color:#4f46e5;margin-bottom:6px">${pet.location}</div>
            <a href="/listings/${pet.id}" style="display:inline-block;background:#4f46e5;color:white;padding:4px 10px;border-radius:6px;font-size:12px;text-decoration:none;font-weight:500">View Listing →</a>
          </div>`

        L.marker([geo.lat, geo.lng])
          .bindPopup(popup)
          .on("click", () => onPetClick?.(pet.id))
          .addTo(map)
      })

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
      }

      mapRef.current = map
    }

    initMap()

    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [loading, geoCache, pets, onPetClick])

  if (loading) {
    return (
      <div className="w-full h-[420px] bg-gray-100 rounded-xl flex flex-col items-center justify-center gap-3 text-gray-400">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Geocoding {pets.length} listing locations…</p>
      </div>
    )
  }

  const mapped = pets.filter((p) => geoCache[p.location]).length

  return (
    <div>
      <div ref={containerRef} className="w-full h-[420px] rounded-xl overflow-hidden z-0" style={{ position: "relative" }} />
      <p className="text-xs text-gray-400 mt-2 text-center">
        {mapped} of {pets.length} listings shown on map · Powered by OpenStreetMap
      </p>
    </div>
  )
}
