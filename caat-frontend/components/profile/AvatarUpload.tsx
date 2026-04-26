"use client";

import React, { useRef, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/src/lib/supabaseClient";
import { toast } from "sonner";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const BUCKET = "profile-avatars";

/**
 * Validates avatar by magic bytes rather than trusting browser-reported MIME type (E4).
 */
async function validateAvatarMagicBytes(file: File): Promise<boolean> {
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
  // WebP: RIFF....WEBP (bytes 0-3 = 52 49 46 46, bytes 8-11 = 57 45 42 50)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return true;
  // GIF: GIF8
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true;
  return false;
}

/**
 * Recover a storage object path from its public URL. Supabase public URLs
 * follow the pattern `<host>/storage/v1/object/public/<bucket>/<path>`.
 * Returns null on any URL that doesn't match (older avatars, external URLs).
 */
function extractStoragePath(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const tail = url.slice(idx + marker.length);
  // Trim cache-busting query strings — older code appended `?t=...`.
  const q = tail.indexOf("?");
  return q === -1 ? tail : tail.slice(0, q);
}

interface AvatarUploadProps {
  userId: string;
  avatarUrl: string | null;
  fallbackInitials: string;
  onUploaded: (url: string | null) => void;
}

export function AvatarUpload({
  userId,
  avatarUrl,
  fallbackInitials,
  onUploaded,
}: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Please upload a JPEG, PNG, WebP, or GIF image.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Image must be under 5 MB.");
      return;
    }

    const validBytes = await validateAvatarMagicBytes(file);
    if (!validBytes) {
      toast.error("File content does not match an allowed image type.");
      return;
    }

    setUploading(true);
    try {
      // E6 — random suffix prevents predictable URLs and avoids collisions
      // when re-uploading. Public bucket means anyone with the URL can view,
      // so we want the URL itself to be unguessable.
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
      const storagePath = `${userId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

      // Look up the existing avatar so we can clean it up after the profile
      // row is updated. The avatar_url stored is the full public URL, from
      // which we recover the storage path.
      const { data: existing } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .maybeSingle();

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);

      if (updateError) throw updateError;

      // Best-effort cleanup of the previous avatar — failures are non-fatal.
      if (existing?.avatar_url && typeof existing.avatar_url === "string") {
        const prevPath = extractStoragePath(existing.avatar_url, BUCKET);
        if (prevPath && prevPath !== storagePath && prevPath.startsWith(`${userId}/`)) {
          await supabase.storage.from(BUCKET).remove([prevPath]);
        }
      }

      onUploaded(publicUrl);
      toast.success("Avatar updated.");
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error(err);
      toast.error("Failed to upload avatar.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      // Look up the existing avatar so we can also remove the storage object.
      const { data: existing } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .maybeSingle();

      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);

      if (error) throw error;

      if (existing?.avatar_url && typeof existing.avatar_url === "string") {
        const prevPath = extractStoragePath(existing.avatar_url, BUCKET);
        if (prevPath && prevPath.startsWith(`${userId}/`)) {
          await supabase.storage.from(BUCKET).remove([prevPath]);
        }
      }

      onUploaded(null);
      toast.success("Avatar removed.");
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error(err);
      toast.error("Failed to remove avatar.");
    } finally {
      setRemoving(false);
    }
  }

  const isBusy = uploading || removing;

  return (
    <div className="relative shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="relative group cursor-pointer">
            <Avatar className="size-20 text-xl">
              {avatarUrl && <AvatarImage src={avatarUrl} alt="Profile avatar" />}
              <AvatarFallback className="text-lg font-semibold">
                {fallbackInitials}
              </AvatarFallback>
            </Avatar>

            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              {isBusy ? (
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              ) : (
                <span className="text-[10px] font-medium text-white text-center leading-tight px-1">
                  Edit
                </span>
              )}
            </div>
          </div>
        </DropdownMenuTrigger>

        {!isBusy && (
          <DropdownMenuContent align="start" sideOffset={6}>
            <DropdownMenuItem onClick={() => inputRef.current?.click()}>
              {avatarUrl ? "Edit profile picture" : "Upload profile picture"}
            </DropdownMenuItem>
            {avatarUrl && (
              <DropdownMenuItem
                onClick={handleRemove}
                className="text-destructive focus:text-destructive"
              >
                Remove profile picture
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        )}
      </DropdownMenu>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
