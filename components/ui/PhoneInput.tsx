"use client";
import { Check, AlertCircle } from "lucide-react";
import {
  toNationalDigits,
  formatNationalPhone,
  isValidNigerianMobile,
  toE164,
} from "@/lib/nigeria";

export default function PhoneInput({
  value,
  onChange,
  id = "phone",
  required = false,
}: {
  value: string;              // stored as E.164, e.g. "+2348031234567"
  onChange: (v: string) => void;
  id?: string;
  required?: boolean;
}) {
  const national = toNationalDigits(value);
  const valid = isValidNigerianMobile(national);
  const showError = national.length > 0 && !valid;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = toNationalDigits(e.target.value);
    onChange(toE164(next));
  }

  return (
    <div>
      <div
        className={`flex items-stretch rounded-xl border overflow-hidden focus-within:ring-2 ${
          showError
            ? "border-red-400 focus-within:ring-red-400"
            : valid
            ? "border-green-400 focus-within:ring-green-400"
            : "border-gray-300 focus-within:ring-indigo-500"
        }`}
      >
        <span className="flex items-center gap-1.5 px-3 bg-gray-50 border-r border-gray-200 text-sm text-gray-600 select-none">
          <span aria-hidden="true">🇳🇬</span> +234
        </span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required={required}
          value={formatNationalPhone(national)}
          onChange={handleChange}
          aria-invalid={showError}
          aria-describedby={`${id}-hint`}
          placeholder="803 123 4567"
          className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
        />
        <span className="flex items-center pr-3">
          {valid && <Check size={16} className="text-green-500" aria-hidden="true" />}
          {showError && <AlertCircle size={16} className="text-red-500" aria-hidden="true" />}
        </span>
      </div>
      <p id={`${id}-hint`} className={`text-xs mt-1 ${showError ? "text-red-600" : "text-gray-400"}`}>
        {showError
          ? "Enter a valid Nigerian mobile number (e.g. 0803 123 4567)."
          : "Nigerian mobile number — the leading 0 is optional."}
      </p>
    </div>
  );
}
