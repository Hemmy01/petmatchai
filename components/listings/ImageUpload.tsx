"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { Upload, X, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

export type UploadedFile = { url: string; path: string };

type ImageItem = {
  previewUrl: string;
  uploadedUrl?: string;
  uploading: boolean;
  error?: string;
  file: File;
};

type Props = {
  bucket?: string;
  maxFiles?: number;
  onChange: (urls: string[]) => void;
};

export default function ImageUpload({ bucket = "pet-images", maxFiles = 5, onChange }: Props) {
  const [items, setItems] = useState<ImageItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Notify parent whenever items settle — never call onChange inside a setState updater
  useEffect(() => {
    const urls = items
      .filter((i) => i.uploadedUrl && !i.error && !i.uploading)
      .map((i) => i.uploadedUrl!);
    onChangeRef.current(urls);
  }, [items]);

  async function uploadOne(file: File): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    const form = new FormData();
    form.append("file", file);
    form.append("bucket", bucket);
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${session?.access_token ?? ""}` },
      body: form,
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.url ?? null;
  }

  async function processFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    const slots = maxFiles - items.length;
    const toAdd = arr.slice(0, slots);
    if (!toAdd.length) return;

    const newItems: ImageItem[] = toAdd.map((f) => ({
      file: f,
      previewUrl: URL.createObjectURL(f),
      uploading: true,
    }));

    setItems((prev) => [...prev, ...newItems]);

    for (const item of newItems) {
      const url = await uploadOne(item.file);
      setItems((prev) =>
        prev.map((i) =>
          i === item
            ? { ...i, uploading: false, uploadedUrl: url ?? undefined, error: url ? undefined : "Upload failed" }
            : i
        )
      );
    }
  }

  function remove(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  }, [items.length, maxFiles]);

  const remaining = maxFiles - items.length;

  return (
    <div className="space-y-3">
      {remaining > 0 && (
        <div
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors select-none">
          <Upload size={22} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm font-medium text-gray-700">Drop photos here or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">
            JPEG · PNG · WebP · max 10 MB each · {remaining} slot{remaining !== 1 ? "s" : ""} remaining
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) processFiles(e.target.files); e.target.value = ""; }}
          />
        </div>
      )}

      {items.length > 0 && (
        <div className="grid grid-cols-5 gap-2">
          {items.map((item, i) => (
            <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 group">
              <img src={item.previewUrl} alt="" className={`w-full h-full object-cover ${item.uploading ? "opacity-50" : ""}`} />

              {item.uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  <Loader2 size={16} className="animate-spin text-white" />
                </div>
              )}

              {item.error && (
                <div className="absolute inset-0 bg-red-50/90 flex items-center justify-center p-1">
                  <p className="text-red-600 text-[10px] text-center leading-tight">Upload failed. Click × to remove.</p>
                </div>
              )}

              {i === 0 && !item.uploading && !item.error && (
                <span className="absolute bottom-0 left-0 right-0 bg-indigo-600/90 text-white text-[10px] text-center py-0.5 font-medium">
                  Primary
                </span>
              )}

              {!item.uploading && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(i); }}
                  className="absolute top-1 right-1 bg-black/60 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all">
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {items.length > 0 && (
        <p className="text-xs text-gray-400">First photo is the primary thumbnail shown in listings.</p>
      )}
    </div>
  );
}
