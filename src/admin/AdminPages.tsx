import { useState } from "react";
import { supabase } from "../lib/supabase";
import { PAGE_LABELS } from "../content/defaults";
import { useSiteContent } from "../context/SiteContentContext";
import RichText from "../content/RichText";
import { TOKEN_HELP, useContentTokens } from "../content/tokens";
import type { PageKey, SiteContent, SitePage } from "../types";
import ImageEditor from "./ImageEditor";

const EMAIL = /^[^@ ]+@[^@ ]+[.][^@ ]+$/;

function PageEditor({ page, content, reload }: { page: SitePage; content: SiteContent; reload: () => Promise<void> }) {
  const tokens = useContentTokens();
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [alt, setAlt] = useState(page.imageAlt);
  const [email, setEmail] = useState(content.contactEmail);
  const [phone, setPhone] = useState(content.contactPhone);
  const [hours, setHours] = useState(content.contactHours);
  const [address, setAddress] = useState(content.contactAddress);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const isContact = page.key === "contact";

  async function persistImage(path: string | null, newAlt: string): Promise<string | null> {
    if (!supabase) return "Not connected.";
    const res = await supabase.from("site_pages").update({ image_path: path, image_alt: newAlt }).eq("key", page.key).select("key");
    if (res.error) return res.error.message;
    if (!res.data || res.data.length === 0) return "No permission to change this.";
    if (path === null) setAlt("");
    await reload();
    return null;
  }

  async function save() {
    if (!supabase) return;
    const e: Record<string, string> = {};
    if (!title.trim() || title.length > 80) e.title = "Enter a title of up to 80 characters.";
    if (body.length > 8000) e.body = "The text is too long (the limit is 8,000 characters).";
    if (page.imagePath && !alt.trim()) e.alt = "Describe the picture.";
    if (isContact) {
      if (!EMAIL.test(email.trim()) || email.length > 254) e.email = "Enter a valid email address.";
      if (phone.length > 40) e.phone = "Keep the phone number to 40 characters.";
      if (hours.length > 100) e.hours = "Keep the opening hours to 100 characters.";
      if (address.length > 300) e.address = "Keep the address to 300 characters.";
    }
    setErrors(e);
    setMessage(null);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    const pageRes = await supabase.from("site_pages")
      .update({ title: title.trim(), body, image_alt: page.imagePath ? alt.trim() : "" })
      .eq("key", page.key).select("key");
    let problem = "";
    if (pageRes.error) problem = pageRes.error.message;
    else if (!pageRes.data || pageRes.data.length === 0) problem = "No permission to change this page.";

    if (!problem && isContact) {
      const cRes = await supabase.from("site_content")
        .update({ contact_email: email.trim(), contact_phone: phone.trim(), contact_hours: hours.trim(), contact_address: address.trim() })
        .eq("id", true).select("id");
      if (cRes.error) problem = cRes.error.message;
      else if (!cRes.data || cRes.data.length === 0) problem = "No permission to change the contact details.";
    }
    setSaving(false);
    if (problem) setMessage({ ok: false, text: `Not saved: ${problem}` });
    else { setMessage({ ok: true, text: "Saved." }); await reload(); }
  }

  const err = (k: string) => (errors[k] ? <p className="field-error">{errors[k]}</p> : null);

  return (
    <>
      <fieldset>
        <legend>{PAGE_LABELS[page.key]} page text</legend>
        <div className="field">
          <label htmlFor="page-title">Page title</label>
          <input id="page-title" value={title} maxLength={80} aria-invalid={errors.title ? true : undefined} onChange={(e) => setTitle(e.target.value)} />
          {err("title")}
        </div>
        <div className="field">
          <label htmlFor="page-body">Text</label>
          <p className="hint" id="page-body-hint">
            Plain text only. Start a line with <code>## </code> for a heading and with <code>- </code> for a bullet point.
            Leave a blank line between paragraphs. Anything else you type (including HTML) is shown exactly as typed.
          </p>
          <textarea id="page-body" rows={14} value={body} aria-describedby="page-body-hint" aria-invalid={errors.body ? true : undefined} onChange={(e) => setBody(e.target.value)} />
          {err("body")}
        </div>
        <details className="token-help">
          <summary>Words that fill themselves in</summary>
          <p className="muted">Type these exactly. The website swaps in the current value.</p>
          <ul>{TOKEN_HELP.map((t) => <li key={t.token}><code>{t.token}</code>: {t.meaning}</li>)}</ul>
        </details>
      </fieldset>

      {isContact && (
        <fieldset>
          <legend>Contact details</legend>
          <div className="field"><label htmlFor="c-email">Email</label><input id="c-email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={errors.email ? true : undefined} />{err("email")}</div>
          <div className="field"><label htmlFor="c-phone">Phone</label><input id="c-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />{err("phone")}</div>
          <div className="field"><label htmlFor="c-hours">Opening hours</label><input id="c-hours" value={hours} onChange={(e) => setHours(e.target.value)} />{err("hours")}</div>
          <div className="field"><label htmlFor="c-address">Address (one line per row)</label><textarea id="c-address" rows={4} value={address} onChange={(e) => setAddress(e.target.value)} />{err("address")}</div>
        </fieldset>
      )}

      <fieldset>
        <legend>Picture at the top of the page (optional)</legend>
        {err("alt")}
        <ImageEditor label="Page picture" folder={`pages/${page.key}`} path={page.imagePath} alt={alt} onAltChange={setAlt} persist={persistImage} />
      </fieldset>

      <button type="button" className="button" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save text"}</button>
      {message && <p className={message.ok ? "notice success" : "notice error"} role="status">{message.text}</p>}

      <h2>Preview of the text</h2>
      <div className="preview-box prose"><RichText text={body} tokens={tokens} /></div>
    </>
  );
}

export default function AdminPages() {
  const { status, errorMessage, pages, content, reload } = useSiteContent();
  const [key, setKey] = useState<PageKey>("about");

  if (status === "loading") return <p role="status">Loading…</p>;
  if (status === "unavailable") {
    return (
      <div className="notice error" role="alert">
        <p><strong>The editable-content tables are not available yet.</strong></p>
        <p>Run <code>supabase/004_storefront_content.sql</code> in the Supabase SQL Editor (see SETUP.md), then reload this page.</p>
        {errorMessage && <p className="muted">Technical detail: {errorMessage}</p>}
      </div>
    );
  }
  return (
    <>
      <h1>Pages</h1>
      <div className="field">
        <label htmlFor="page-pick">Page to edit</label>
        <select id="page-pick" value={key} onChange={(e) => setKey(e.target.value as PageKey)}>
          {(Object.keys(PAGE_LABELS) as PageKey[]).map((k) => <option key={k} value={k}>{PAGE_LABELS[k]}</option>)}
        </select>
      </div>
      {/* key={key} gives each page a fresh form, so text never carries over between pages */}
      <PageEditor key={key} page={pages[key]} content={content} reload={reload} />
    </>
  );
}
