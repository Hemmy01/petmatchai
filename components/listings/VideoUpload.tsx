"use client";
import { useState, useRef } from "react";
import { Video, X, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Props = {
  onChange: (url: string | null) => void;
};

export default function VideoUpload({ onChange }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError("");

    const allowed = ["video/mp4", "video/webm", "video/quicktime"];
    if (!allowed.includes(file.type)) {
      setError("Only MP4, WebM, or MOV videos are supported.");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError("Video must be under 100 MB.");
      return;
    }

    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setUploadedUrl(null);
    onChange(null);

    const { data: { session } } = await supabase.auth.getSession();
    const form = new FormData();
    form.append("file", file);
    form.append("bucket", "pet-videos");

    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: form,
    });

    setUploading(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Upload failed. Please try again.");
      return;
    }

    const json = await res.json();
    setUploadedUrl(json.url);
    onChange(json.url);
  }

  function clear() {
    setPreview(null);
    setUploadedUrl(null);
    setError("");
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      {!preview ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors select-none">
          <Video size={22} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm font-medium text-gray-700">Upload a short video clip</p>
          <p className="text-xs text-gray-400 mt-1">MP4 · WebM · MOV · max 100 MB · recommended ≤ 60 seconds</p>
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
          />
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-black">
          <video src={preview} controls className="w-full max-h-52 object-contain" />
          <div className="absolute top-2 right-2 flex gap-1.5">
            {uploading && (
              <div className="bg-black/60 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> Uploading…
              </div>
            )}
            {uploadedUrl && !uploading && (
              <div className="bg-green-600 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                <CheckCircle size={12} /> Uploaded
              </div>
            )}
            <button
              type="button"
              onClick={clear}
              className="bg-black/60 text-white rounded-lg w-7 h-7 flex items-center justify-center hover:bg-red-600 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}
