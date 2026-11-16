import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { api } from "../../lib/api";
import { ago } from "../../lib/format";
import { Button, Field, Icon, Switch, fail, toast } from "../../ui/kit";
import { ImageField } from "./Sections";

export const SOCIAL_LABELS = { email: "Email", github: "GitHub", linkedin: "LinkedIn", x: "X / Twitter", instagram: "Instagram", youtube: "YouTube", dribbble: "Dribbble", website: "Other website", resume: "Résumé link" };

export function Details({ draft, edit, slug, onSlug, s, unpublish, resetAll, langs }) {
  const [addr, setAddr] = useState(slug || "");
  const [addrErr, setAddrErr] = useState("");
  const [busy, setBusy] = useState(false);
  const p = draft.profile, seo = draft.seo;
  const saveSlug = async () => {
    setAddrErr("");
    if (!/^[a-z0-9][a-z0-9-]{1,38}$/.test(addr)) return setAddrErr("Use 2–39 lowercase letters, numbers or dashes.");
    setBusy(true);
    try { await api("/api/portfolio/settings", { method: "PUT", json: { slug: addr } }); onSlug(addr); toast("Address saved"); }
    catch (e) { e.field ? setAddrErr(e.message) : fail(e); }
    setBusy(false);
  };
  return <>
    <h4 className="dr-sub" style={{ marginTop: 4 }}>Website address</h4>
    <Field error={addrErr} hint="Your site's public link. Changing it breaks links you've already shared.">
      <div className="wb-addr"><span>{location.host}/p/</span><input className="input" value={addr} onChange={e => setAddr(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
        <Button size="sm" busy={busy} disabled={addr === slug} onClick={saveSlug}>Save</Button></div>
    </Field>
    <div className="wb-pubstate">
      {s.online ? <><span className="wb-dot live" /><span className="grow">Live · published {ago(s.published_at)}</span>
        <Button size="sm" variant="ghost" className="btn-danger" onClick={unpublish}>Unpublish</Button></>
        : <><span className="wb-dot" /><span className="grow help">Not published. Visitors see “not found”.</span></>}
    </div>

    <h4 className="dr-sub">You</h4>
    <Field label="Name shown on the site"><input className="input" value={p.name} maxLength={80} onChange={e => edit(d => { d.profile.name = e.target.value; })} /></Field>
    <div className="wb-socials">
      {Object.entries(SOCIAL_LABELS).map(([k, l]) => (
        <Field key={k} label={l}><input className="input" value={p.socials[k] || ""} placeholder={k === "email" ? "you@example.com" : "https://…"}
          onChange={e => edit(d => { d.profile.socials[k] = e.target.value; })} /></Field>))}
    </div>

    <h4 className="dr-sub">Search & sharing</h4>
    <SeoScore draft={draft} slug={slug} online={s.online} />
    <Field label="Page title" hint={`${(seo.title || "").length}/60 · shown in Google and browser tabs`} style={{ marginTop: 14 }}><input className="input" value={seo.title} maxLength={90} onChange={e => edit(d => { d.seo.title = e.target.value; })} /></Field>
    <Field label="Description" hint={`${(seo.description || "").length}/160 · shown under the title in search results`} style={{ marginTop: 12 }}>
      <textarea className="textarea" rows={3} maxLength={300} value={seo.description} onChange={e => edit(d => { d.seo.description = e.target.value; })} /></Field>
    <div className="wb-serp"><small>{location.host} › p › {slug || "your-name"}</small><b>{seo.title || p.name}</b><span>{seo.description}</span></div>
    <div style={{ marginTop: 12 }}><ImageField label="Share image (shown when your link is posted on LinkedIn, WhatsApp, X…)" value={seo.image || ""} onChange={v => edit(d => { d.seo.image = v; })} /></div>
    <SocialCard seo={seo} name={p.name} draft={draft} />
    <div className="row-2" style={{ marginTop: 12 }}>
      <Field label="Language"><select className="select" value={seo.lang || "en"} onChange={e => edit(d => { d.seo.lang = e.target.value; })}>
        {Object.entries(langs).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Tab icon" opt="(an emoji)"><input className="input" style={{ fontSize: 18, textAlign: "center" }} value={seo.favicon} maxLength={4} onChange={e => edit(d => { d.seo.favicon = e.target.value; })} /></Field>
    </div>
    <div className="wb-switch" style={{ marginTop: 14 }}><Switch checked={seo.index !== false} onChange={v => edit(d => { d.seo.index = v; })}>Show my site in Google and other search engines</Switch></div>
    <Field label="Google Search Console verification" opt="(optional)" style={{ marginTop: 12 }}
      hint={<>In <a href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer">Search Console</a> add your site URL, choose “HTML tag” and paste it here. Then publish.</>}>
      <input className="input" value={seo.google || ""} placeholder='<meta name="google-site-verification" content="…">' onChange={e => edit(d => { d.seo.google = e.target.value; })} /></Field>

    <h4 className="dr-sub">More</h4>
    <div className="wb-more">
      <Button size="sm" variant="ghost" className="btn-danger" icon="refresh" onClick={resetAll}>Start over</Button>
    </div>
  </>;
}

export function seoChecks(draft, slug, online) {
  const { seo, profile, sections } = draft;
  const on = sections.filter(x => x.on);
  const hero = on.find(x => x.type === "hero");
  const words = on.map(x => [x.data.text, x.data.subtitle, ...(x.data.items || []).map(i => Object.values(i).join(" "))].join(" ")).join(" ").split(/\s+/).filter(Boolean).length;
  const tl = (seo.title || "").length, dl = (seo.description || "").length;
  const imgs = on.filter(x => ["hero", "about"].includes(x.type) && x.data.image).length;
  return [
    [!!slug && online, "Site is published", "Publish so search engines can find it."],
    [seo.index !== false, "Search engines allowed", "Turn on “Show my site in Google”."],
    [tl >= 25 && tl <= 60, "Title is 25–60 characters", `Yours is ${tl}. Aim for “Name · Role”.`],
    [(seo.title || "").toLowerCase().includes((profile.name || "").split(" ")[0].toLowerCase()), "Your name is in the title", "People search for your name: include it."],
    [dl >= 70 && dl <= 160, "Description is 70–160 characters", `Yours is ${dl}. Say what you do and what you're looking for.`],
    [!!hero && !!hero.data.title, "Page has a main headline", "Keep the Intro section on, with a headline."],
    [words >= 150, "Enough text to understand you", `About ${words} words so far. Add an About section with 2–3 short paragraphs.`],
    [!!(seo.image || (hero && hero.data.image)), "Has a share image", "Add a photo or share image so links look good when posted."],
    [Object.entries(profile.socials).filter(([k, v]) => v && k !== "email").length >= 2, "Linked to your profiles", "Add GitHub and LinkedIn. It helps Google connect them to you."],
    [on.some(x => x.type === "contact"), "Has a contact section", "Add one so recruiters can reach you."],
    [imgs > 0 || on.some(x => x.type === "projects"), "Shows your work", "Add a Projects section."],
  ];
}

export function SeoScore({ draft, slug, online }) {
  const checks = seoChecks(draft, slug, online);
  const passed = checks.filter(c => c[0]).length;
  const pct = Math.round(passed / checks.length * 100);
  const tone = pct >= 85 ? "ok" : pct >= 60 ? "warn" : "bad";
  const [open, setOpen] = useState(pct < 100);
  return (
    <div className={`wb-seo ${tone}`}>
      <button type="button" className="wb-seo-head" onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 36 36" className="wb-ring"><circle cx="18" cy="18" r="15.5" /><motion.circle cx="18" cy="18" r="15.5" initial={false} animate={{ strokeDasharray: `${pct * .974} 100` }} /></svg>
        <span className="grow"><b>SEO score {pct}</b><small>{passed} of {checks.length} checks passed</small></span>
        <Icon name="chevron-down" className={`wb-caret ${open ? "up" : ""}`} />
      </button>
      <AnimatePresence initial={false}>{open && (
        <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
          {checks.map(([ok, label, tip]) => <li key={label} className={ok ? "ok" : ""}><span className="wb-chk">{ok ? <Icon name="check" /> : <Icon name="x" />}</span><span><b>{label}</b>{!ok && <small>{tip}</small>}</span></li>)}
        </motion.ul>)}</AnimatePresence>
    </div>
  );
}

export function SocialCard({ seo, name, draft }) {
  const hero = draft.sections.find(x => x.type === "hero" && x.on);
  const img = seo.image || hero?.data.image;
  return (
    <div className="wb-og">
      <small className="help">Link preview</small>
      <div className="wb-og-card">
        {img ? <img src={img} alt="" /> : <div className="wb-og-ph" style={{ background: `linear-gradient(135deg, ${draft.theme.accent}, ${draft.theme.accent2})` }}>{name}</div>}
        <div><small>{location.host}</small><b>{seo.title || name}</b><span>{seo.description}</span></div>
      </div>
    </div>
  );
}
