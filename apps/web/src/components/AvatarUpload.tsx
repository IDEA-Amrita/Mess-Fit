"use client";

import { useState, useRef, useEffect } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Camera01Icon } from "@hugeicons/core-free-icons";
import { supabase } from "@/lib/supabase";
import { toast } from "@/lib/toast-store";
import { v4 as uuidv4 } from "uuid";

export function AvatarUpload() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [initial, setInitial] = useState("U");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadProfile() {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        const metadata = data.user.user_metadata;
        setAvatarUrl(metadata?.avatar_url || null);
        const name = metadata?.display_name || data.user.email || "User";
        setInitial(name.charAt(0).toUpperCase());
      }
    }
    loadProfile();
  }, []);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true);
      
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        toast.error("Please upload an image file");
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be smaller than 5MB");
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error("User not authenticated");
      const userId = userData.user.id;

      // Unique file name to avoid cache issues
      const fileExt = file.name.split(".").pop();
      const filePath = `${userId}/${uuidv4()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);
        
      const publicUrl = publicUrlData.publicUrl;

      // Update user metadata
      const { error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      });

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      // updateUser emits USER_UPDATED, which the dashboard shell listens for, so
      // the sidebar avatar changes without a reload.
      toast.success("Profile picture updated!");
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "Error uploading image");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-6">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full bg-accent-muted flex items-center justify-center border-4 border-background">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Avatar"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-3xl font-bold text-accent">{initial}</span>
        )}
        
        {/* Hover Overlay */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 opacity-0 transition-opacity hover:opacity-100 disabled:opacity-100"
          title="Change profile picture"
        >
          {uploading ? (
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          ) : (
            <>
              <HugeiconsIcon icon={Camera01Icon} className="h-6 w-6 text-white" />
              <span className="mt-1 text-[10px] font-medium text-white">Edit</span>
            </>
          )}
        </button>
      </div>
      
      <div className="flex-1">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/jpeg, image/png, image/webp"
          className="hidden"
        />
        <h3 className="text-base font-medium text-foreground">Profile Picture</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a clear photo to personalize your account. Minimum 256x256px recommended.
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="mt-3 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Change picture"}
        </button>
      </div>
    </div>
  );
}
