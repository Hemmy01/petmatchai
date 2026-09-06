"use client";

import { usePathname } from "next/navigation";

export default function SiteFooter() {
  const pathname = usePathname();
  // Auth pages use a full-bleed split layout — no footer.
  if (pathname?.startsWith("/auth")) return null;

  return (
    <footer role="contentinfo" className="hidden md:block text-center text-xs text-gray-400 py-4 border-t border-gray-100">
      <a href="/privacy" className="hover:text-gray-600 underline">Privacy Policy</a>
      {" · "}© {new Date().getFullYear()} PetMatchAI · Hemmy Kennel, Lagos
    </footer>
  );
}
