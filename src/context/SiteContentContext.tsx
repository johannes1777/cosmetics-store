import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { HomeSection, PageKey, SectionKey, SiteContent, SitePage } from "../types";
import { defaultContent, defaultPages, defaultSections } from "../content/defaults";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

// "unavailable" means the tables are missing (004 not applied yet) or could not be read.
// The shop then shows the built-in starter text, so it never breaks.
type Status = "loading" | "ready" | "unavailable";

type Value = {
  status: Status;
  errorMessage: string;
  content: SiteContent;
  pages: Record<PageKey, SitePage>;
  sections: HomeSection[];
  reload: () => Promise<void>;
};

const Ctx = createContext<Value | null>(null);

type ContentRow = {
  hero_headline: string; hero_text: string; hero_button_label: string; hero_button_link: string;
  hero_image_path: string | null; hero_image_alt: string;
  contact_email: string; contact_phone: string; contact_hours: string; contact_address: string;
};
type PageRow = { key: PageKey; title: string; body: string; image_path: string | null; image_alt: string };
type SectionRow = { key: SectionKey; visible: boolean; position: number };

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>(isSupabaseConfigured ? "loading" : "unavailable");
  const [errorMessage, setErrorMessage] = useState("");
  const [content, setContent] = useState<SiteContent>(defaultContent);
  const [pages, setPages] = useState<Record<PageKey, SitePage>>(defaultPages);
  const [sections, setSections] = useState<HomeSection[]>(defaultSections);

  const reload = useCallback(async () => {
    if (!supabase) return;
    const [c, p, s] = await Promise.all([
      supabase.from("site_content").select("*").eq("id", true).single(),
      supabase.from("site_pages").select("*"),
      supabase.from("home_sections").select("*").order("position"),
    ]);
    const err = c.error ?? p.error ?? s.error;
    if (err) {
      setErrorMessage(err.message);
      setStatus("unavailable");
      return;
    }
    const row = c.data as unknown as ContentRow;
    setContent({
      heroHeadline: row.hero_headline, heroText: row.hero_text,
      heroButtonLabel: row.hero_button_label, heroButtonLink: row.hero_button_link,
      heroImagePath: row.hero_image_path, heroImageAlt: row.hero_image_alt,
      contactEmail: row.contact_email, contactPhone: row.contact_phone,
      contactHours: row.contact_hours, contactAddress: row.contact_address,
    });
    const merged = { ...defaultPages };
    for (const pr of (p.data ?? []) as unknown as PageRow[]) {
      merged[pr.key] = { key: pr.key, title: pr.title, body: pr.body, imagePath: pr.image_path, imageAlt: pr.image_alt };
    }
    setPages(merged);
    const sectionRows = (s.data ?? []) as unknown as SectionRow[];
    setSections(sectionRows.length > 0 ? sectionRows.map((r) => ({ key: r.key, visible: r.visible, position: r.position })) : defaultSections);
    setErrorMessage("");
    setStatus("ready");
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const value = useMemo(() => ({ status, errorMessage, content, pages, sections, reload }), [status, errorMessage, content, pages, sections, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSiteContent() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSiteContent must be used inside <SiteContentProvider>");
  return ctx;
}
