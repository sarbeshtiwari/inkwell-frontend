import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { go } from "../lib/router";
import { Alert, Badge, Button, Drawer, DrawerHead, Empty, Field, Icon, Seg, Switch, fail, toast } from "../ui/kit";
import { ResearchButton } from "../ui/research";

const PALETTE = ["#7c5cff", "#1f9d74", "#e0803a", "#2f7fe0", "#d4477d", "#2aa6b8", "#9a7b1d", "#6b7280", "#b4569e", "#3b9c3b"];
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const far = m => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);
const directions = c => `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lon}`;

function LocationPicker({ onFound, busy, area, google, useGoogle, setUseGoogle, onGoogle }) {
  const [f, setF] = useState({ country: "India", city: "", area: "", radius_km: 1 });
  const [manual, setManual] = useState(false);
  const [locating, setLocating] = useState(false);
  const [err, setErr] = useState("");
  const useMine = () => {
    if (!navigator.geolocation) { setManual(true); setErr("This browser can't share your location. Type your city instead."); return; }
    setLocating(true); setErr("");
    navigator.geolocation.getCurrentPosition(
      p => { setLocating(false); onFound({ lat: p.coords.latitude, lon: p.coords.longitude, radius_km: f.radius_km, google: useGoogle }); },
      () => { setLocating(false); setManual(true); setErr("Location wasn't shared. Type your country and city instead."); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
  };
  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }));
  return (
    <div className="card card-pad nb-locate">
      <div className="nb-locate-head">
        <span className="nb-pin"><Icon name="globe" /></span>
        <div>
          <h3>{area ? "Search another place" : "Where should Reachout look?"}</h3>
          <p className="help">Share your location once, or type a city and area. Your position is rounded to about 100 m and only used for this search.</p>
        </div>
      </div>
      <div className="nb-locate-row">
        <Button variant="primary" icon="globe" busy={locating || (busy && !manual)} busyLabel={locating ? "Finding you…" : "Searching…"} onClick={useMine}>Use my location</Button>
        <span className="help">or</span>
        <Button variant="ghost" onClick={() => setManual(m => !m)}>{manual ? "Hide" : "Type a place"}</Button>
        <span className="grow" />
        {google ? <Switch checked={useGoogle} onChange={setUseGoogle}>Include Google Places</Switch>
          : <button type="button" className="link-btn" onClick={onGoogle}>More companies with Google Places</button>}
        {google && <button type="button" className="link-btn" onClick={onGoogle} aria-label="Google Places settings"><Icon name="settings" /></button>}
        <label className="help nb-radius">Within
          <select className="select auto sm" value={f.radius_km} onChange={set("radius_km")}>
            {[0.5, 1, 2, 3, 5].map(r => <option key={r} value={r}>{r} km</option>)}
          </select>
        </label>
      </div>
      {err && <Alert tone="warn">{err}</Alert>}
      {manual && (
        <div className="nb-form">
          <Field label="Country"><input className="input" value={f.country} onChange={set("country")} maxLength={60} /></Field>
          <Field label="City"><input className="input" value={f.city} onChange={set("city")} placeholder="Gurugram" maxLength={80} /></Field>
          <Field label="Area" opt="(optional)"><input className="input" value={f.area} onChange={set("area")} placeholder="Cyber Hub, DLF Cyber City" maxLength={120}
            onKeyDown={e => e.key === "Enter" && onFound({ ...f, google: useGoogle })} /></Field>
          <Button variant="primary" icon="search" busy={busy} busyLabel="Searching…" onClick={() => onFound({ ...f, google: useGoogle })}>Find companies</Button>
        </div>
      )}
    </div>
  );
}

