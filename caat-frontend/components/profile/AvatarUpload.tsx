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

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const storagePath = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      const freshUrl = `${publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: freshUrl })
        .eq("id", userId);

      if (updateError) throw updateError;

      onUploaded(freshUrl);
      toast.success("Avatar updated.");
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload avatar.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);

      if (error) throw error;
      onUploaded(null);
      toast.success("Avatar removed.");
    } catch (err) {
      console.error(err);
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
