"use client";
import Link from "next/link";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import AuthVideoPanel from "@/components/auth/AuthVideoPanel";

function IdleBanner() {
  const searchParams = useSearchParams();
  if (searchParams.get("reason") !== "idle") return null;
  return (
    <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm px-4 py-3 rounded-xl mb-4 flex items-center gap-2">
      <Lock size={15} />
      You were signed out due to inactivity. Please sign in again.
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithGoogle } = useAuth();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isLocked, setIsLocked] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError("Please enter your email and password."); return; }
    setError("");
    setIsLocked(false);
    setLoading(true);
    const { error: err } = await login(email, password);
    setLoading(false);
    if (err) {
      const locked = err.toLowerCase().includes("locked") || err.toLowerCase().includes("temporarily");
      setIsLocked(locked);
      setError(err);
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="w-screen relative left-1/2 -translate-x-1/2 -mt-4 -mb-24 md:-mb-6 min-h-[100dvh] grid lg:grid-cols-[minmax(360px,460px)_1fr] bg-white">
        <div className="flex flex-col justify-center overflow-y-auto px-6 py-10 sm:px-12 lg:px-20">
          <div className="mx-auto w-full max-w-md">
          <Suspense fallback={null}>
            <IdleBanner />
          </Suspense>

          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🐾</div>
            <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
            <p className="text-sm text-gray-500 mt-1">Sign in to your PetMatchAI account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" aria-label="Sign in form">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input id="login-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                aria-required="true"
                disabled={isLocked}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:cursor-not-allowed" />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input id="login-password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  aria-required="true"
                  aria-describedby={error ? "login-error" : undefined}
                  disabled={isLocked}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10 disabled:bg-gray-50 disabled:cursor-not-allowed" />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                  {show ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                </button>
              </div>
            </div>

            {error && (
              <div id="login-error" role="alert"
                className={`text-xs px-3 py-2.5 rounded-lg flex items-start gap-2 ${
                  isLocked ? "bg-red-50 border border-red-200 text-red-700" : "bg-red-50 text-red-600"
                }`}>
                {isLocked && <Lock size={13} className="mt-0.5 shrink-0" />}
                <span>{error}</span>
              </div>
            )}

            {!isLocked && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 text-gray-600 cursor-pointer">
                  <input type="checkbox" className="accent-indigo-600" /> Remember me
                </label>
                <Link href="/auth/forgot-password" className="text-indigo-600 hover:underline text-sm">Forgot password?</Link>
              </div>
            )}

            <button type="submit" disabled={loading || isLocked}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isLocked ? "Account Locked" : loading ? "Signing in..." : "Sign In"}
            </button>

            {isLocked && (
              <p className="text-xs text-center text-gray-500">
                <Link href="/auth/forgot-password" className="text-indigo-600 hover:underline">Reset your password</Link>
                {" "}or wait for the lockout to expire.
              </p>
            )}
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-xs text-gray-400 bg-white px-3">or continue with</div>
          </div>

          <button
            type="button"
            onClick={async () => {
              setLoading(true);
              const { error: err } = await loginWithGoogle();
              if (err) { setError(err); setLoading(false); }
            }}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-50 disabled:opacity-60 transition-colors">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continue with Google
          </button>

          <p className="text-center text-sm text-gray-500 mt-4">
            No account?{" "}
            <Link href="/auth/register" className="text-indigo-600 font-medium hover:underline">Create one</Link>
          </p>
          </div>
        </div>

        <AuthVideoPanel caption="Where loving homes meet loyal friends." />
      </div>
  );
}