function GoogleDrawer({ open, onClose, has, onSaved }) {
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async value => {
    setBusy(true);
    try { const r = await api("/api/nearby/google-key", { method: "PUT", json: { key: value } }); onSaved(r.google); setKey("");
      toast(value ? "Google Places key saved. It's used on your next search." : "Google Places key removed"); }
    catch (e) { fail(e); }
    setBusy(false);
  };
  return (
    <Drawer open={open} onClose={onClose} label="Google Places">
      <DrawerHead title="Google Places" sub="Adds Google's business listings to OpenStreetMap's, so far more companies show up. Uses your own Google Cloud key." onClose={onClose} />
      <div className="dr-pad ai-drawer">
        {has ? <Alert tone="ok" icon="check">A key is saved. Searches use Google Places and OpenStreetMap together.</Alert>
          : <Alert tone="info">Without a key, Companies near me uses OpenStreetMap only (free, but it lists fewer companies).</Alert>}
        <details className="ai-steps-howto" open={!has}>
          <summary>How to get a Google Places key</summary>
          <ol>
            <li>Open <a className="link" href="https://console.cloud.google.com/projectcreate" target="_blank" rel="noopener noreferrer">Google Cloud console</a> and create a project (name it "Reachout").</li>
            <li>Turn on billing for it. Google asks for a card; each month Google gives a free allowance of Places calls (check the current one on its pricing page).</li>
            <li>Open <a className="link" href="https://console.cloud.google.com/apis/library/places.googleapis.com" target="_blank" rel="noopener noreferrer">Places API (New)</a> and press <b>Enable</b>.</li>
            <li>Go to <a className="link" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer">Credentials</a>, <b>Create credentials → API key</b>. Under <b>API restrictions</b> pick <b>Places API (New)</b> only, then save.</li>
            <li>To avoid surprise bills, set a budget alert under <b>Billing → Budgets &amp; alerts</b>, and a daily cap under <b>Places API → Quotas</b>.</li>
            <li>Copy the key (it starts with <code>AIza</code>), paste it below and press <b>Save</b>.</li>
          </ol>
        </details>
        <Alert tone="warn">Each search makes about 7–20 Google calls (several kinds of company, up to 60 results each). Reachout caps it at 60 Google searches a day per account.</Alert>
        <Field label="API key" hint="Stored encrypted, checked with Google once, never shown again.">
          <div className="ai-key-row">
            <input className="input" type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} placeholder={has ? "Replace the saved key" : "AIza…"} />
            <Button variant="primary" busy={busy} busyLabel="Checking…" disabled={!key.trim()} onClick={() => save(key.trim())}>Save</Button>
            {has && <Button variant="ghost" onClick={() => save("")}>Remove</Button>}
          </div>
        </Field>
        <p className="help">Google receives the area you search (not who you are). Results follow Google's terms: they're shown here for you and not stored beyond your last search.</p>
      </div>
    </Drawer>
  );
}

function CompanyMap({ area, companies, colors, selected, onSelect }) {
  const el = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const marks = useRef({});
  useEffect(() => {
    map.current = L.map(el.current, { zoomControl: true, scrollWheelZoom: false });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => map.current.remove();
  }, []);
  useEffect(() => {
    if (!area) return;
    layer.current.clearLayers(); marks.current = {};
    L.circleMarker([area.lat, area.lon], { radius: 9, color: "#fff", weight: 3, fillColor: "#e5484d", fillOpacity: 1 })
      .bindTooltip("You're searching here", { direction: "top" }).addTo(layer.current);
    const pts = [[area.lat, area.lon]];
    for (const c of companies) {
      const hiring = c.info?.openings > 0;
      const m = L.circleMarker([c.lat, c.lon], { radius: hiring ? 9 : 7, color: hiring ? "#1f9d74" : "#ffffff", weight: hiring ? 3 : 2,
        fillColor: colors[c.type] || "#6b7280", fillOpacity: .9 })
        .bindTooltip(`<b>${c.name.replace(/</g, "&lt;")}</b><br>${c.type} · ${far(c.distance_m)}${hiring ? ` · ${c.info.openings} openings in ${c.info.country || "your country"} or remote` : ""}`, { direction: "top" })
        .on("click", () => onSelect(c.id)).addTo(layer.current);
      marks.current[c.id] = m;
      pts.push([c.lat, c.lon]);
    }
    map.current.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 17 });
  }, [area, companies, colors]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const m = marks.current[selected];
    if (m) { map.current.flyTo(m.getLatLng(), Math.max(map.current.getZoom(), 17), { duration: .6 }); m.openTooltip(); }
  }, [selected]);
  return <div ref={el} className="nb-map" role="region" aria-label="Map of companies" />;
}

