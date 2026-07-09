// ─────────────────────────────────────────────────────────────────────────
//  设备维护照片 storage — same shape as lib/menu.ts's menu-images: public
//  read (URL has an unguessable random suffix, same tradeoff menu images
//  already make), writes restricted to tenant members via RLS. These photos
//  aren't linked from anywhere customer-facing, unlike menu images. See
//  supabase/equipment-photos.sql for the bucket + RLS policies.
// ─────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";

const BUCKET = "equipment-photos";

/** Upload a maintenance photo to the tenant's folder; returns its public URL. */
export async function uploadEquipmentPhoto(slug: string, file: File): Promise<{ url?: string; error?: string }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    console.error("uploadEquipmentPhoto", error);
    return { error: error.message };
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}

/** Best-effort delete given the stored URL; failures are logged, not thrown. */
export async function deleteEquipmentPhoto(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  if (i === -1) return;
  const path = decodeURIComponent(url.slice(i + marker.length));
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) console.error("deleteEquipmentPhoto", error);
}
