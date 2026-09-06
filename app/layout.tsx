import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import Navbar from "@/components/layout/Navbar";
import { AuthProvider } from "@/lib/auth-context";
import { CompareProvider } from "@/lib/compare-context";
import CompareTray from "@/components/compare/CompareTray";
import { ToastProvider } from "@/lib/toast-context";
import ToastContainer from "@/components/ui/ToastContainer"
import IdleTimeoutModal from "@/components/ui/IdleTimeoutModal";
import ServiceWorkerRegistrar from "@/components/layout/ServiceWorkerRegistrar";
import SiteFooter from "@/components/layout/SiteFooter";
import OnboardingGuard from "@/components/auth/OnboardingGuard";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PetMatchAI – AI-Powered Pet Matchmaking",
  description: "Connect pet buyers and sellers with AI-powered matching",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full bg-gray-50 font-sans">
        <AuthProvider>
          <ToastProvider>
          <CompareProvider>
            <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-indigo-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-semibold">
              Skip to main content
            </a>
            <Navbar />
            <main id="main-content" role="main" className="max-w-7xl mx-auto px-4 py-4 pb-24 md:pb-6">{children}</main>
            <SiteFooter />
            <CompareTray />
            <ToastContainer />
            <IdleTimeoutModal />
            <OnboardingGuard />
            <ServiceWorkerRegistrar />
          </CompareProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
