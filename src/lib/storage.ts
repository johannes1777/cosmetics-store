import { supabase } from "./supabase";

// Photos live in the public Supabase Storage bucket "storefront" (see 004_storefront_content.sql).
// Everyone can VIEW them; only admins can upload or delete. The bucket itself also refuses
// files over 5 MB or that are not JPEG/PNG/WebP, so these checks are for fast, friendly feedback.
export const STORAGE_BUCKET = "storefront";
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";

const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
type ImageType = keyof typeof EXTENSIONS;

export function publicImageUrl(path: string): string {
  if (!supabase) return "";
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

// Looks at the first bytes of the file (its "signature") instead of trusting its name,
// so a renamed file (for example a .exe called photo.jpg) is caught.
async function sniffType(file: File): Promise<ImageType | null> {
  const b = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  const riff = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46;
  const webp = b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50;
  if (riff && webp) return "image/webp";
  return null;
}

export type CheckResult = { ok: true; type: ImageType } | { ok: false; message: string };

export async function checkImageFile(file: File): Promise<CheckResult> {
  if (file.size === 0) return { ok: false, message: "That file is empty." };
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return { ok: false, message: `That picture is ${mb} MB. The limit is 5 MB. Please choose a smaller one or compress it first.` };
  }
  const type = await sniffType(file);
  if (!type) return { ok: false, message: "Only JPEG, PNG or WebP pictures can be uploaded. (GIF, SVG and other formats are not allowed.)" };
  return { ok: true, type };
}

// Uploads under a random name inside the given folder, for example "hero" or "products/<id>".
// A new random name every time means an existing picture can never be overwritten.
export async function uploadImage(folder: string, file: File): Promise<{ path: string } | { error: string }> {
  if (!supabase) return { error: "The shop is not connected to its database." };
  const check = await checkImageFile(file);
  if (!check.ok) return { error: check.message };
  const path = `${folder}/${crypto.randomUUID()}.${EXTENSIONS[check.type]}`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { contentType: check.type, upsert: false, cacheControl: "31536000" });
  if (error) return { error: `The upload was refused: ${error.message}` };
  return { path };
}

// Returns true only if the file was really removed.
export async function deleteImage(path: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  return !error && Array.isArray(data) && data.length > 0;
}
