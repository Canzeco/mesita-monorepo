"use client";

// One tap to a profile photo (MESITA-4888, MESITA-4960): Me's camera and Profile's Change photo
// share it. The picked photo shows at once; Storage and the profile follow, and
// a failure puts the old one back and says why.

import { useCallback, useState } from "react";
import { apiUpdateConsumerProfile } from "@/lib/api/profile";
import { uploadConsumerAvatar, validateAvatarFile } from "@/lib/avatar-upload";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { errMsg } from "@/lib/utils";

export function useAvatarUpload() {
  const getSupabase = useLazyBrowserSupabase();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const pick = useCallback(
    async (file: File | undefined) => {
      if (!file || uploading) return;
      const invalid = validateAvatarFile(file);
      if (invalid) {
        toast(invalid);
        return;
      }
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);
      setUploading(true);
      try {
        const supabase = getSupabase();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw new Error("Sign in again to change your photo.");
        const publicUrl = await uploadConsumerAvatar(supabase, data.user.id, file);
        await apiUpdateConsumerProfile(supabase, { avatar_url: publicUrl });
        toast("Photo updated.");
      } catch (e) {
        toast(errMsg(e, "Couldn't upload your photo."));
      } finally {
        setPreviewUrl(null);
        URL.revokeObjectURL(preview);
        setUploading(false);
      }
    },
    [getSupabase, uploading],
  );

  return { pick, uploading, previewUrl };
}
