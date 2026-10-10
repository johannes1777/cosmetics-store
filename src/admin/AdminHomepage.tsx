import { useState } from "react";
import { supabase } from "../lib/supabase";
import { isSafeLink, LINK_HELP } from "../lib/links";
import { SECTION_LABELS } from "../content/defaults";
import { useSiteContent } from "../context/SiteContentContext";
import type { HomeSection, SiteContent } from "../types";
import ImageEditor from "./ImageEditor";

function HeroEditor({ content, reload }: { content: SiteContent; reload: () => Promise<void> }) {
  const [headline, setHeadline] = useState(content.heroHeadline);
  const [text, setText] = useState(content.heroText);
  const [label, setLabel] = useState(content.heroButtonLabel);
  const [link, setLink] = useState(content.heroButtonLink);
  const [alt, setAlt] = useState(content.heroImageAlt);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function persistImage(path: string | null, newAlt: string): Promise<string | null> {
    if (!supabase) return "Not connected.";
    const res = await supabase.from("site_content").update({ hero_image_path: path, hero_image_alt: newAlt }).eq("id", true).select("id");
    if (res.error) return res.error.message;
    if (!res.data || res.data.length === 0) return "No permission to change this.";
    if (path === null) setAlt("");
    await reload();
    return null;
  }

  async function save() {
    if (!supabase) return;
    const e: Record<string, string> = {};
    if (!headline.trim() || headline.length > 120) e.headline = "Enter a headline of up to 120 characters.";
    if (text.length > 400) e.text = "Keep the supporting text to 400 characters or fewer.";
    if (!label.trim() || label.length > 40) e.label = "Enter a button label of up to 40 characters.";
    if (!isSafeLink(link.trim())) e.link = LINK_HELP;
    if (content.heroImagePath && !alt.trim()) e.alt = "Describe the banner picture.";
    setErrors(e);
    setMessage(null);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    const res = await supabase.from("site_content").update({
      hero_headline: headline.trim(), hero_text: text.trim(), hero_button_label: label.trim(),
      hero_button_link: link.trim(), hero_image_alt: content.heroImagePath ? alt.trim() : "",
    }).eq("id", true).select("id");
    setSaving(false);
    if (res.error) setMessage({ ok: false, text: `Not saved: ${res.error.message}` });
    else if (!res.data || res.data.length === 0) setMessage({ ok: false, text: "Not saved. You may not have permission." });
    else { setMessage({ ok: true, text: "Homepage banner saved." }); await reload(); }
  }

  return (
    <fieldset>
      <legend>Hero banner</legend>
      <div className="field">
        <label htmlFor="hero-headline">Headline</label>
        <input id="hero-headline" value={headline} maxLength={120} aria-invalid={errors.headline ? true : undefined} onChange={(e) => setHeadline(e.target.value)} />
        {errors.headline && <p className="field-error">{errors.headline}</p>}
      </div>
      <div className="field">
        <label htmlFor="hero-text">Supporting text</label>
        <p className="hint">Plain text only. You can type {"{{brand_name}}"} to insert your shop name.</p>
        <textarea id="hero-text" rows={3} value={text} maxLength={400} aria-invalid={errors.text ? true : undefined} onChange={(e) => setText(e.target.value)} />
        {errors.text && <p className="field-error">{errors.text}</p>}
      </div>
      <div className="field">
        <label htmlFor="hero-label">Button label</label>
        <input id="hero-label" value={label} maxLength={40} aria-invalid={errors.label ? true : undefined} onChange={(e) => setLabel(e.target.value)} />
        {errors.label && <p className="field-error">{errors.label}</p>}
      </div>
      <div className="field">
        <label htmlFor="hero-link">Button link</label>
        <p className="hint" id="hero-link-hint">Examples: /shop, /shop?category=lips, https://example.com</p>
        <input id="hero-link" value={link} maxLength={300} aria-invalid={errors.link ? true : undefined} aria-describedby="hero-link-hint" onChange={(e) => setLink(e.target.value)} />
        {errors.link && <p className="field-error">{errors.link}</p>}
      </div>
      {errors.alt && <p className="field-error">{errors.alt}</p>}
      <ImageEditor label="Banner picture (shown large beside the headline)" folder="hero" path={content.heroImagePath} alt={alt} onAltChange={setAlt} persist={persistImage} />
      <button type="button" className="button" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save banner text"}</button>
      {message && <p className={message.ok ? "notice success" : "notice error"} role="status">{message.text}</p>}
    </fieldset>
  );
}

function SectionsEditor({ initial, reload }: { initial: HomeSection[]; reload: () => Promise<void> }) {
  const [list, setList] = useState<HomeSection[]>(() => [...initial].sort((a, b) => a.position - b.position || a.key.localeCompare(b.key)));
  const [announce, setAnnounce] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    setList(next);
    setAnnounce(`${SECTION_LABELS[next[target].key]} moved to position ${target + 1} of ${next.length}.`);
  }

  async function save() {
    if (!supabase) return;
    setSaving(true);
    setMessage(null);
    // One request saves every row together, so the order can never end up half-changed.
    const rows = list.map((s, i) => ({ key: s.key, visible: s.visible, position: i + 1 }));
    const res = await supabase.from("home_sections").upsert(rows, { onConflict: "key" }).select("key");
    setSaving(false);
    if (res.error) setMessage({ ok: false, text: `Not saved: ${res.error.message}` });
    else if (!res.data || res.data.length !== rows.length) setMessage({ ok: false, text: "Not saved. You may not have permission." });
    else { setMessage({ ok: true, text: "Section order and visibility saved." }); await reload(); }
  }

  return (
    <fieldset>
      <legend>Homepage sections</legend>
      <p className="hint">Choose which sections appear and their order, top to bottom.</p>
      <ol className="section-list">
        {list.map((s, i) => (
          <li key={s.key}>
            <span className="section-name">{SECTION_LABELS[s.key] ?? s.key}</span>
            <label className="check">
              <input type="checkbox" checked={s.visible} onChange={(e) => setList((l) => l.map((x) => (x.key === s.key ? { ...x, visible: e.target.checked } : x)))} />
              Show
              <span className="visually-hidden"> {SECTION_LABELS[s.key]}</span>
            </label>
            <button type="button" className="button button-quiet" disabled={i === 0} onClick={() => move(i, -1)}>
              Up<span className="visually-hidden"> {SECTION_LABELS[s.key]}</span>
            </button>
            <button type="button" className="button button-quiet" disabled={i === list.length - 1} onClick={() => move(i, 1)}>
              Down<span className="visually-hidden"> {SECTION_LABELS[s.key]}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="visually-hidden" role="status">{announce}</p>
      <button type="button" className="button" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save sections"}</button>
      {message && <p className={message.ok ? "notice success" : "notice error"} role="status">{message.text}</p>}
    </fieldset>
  );
}

export default function AdminHomepage() {
  const { status, errorMessage, content, sections, reload } = useSiteContent();

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
      <h1>Homepage</h1>
      <p className="muted">Change the words, pictures and order. The page layout itself stays the same.</p>
      <HeroEditor content={content} reload={reload} />
      <SectionsEditor initial={sections} reload={reload} />
    </>
  );
}
