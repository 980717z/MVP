// ─────────────────────────────────────────────────────────────────────────
//  菜单设置 data layer — talks to the dedicated `menu_items` table and the
//  `menu-images` storage bucket (see supabase/menu.sql).
// ─────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";

export interface MenuItem {
  id: string;
  tenant_slug: string;
  name_zh: string;
  name_en: string;
  price: number | null;
  category: string;
  image_url: string;
  sort: number;
  created_at: string;
}

export async function listMenuItems(slug: string): Promise<MenuItem[]> {
  const { data, error } = await supabase
    .from("menu_items")
    .select("*")
    .eq("tenant_slug", slug)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listMenuItems", error);
    return [];
  }
  return (data ?? []) as MenuItem[];
}

export async function addMenuItem(
  slug: string,
  item: { name_zh: string; name_en?: string; price?: string | number | null; category?: string; image_url?: string }
): Promise<{ error?: string }> {
  const price =
    item.price === "" || item.price === undefined || item.price === null
      ? null
      : Number(item.price);
  const { error } = await supabase.from("menu_items").insert({
    tenant_slug: slug,
    name_zh: item.name_zh,
    name_en: item.name_en ?? "",
    price,
    category: item.category ?? "",
    image_url: item.image_url ?? "",
  });
  if (error) {
    console.error("addMenuItem", error);
    return { error: error.message };
  }
  return {};
}

export async function deleteMenuItem(id: string): Promise<void> {
  const { error } = await supabase.from("menu_items").delete().eq("id", id);
  if (error) console.error("deleteMenuItem", error);
}

/** Upload a dish image to the tenant's folder; returns its public URL. */
export async function uploadMenuImage(slug: string, file: File): Promise<{ url?: string; error?: string }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("menu-images").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    console.error("uploadMenuImage", error);
    return { error: error.message };
  }
  const { data } = supabase.storage.from("menu-images").getPublicUrl(path);
  return { url: data.publicUrl };
}
