"use client";

/**
 * Side panel for the auth pages — a self-contained video block that sits
 * next to the form column (not behind it). Clip lives at
 * public/auth-bonding.mp4; the dark base shows for the instant before the
 * muted autoplay starts. Hidden below the lg breakpoint so small screens
 * just show the form.
 */
export default function AuthVideoPanel({ caption }: { caption?: string }) {
  return (
    <div className="relative hidden lg:block bg-gray-900">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        aria-hidden="true"
      >
        <source src="/auth-bonding.mp4" type="video/mp4" />
      </video>

      {/* Subtle bottom scrim so the caption stays readable; footage stays clear. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

      {caption && (
        <p className="absolute bottom-8 right-10 z-10 max-w-xs text-right text-sm font-medium text-white/90 drop-shadow-lg">
          {caption}
        </p>
      )}
    </div>
  );
}
