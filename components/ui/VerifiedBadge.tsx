import { BadgeCheck } from "lucide-react";

// Instagram-style verification badge: a solid blue seal with a white check.
// Shown next to a verified user's name; nothing renders for unverified users
// (callers gate on is_verified). Single source of truth so every surface matches.
export default function VerifiedBadge({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <BadgeCheck
      size={size}
      className={`fill-blue-500 text-white shrink-0 ${className}`}
      aria-label="Verified account"
    />
  );
}