function TypeBars({ companies, colors, type, setType }) {
  const counts = useMemo(() => {
    const c = {};
    companies.forEach(x => { c[x.type] = (c[x.type] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [companies]);
  const max = counts[0]?.[1] || 1;
  return (
    <div className="card card-pad nb-types">
      <div className="nb-types-head"><b>Kinds of company</b>{type && <button type="button" className="link-btn" onClick={() => setType("")}>Show all</button>}</div>
      {counts.map(([t, n]) => (
        <button key={t} type="button" className={`nb-bar ${type === t ? "on" : ""}`} onClick={() => setType(type === t ? "" : t)} aria-pressed={type === t}>
          <span className="nb-bar-label"><i style={{ background: colors[t] }} />{t}</span>
          <span className="nb-bar-track"><span style={{ width: `${(n / max) * 100}%`, background: colors[t] }} /></span>
          <span className="nb-bar-n">{n}</span>
        </button>
      ))}
    </div>
  );
}

function CompanyCard({ c, color, selected, onSelect, onCheck, checking, onTrack, onSave }) {
  const i = c.info;
  return (
    <article id={`nb-${c.id}`} className={`card nb-card ${selected ? "on" : ""}`} onClick={() => onSelect(c.id)}>
      <div className="nb-card-top">
        <span className="nb-dot" style={{ background: color }} />
        <div className="grow">
          <h4>{c.name}</h4>
          <span className="help">{c.type} · {far(c.distance_m)}{c.address ? ` · ${c.address}` : ""}</span>
        </div>
        {i?.openings > 0 ? <Badge tone="ok" title={`Open jobs in ${i.country || "your country"} or remote`}>{i.openings} opening{i.openings === 1 ? "" : "s"} for you</Badge>
          : i ? <Badge dot={false}>{i.openings_abroad > 0 ? `Hiring only outside ${i.country || "your country"}` : i.careers ? "No openings listed" : "No careers page found"}</Badge> : null}
      </div>
      {i && <div className="nb-facts">
        {i.careers && <a href={i.careers} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}><Icon name="briefcase" />Careers page</a>}
        {(i.openings > 0 || i.openings_abroad > 0 || i.openings_unknown > 0) && <span className="nb-where-split">
          {i.openings_here > 0 && <span className="nb-here"><Icon name="check" />{i.openings_here} in this city</span>}
          {i.openings_country > 0 && <span className="nb-here"><Icon name="check" />{i.openings_country} elsewhere in {i.country || "your country"}</span>}
          {i.openings_remote > 0 && <span className="nb-here"><Icon name="globe" />{i.openings_remote} remote</span>}
          {i.openings_unknown > 0 && <span className="help">{i.openings_unknown} with no location given</span>}
          {i.openings_abroad > 0 && <span className="help">{i.openings_abroad} abroad (not counted)</span>}
        </span>}
        {i.emails?.map(e => <a key={e} href={`mailto:${e}`} onClick={ev => ev.stopPropagation()}><Icon name="mail" />{e}</a>)}
        {i.note && <span className="help">{i.note}</span>}
      </div>}
      {i?.jobs?.length > 0 && <ul className="nb-jobs">{i.jobs.slice(0, 3).map(j => (
        <li key={j.url + j.title}><a href={j.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>{j.title}</a>{j.location && <span className="help"> · {j.location}</span>}</li>))}</ul>}
      {c.matches?.length > 0 && <p className="help nb-match"><Icon name="sparkles" />In your AI job matches: {c.matches.map(m => m.title).join(", ")}</p>}
      <div className="nb-actions" onClick={e => e.stopPropagation()}>
        <a className="btn btn-sm" href={directions(c)} target="_blank" rel="noopener noreferrer"><Icon name="external" />Directions</a>
        {c.website && <a className="btn btn-sm btn-ghost" href={c.website} target="_blank" rel="noopener noreferrer"><Icon name="globe" />{host(c.website)}</a>}
        <span className="grow" />
        {!i && <Button size="sm" icon="search" busy={checking} onClick={() => onCheck([c.id])}>Check</Button>}
        {i?.emails?.length > 0 && <Button size="sm" variant="ghost" icon="plus" onClick={() => onSave(c)}>Save as contact</Button>}
        <ResearchButton name={c.name} website={c.website} jobs={(i?.jobs || []).slice(0, 6)} />
        {i?.careers && <Button size="sm" variant="ghost" icon="star" onClick={() => onTrack(c)} title="Read this company's jobs in every AI job match search">Track</Button>}
      </div>
    </article>
  );
}

export default function Nearby() {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState("");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [show, setShow] = useState("all");
  const [sort, setSort] = useState("near");
  const [selected, setSelected] = useState(null);
  const [useGoogle, setUseGoogle] = useState(true);
  const [gOpen, setGOpen] = useState(false);
  const timer = useRef(null);
  const load = async () => {
    try {
      const r = await api("/api/nearby");
      setD(r);
      clearTimeout(timer.current);
      if (r.checking?.state === "running") timer.current = setTimeout(load, 2500);
    } catch (e) { fail(e); }
  };
  useEffect(() => { load(); return () => clearTimeout(timer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const search = async body => {
    setBusy("search");
    try { const r = await api("/api/nearby/search", { json: body }); setD(r); setType(""); setSelected(null);
      if (r.note) toast(r.note, true);
      toast(r.companies.length ? `Found ${r.companies.length} companies around ${r.area.label}` : "No companies are mapped around there yet. Try a bigger radius."); }
    catch (e) { fail(e); }
    setBusy("");
  };
  const check = async ids => {
    try { await api("/api/nearby/check", { json: { ids } }); toast(`Checking ${ids.length} compan${ids.length === 1 ? "y" : "ies"}… this takes a few seconds each.`); load(); }
    catch (e) { fail(e); }
  };
  const track = async c => {
    try { const r = await api(`/api/nearby/track/${encodeURIComponent(c.id)}`, { json: {} }); toast(`${r.added.name} added to My companies in AI job match`); }
    catch (e) { fail(e); }
  };
  const save = async c => {
    try {
      const r = await api("/api/finder/save", { json: { list: "Companies near me", items: c.info.emails.map(email => ({ email, company: c.name, website: c.website || c.info.careers })) } });
      toast(r.added ? `Saved ${r.added} contact${r.added === 1 ? "" : "s"} to the "Companies near me" list` : "Already in your contacts");
    } catch (e) { fail(e); }
  };

  const companies = d?.companies || [];
  const colors = useMemo(() => Object.fromEntries((d?.types || []).map((t, i) => [t, PALETTE[i % PALETTE.length]])), [d?.types]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    let rows = companies.filter(c => (!type || c.type === type) && (!s || c.name.toLowerCase().includes(s))
      && (show === "all" || (show === "hiring" && c.info?.openings > 0) || (show === "email" && c.info?.emails?.length > 0) || (show === "unchecked" && !c.info)));
    rows = [...rows].sort((a, b) => sort === "open" ? (b.info?.openings || 0) - (a.info?.openings || 0) : sort === "name" ? a.name.localeCompare(b.name) : a.distance_m - b.distance_m);
    return rows;
  }, [companies, q, type, show, sort]);
  const checking = d?.checking?.state === "running";
  const checked = companies.filter(c => c.info).length;
  const hiring = companies.filter(c => c.info?.openings > 0).length;
  const withEmail = companies.filter(c => c.info?.emails?.length > 0).length;
  const select = id => { setSelected(id); document.getElementById(`nb-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }); };

  return (
    <div className="nb-page">
      <LocationPicker onFound={search} busy={busy === "search"} area={d?.area} google={d?.google} useGoogle={useGoogle} setUseGoogle={setUseGoogle} onGoogle={() => setGOpen(true)} />
      <GoogleDrawer open={gOpen} onClose={() => setGOpen(false)} has={d?.google} onSaved={g => setD(x => ({ ...(x || {}), google: g }))} />
      {d?.area && <>
        <div className="nb-stats">
          {[["Companies", companies.length, "briefcase"], ["Checked", checked, "check"], ["Hiring", hiring, "trend"], ["With HR email", withEmail, "mail"]].map(([l, n, ic]) => (
            <div key={l} className="card nb-stat"><Icon name={ic} /><b>{n}</b><span className="help">{l}</span></div>))}
          <div className="card nb-stat nb-where"><Icon name="globe" /><b>{d.area.label}</b><span className="help">within {d.radius_km} km · {d.sources?.google ? `${d.sources.google} from Google, ${d.sources.osm} from OpenStreetMap` : "OpenStreetMap"}</span></div>
        </div>
        {checking && <Alert tone="info" icon="sparkles">Checking {d.checking.done} of {d.checking.total}{d.checking.current ? `: ${d.checking.current}` : ""}</Alert>}
        <div className="nb-main">
          <div className="nb-left">
            <CompanyMap area={d.area} companies={shown} colors={colors} selected={selected} onSelect={select} />
            {companies.length > 0 && <TypeBars companies={companies} colors={colors} type={type} setType={setType} />}
            <p className="help nb-legend"><span className="nb-dot" style={{ background: "#e5484d" }} /> where you searched · a green ring means it has openings in your country or remote · map data © OpenStreetMap contributors{d.sources?.google ? " · listings also from Google" : ""}</p>
          </div>
          <div className="nb-right">
            <div className="nb-filters">
              <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Search companies" aria-label="Search companies" />
              <select className="select auto" value={type} onChange={e => setType(e.target.value)} aria-label="Kind of company">
                <option value="">All kinds</option>{(d.types || []).map(t => <option key={t}>{t}</option>)}
              </select>
              <select className="select auto" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">
                <option value="near">Nearest</option><option value="open">Most openings</option><option value="name">Name</option>
              </select>
            </div>
            <div className="nb-filters">
              <Seg value={show} onChange={setShow} size="sm" options={[["all", "All"], ["hiring", "Hiring for you"], ["email", "HR email"], ["unchecked", "Not checked"]]} />
              <span className="grow" />
              <Button size="sm" variant="primary" icon="search" busy={checking} busyLabel="Checking…" disabled={!shown.some(c => !c.info)}
                onClick={() => check(shown.filter(c => !c.info).slice(0, 40).map(c => c.id))}
                title="Find each company's careers page, open jobs and published HR email">Check {Math.min(shown.filter(c => !c.info).length, 40) || ""} shown</Button>
            </div>
            {!companies.length ? <Empty icon="globe" title="No companies mapped here yet">OpenStreetMap has few offices tagged around this spot. Try a bigger radius or a nearby business district.</Empty>
              : !shown.length ? <Empty icon="filter" title="Nothing matches these filters" />
              : <div className="nb-list">{shown.map(c => <CompanyCard key={c.id} c={c} color={colors[c.type]} selected={selected === c.id} onSelect={setSelected}
                onCheck={check} checking={checking} onTrack={track} onSave={save} />)}</div>}
            {d.hiring_in_city?.length > 0 && <div className="card card-pad nb-also">
              <b>Also hiring in {d.area.city} (from your AI job matches)</b>
              <ul>{d.hiring_in_city.map(h => <li key={h.company}><b>{h.company}</b>: {h.jobs.map((j, k) => <span key={k}>{k ? ", " : ""}<a href={j.url} target="_blank" rel="noopener noreferrer">{j.title}</a></span>)}</li>)}</ul>
              <button type="button" className="link-btn" onClick={() => go("ai-jobs")}>Open AI job match</button>
            </div>}
          </div>
        </div>
      </>}
    </div>
  );
}
