"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

/**
 * Locks social-login users who haven't finished signing up into the onboarding
 * flow. Once Google has authenticated them, they MUST complete their profile
 * before they can reach anything else — including the login/register pages.
 *
 * An un-onboarded (onboarded === false) signed-in user is confined to
 * /auth/select-role (the info-collection flow) and /auth/callback (the brief
 * OAuth landing). Any other route — dashboard, listings, even /auth/login or
 * /auth/register — bounces them back to finish. They can still bail out via the
 * "Sign out" action on the onboarding page.
 *
 * Note: sessions are stored client-side (localStorage), so this gate runs in the
 * browser. Server-side data access is independently protected by per-route token
 * verification + RLS, so this is a UX/onboarding gate, not the security boundary.
 */
export default function OnboardingGuard() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (loading || !user) return;
    const onOnboardingFlow =
      pathname === "/auth/select-role" || pathname.startsWith("/auth/callback");
    if (user.onboarded === false && !onOnboardingFlow) {
      router.replace("/auth/select-role");
    }
  }, [user, loading, pathname, router]);

  return null;
}
