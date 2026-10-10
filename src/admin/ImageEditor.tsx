import { useId, useRef, useState } from "react";
import { IMAGE_ACCEPT, deleteImage, publicImageUrl, uploadImage } from "../lib/storage";

type Props = {
  label: string;
  folder: string; // where in the bucket to store it, e.g. "hero"
  path: string | null; // the current picture, if any
  alt: string; // the picture description (required for screen readers)
  onAltChange: (value: string) => void;
  // Saves the new picture reference in the database. Returns an error message, or null if it worked.
  persist: (path: string | null, alt: string) => Promise<string | null>;
};

// Upload / replace / remove one picture. The order of steps keeps things safe:
//   1. upload the NEW file   2. save it in the database   3. only then delete the OLD file.
// If step 2 fails, the new file is deleted again, so nothing is left half-done.
export default function ImageEditor({ label, folder, path, alt, onAltChange, persist }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const altId = useId();
  const fileId = useId();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const resetFile = () => { if (fileRef.current) fileRef.current.value = ""; };

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!alt.trim()) {
      setMessage({ ok: false, text: "Please describe the picture first (for people who cannot see it), then choose the file again." });
      resetFile();
      return;
    }
    setBusy(true);
    setMessage(null);
    const oldPath = path;
    const up = await uploadImage(folder, file);
    if ("error" in up) {
      setBusy(false);
      resetFile();
      setMessage({ ok: false, text: up.error });
      return;
    }
    const err = await persist(up.path, alt.trim());
    if (err) {
      await deleteImage(up.path); // undo the upload
      setMessage({ ok: false, text: `The picture was not saved: ${err}` });
    } else {
      const cleaned = oldPath ? await deleteImage(oldPath) : true;
      setMessage({ ok: true, text: cleaned ? "Picture saved." : "Picture saved. (The old file could not be deleted, which is harmless.)" });
    }
    setBusy(false);
    resetFile();
  }

  async function onRemove() {
    if (!path || !window.confirm("Remove this picture?")) return;
    setBusy(true);
    setMessage(null);
    const err = await persist(null, "");
    if (err) {
      setMessage({ ok: false, text: `Could not remove it: ${err}` });
    } else {
      await deleteImage(path);
      setMessage({ ok: true, text: "Picture removed." });
    }
    setBusy(false);
  }

  return (
    <div className="image-editor">
      <p className="image-editor-label">{label}</p>
      {path ? (
        <img className="image-preview" src={publicImageUrl(path)} alt={alt || "Current picture"} />
      ) : (
        <p className="muted">No picture yet.</p>
      )}
      <div className="field">
        <label htmlFor={altId}>Picture description (required)</label>
        <p className="hint">Describe what the picture shows, in a short sentence. It is read aloud to people who cannot see it.</p>
        <input id={altId} value={alt} maxLength={200} onChange={(e) => onAltChange(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={fileId}>{path ? "Replace with a new picture" : "Choose a picture to upload"}</label>
        <p className="hint">JPEG, PNG or WebP, up to 5 MB.</p>
        <input id={fileId} ref={fileRef} type="file" accept={IMAGE_ACCEPT} disabled={busy} onChange={(e) => void onFile(e.target.files?.[0])} />
      </div>
      {path && <button type="button" className="link-button" disabled={busy} onClick={() => void onRemove()}>Remove picture</button>}
      {busy && <p role="status">Working…</p>}
      {message && <p className={message.ok ? "notice success" : "notice error"} role="status">{message.text}</p>}
    </div>
  );
}
