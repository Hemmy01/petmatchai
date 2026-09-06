"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Lock, ShieldCheck, CheckCircle2, CreditCard, X, RotateCcw } from "lucide-react";
import { api } from "@/lib/api-client";

type Tx = {
  id: string; reference: string; amount: number; status: string; provider: string;
} | null;

export default function PaymentPanel({ offer, isSeller }: {
  offer: { id: string; amount: number; counter_amount: number | null; pet: { name: string } | null };
  isSeller: boolean;
}) {
  const amount = Number(offer.counter_amount ?? offer.amount);
  const petName = offer.pet?.name ?? "the pet";
  const [tx, setTx] = useState<Tx>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [demoRef, setDemoRef] = useState<string | null>(null);

  const verify = useCallback(async (reference: string) => {
    setBusy(true); setError("");
    const res = await api.post("/api/payments", { type: "verify", reference });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setTx(res.data); setDemoRef(null);
  }, []);

  useEffect(() => {
    api.get(`/api/payments?offerId=${offer.id}`).then((res) => {
      const t: Tx = res.data ?? null;
      setTx(t);
      // Handle return from the Paystack (test) checkout.
      const payRef = new URLSearchParams(window.location.search).get("pay_ref");
      if (payRef && t && t.reference === payRef && t.status === "pending") verify(payRef);
    }).finally(() => setLoading(false));
  }, [offer.id, verify]);

  async function startPayment() {
    setBusy(true); setError("");
    const res = await api.post("/api/payments", { type: "initialize", offerId: offer.id });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    if (res.alreadyPaid) { setTx(res.data); return; }
    if (res.mode === "paystack" && res.authorization_url) { window.location.href = res.authorization_url; return; }
    setDemoRef(res.reference); // demo checkout modal
  }

  async function release() {
    if (!tx) return;
    setBusy(true); setError("");
    const res = await api.post("/api/payments", { type: "release", reference: tx.reference });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setTx(res.data);
  }

  if (loading) return null;
  const status = tx?.status;
  const money = `₦${amount.toLocaleString()}`;

  return (
    <div className="mt-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
      {/* Completed */}
      {status === "released" ? (
        <div className="flex items-start gap-2.5">
          <CheckCircle2 size={18} className="text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-700">Payment complete — {money} released to seller</p>
            <p className="text-xs text-gray-500 mt-0.5">Handover confirmed. This sale is finished.</p>
          </div>
        </div>
      ) : status === "refunded" ? (
        <div className="flex items-start gap-2.5">
          <RotateCcw size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-amber-700">This escrow payment was refunded to the buyer.</p>
        </div>
      ) : status === "paid_escrow" ? (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Lock size={16} className="text-indigo-600" />
            <p className="text-sm font-semibold text-indigo-800">{money} paid — held safely in escrow</p>
          </div>
          {isSeller ? (
            <p className="text-xs text-gray-600">The buyer has paid. You&apos;ll receive the funds as soon as they confirm they&apos;ve received {petName}.</p>
          ) : (
            <>
              <p className="text-xs text-gray-600 mb-3">Once you&apos;ve received {petName} and you&apos;re satisfied, release the funds to the seller.</p>
              <button onClick={release} disabled={busy}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Confirm handover & release funds
              </button>
            </>
          )}
        </div>
      ) : (
        // No payment yet
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck size={16} className="text-indigo-600" />
            <p className="text-sm font-semibold text-indigo-800">Secure payment (escrow)</p>
          </div>
          {isSeller ? (
            <p className="text-xs text-gray-600">Waiting for the buyer to pay {money} into escrow. You&apos;ll be notified once they do.</p>
          ) : (
            <>
              <p className="text-xs text-gray-600 mb-3">
                Pay {money} into a secure escrow. The seller only gets paid after you confirm you&apos;ve received {petName} — protecting you from fraud.
              </p>
              <button onClick={startPayment} disabled={busy}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Lock size={15} />}
                Pay {money} securely
              </button>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {/* Demo checkout modal */}
      {demoRef && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !busy && setDemoRef(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="bg-indigo-600 px-5 py-3 flex items-center justify-between">
              <span className="text-white font-semibold flex items-center gap-2"><CreditCard size={16} /> Checkout</span>
              <button onClick={() => !busy && setDemoRef(null)} className="text-white/80 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-center">
                <p className="text-xs text-gray-400">Amount to pay into escrow</p>
                <p className="text-2xl font-bold text-gray-900">{money}</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-700 text-center">
                Demo mode — this is a simulated payment. No real money is charged.
              </div>
              <div className="space-y-2 opacity-60 pointer-events-none">
                <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400">Card number · 4084 0840 8408 4081</div>
                <div className="flex gap-2">
                  <div className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400">12/34</div>
                  <div className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400">CVV 408</div>
                </div>
              </div>
              <button onClick={() => verify(demoRef)} disabled={busy}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={15} />}
                Pay {money}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
