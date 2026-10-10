import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { IMAGE_ACCEPT, deleteImage, publicImageUrl, uploadImage } from "../lib/storage";

type Photo = { id: string; path: string; alt: string; position: number };
const MAX_PHOTOS = 8;

export default function ProductPhotos({ productId }: { productId: string }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [alts, setAlts] = useState<Record<string, string>>({});
  const [newAlt, setNewAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    if (!supabase) return;
    const res = await supabase.from("product_images").select("id, path, alt, position").eq("product_id", productId).order("position");
    if (res.error) { setLoadError(res.error.message); return; }
    const rows = (res.data ?? []) as unknown as Photo[];
    setPhotos(rows);
    setAlts(Object.fromEntries(rows.map((p) => [p.id, p.alt])));
  }, [productId]);

  useEffect(() => { void load(); }, [load]);

  const say = (ok: boolean, text: string) => setMessage({ ok, text });

  async function addPhoto(file: File | undefined, input: HTMLInputElement) {
    if (!file || !supabase || !photos) return;
    if (!newAlt.trim()) { say(false, "Please describe the photo first, then choose the file again."); input.value = ""; return; }
    if (photos.length >= MAX_PHOTOS) { say(false, `A product can have up to ${MAX_PHOTOS} photos.`); input.value = ""; return; }
    setBusy(true); setMessage(null);
    const up = await uploadImage(`products/${productId}`, file);
    if ("error" in up) { setBusy(false); input.value = ""; say(false, up.error); return; }
    const position = photos.length === 0 ? 0 : Math.max(...photos.map((p) => p.position)) + 1;
    const res = await supabase.from("product_images").insert({ product_id: productId, path: up.path, alt: newAlt.trim(), position }).select("id");
    if (res.error || !res.data?.length) {
      await deleteImage(up.path);
      say(false, `The photo was not saved: ${res.error?.message ?? "no permission"}`);
    } else {
      setNewAlt("");
      say(true, "Photo added.");
      await load();
    }
    setBusy(false);
    input.value = "";
  }

  async function replacePhoto(photo: Photo, file: File | undefined, input: HTMLInputElement) {
    if (!file || !supabase) return;
    const description = (alts[photo.id] ?? "").trim();
    if (!description) { say(false, "Please describe the photo first, then choose the file again."); input.value = ""; return; }
    setBusy(true); setMessage(null);
    const up = await uploadImage(`products/${productId}`, file);
    if ("error" in up) { setBusy(false); input.value = ""; say(false, up.error); return; }
    const res = await supabase.from("product_images").update({ path: up.path, alt: description }).eq("id", photo.id).select("id");
    if (res.error || !res.data?.length) {
      await deleteImage(up.path);
      say(false, `The photo was not replaced: ${res.error?.message ?? "no permission"}`);
    } else {
      const cleaned = await deleteImage(photo.path);
      say(true, cleaned ? "Photo replaced." : "Photo replaced. (The old file could not be deleted, which is harmless.)");
      await load();
    }
    setBusy(false);
    input.value = "";
  }

  async function saveAlt(photo: Photo) {
    if (!supabase) return;
    const description = (alts[photo.id] ?? "").trim();
    if (!description) { say(false, "The description cannot be empty."); return; }
    setBusy(true);
    const res = await supabase.from("product_images").update({ alt: description }).eq("id", photo.id).select("id");
    setBusy(false);
    if (res.error || !res.data?.length) say(false, `Not saved: ${res.error?.message ?? "no permission"}`);
    else { say(true, "Description saved."); await load(); }
  }

  async function removePhoto(photo: Photo) {
    if (!supabase || !window.confirm("Remove this photo?")) return;
    setBusy(true); setMessage(null);
    const res = await supabase.from("product_images").delete().eq("id", photo.id).select("id");
    if (res.error || !res.data?.length) say(false, `Could not remove it: ${res.error?.message ?? "no permission"}`);
    else { await deleteImage(photo.path); say(true, "Photo removed."); await load(); }
    setBusy(false);
  }

  async function move(index: number, delta: number) {
    if (!supabase || !photos) return;
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    setBusy(true); setMessage(null);
    // One request renumbers all photos together, so the order is never half-changed.
    const rows = next.map((p, i) => ({ id: p.id, product_id: productId, path: p.path, alt: p.alt, position: i }));
    const res = await supabase.from("product_images").upsert(rows, { onConflict: "id" }).select("id");
    if (res.error || res.data?.length !== rows.length) say(false, `Could not reorder: ${res.error?.message ?? "no permission"}`);
    else { say(true, `Moved to position ${target + 1}.`); await load(); }
    setBusy(false);
  }

  if (loadError) {
    return (
      <section className="photo-section">
        <h2>Photos</h2>
        <p className="notice error" role="alert">
          Photos are not available yet. Run <code>supabase/004_storefront_content.sql</code> (see SETUP.md). Detail: {loadError}
        </p>
      </section>
    );
  }
  if (!photos) return <p role="status">Loading photos…</p>;

  return (
    <section className="photo-section" aria-labelledby="photos-heading">
      <h2 id="photos-heading">Photos</h2>
      <p className="muted">The first photo is the main one. Up to {MAX_PHOTOS} photos, JPEG, PNG or WebP, 5 MB each. Without photos the shop shows a drawn sample picture.</p>
      {photos.length === 0 && <p>No photos yet.</p>}
      <ul className="photo-list">
        {photos.map((p, i) => (
          <li key={p.id} className="photo-row">
            <img className="photo-thumb" src={publicImageUrl(p.path)} alt={p.alt} />
            <div className="photo-fields">
              <div className="field">
                <label htmlFor={`alt-${p.id}`}>Photo {i + 1} description</label>
                <input id={`alt-${p.id}`} value={alts[p.id] ?? ""} maxLength={200} onChange={(e) => setAlts((a) => ({ ...a, [p.id]: e.target.value }))} />
              </div>
              <div className="photo-actions">
                <button type="button" className="button button-quiet" disabled={busy || (alts[p.id] ?? "") === p.alt} onClick={() => void saveAlt(p)}>Save description</button>
                <button type="button" className="button button-quiet" disabled={busy || i === 0} onClick={() => void move(i, -1)}>Up<span className="visually-hidden"> photo {i + 1}</span></button>
                <button type="button" className="button button-quiet" disabled={busy || i === photos.length - 1} onClick={() => void move(i, 1)}>Down<span className="visually-hidden"> photo {i + 1}</span></button>
                <button type="button" className="link-button" disabled={busy} onClick={() => void removePhoto(p)}>Remove<span className="visually-hidden"> photo {i + 1}</span></button>
              </div>
              <div className="field">
                <label htmlFor={`replace-${p.id}`}>Replace photo {i + 1} with a new file</label>
                <input id={`replace-${p.id}`} type="file" accept={IMAGE_ACCEPT} disabled={busy} onChange={(e) => void replacePhoto(p, e.target.files?.[0], e.target)} />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {photos.length < MAX_PHOTOS && (
        <div className="add-photo">
          <h3>Add a photo</h3>
          <div className="field">
            <label htmlFor="new-photo-alt">Description of the new photo (required)</label>
            <input id="new-photo-alt" value={newAlt} maxLength={200} onChange={(e) => setNewAlt(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="new-photo-file">Choose a file</label>
            <input id="new-photo-file" type="file" accept={IMAGE_ACCEPT} disabled={busy} onChange={(e) => void addPhoto(e.target.files?.[0], e.target)} />
          </div>
        </div>
      )}
      {busy && <p role="status">Working…</p>}
      {message && <p className={message.ok ? "notice success" : "notice error"} role="status">{message.text}</p>}
    </section>
  );
}
