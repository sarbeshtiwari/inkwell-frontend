import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Alert, Badge, Button, Drawer, DrawerHead, Empty, Icon, Spinner, fail } from "./kit";

const STATUS = { found: ["ok", "Found"], partial: ["brand", "Partial"], not_found: ["", "Nothing found"], failed: ["bad", "Failed"],
  researching: ["warn", "Researching…"], pending: ["", "Not researched"] };
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const isUrl = v => /^https?:\/\//.test(v || "");

let open = () => {};
// Anywhere in the app: researchCompany({name, website?, jobs?}) opens the research drawer for that company.
export const researchCompany = company => open(company);

export function ResearchButton({ name, website = "", jobs = [], size = "sm", variant = "ghost" }) {
  return <Button size={size} variant={variant} icon="search" title="Who runs it, how big it is, its careers page and public hiring email, each with a source"
    onClick={e => { e.stopPropagation(); researchCompany({ name, website, jobs }); }}>Research</Button>;
}

export function ResearchHost() {
  const [co, setCo] = useState(null);
  const [d, setD] = useState(null);
  open = c => { setCo(c); setD(null); };
  const load = () => api("/api/research/companies").then(setD).catch(fail);
  useEffect(() => { if (co) load(); }, [co]);
  const row = d && co ? d.companies.find(x => x.name.toLowerCase() === co.name.toLowerCase()) : null;
  useEffect(() => { if (row?.status === "researching") { const t = setTimeout(load, 4000); return () => clearTimeout(t); } }, [row?.status, row?.updated]);
  const start = async retry => {
    try { await api("/api/research/companies", { json: { name: co.name, website: co.website || row?.website || "", jobs: co.jobs || [], retry } }); load(); }
    catch (e) { fail(e); }
  };
  const [tone, label] = STATUS[row?.status || "pending"];
  const fields = d?.fields || [];
  const data = row?.data || {};
  return (
    <Drawer open={!!co} onClose={() => setCo(null)} label="Company research">
      <DrawerHead title={co?.name || ""} sub="Company research · every fact has its source" onClose={() => setCo(null)} />
      <div className="dr-pad rs">
        {!d ? <Spinner /> : <>
          <div className="rs-top"><Badge tone={tone}>{label}</Badge><span className="grow" />
            {row?.status === "researching" ? <Button size="sm" busy busyLabel="Researching" /> :
              <Button size="sm" variant={row ? "ghost" : "primary"} icon={row ? "refresh" : "search"} onClick={() => start(row?.status === "failed")}>{row ? "Research again" : "Research this company"}</Button>}</div>
          {!row && <Empty icon="search" title="Not researched yet">Reachout looks up the company's website, careers page, public hiring email and phone, CEO, CTO, size, industry and location. With Claude Code on your Mac it searches the web; otherwise it reads the company's own site. Each fact is kept only if its source page really shows it.</Empty>}
          {row?.status === "researching" && <p className="help">This takes a minute or two. You can close this and come back.</p>}
          {row?.error && <Alert tone="bad">{row.error}</Alert>}
          {typeof data.identity === "string" && <Alert tone="warn">{data.identity}</Alert>}
          {data.notes && <p className="help">{data.notes}</p>}
          {Object.keys(data.fields || {}).length > 0 && <dl className="rs-fields">{fields.filter(f => data.fields[f.key]).map(f => (
            <div key={f.key} className="rs-field"><dt>{f.label}</dt><dd>{data.fields[f.key].map((v, i) => (
              <div key={i} className="rs-val">
                {isUrl(v.value) ? <a href={v.value} target="_blank" rel="noopener noreferrer">{host(v.value)}<Icon name="external" /></a>
                  : f.key === "email" ? <a href={`mailto:${v.value}`}>{v.value}</a> : <b>{v.value}</b>}
                {v.evidence && <q className="rs-quote">{v.evidence}</q>}
                <a className="rs-src" href={v.source} target="_blank" rel="noopener noreferrer"><Icon name="link" />{host(v.source)}</a>
              </div>))}</dd></div>))}</dl>}
          {row && row.status !== "researching" && fields.some(f => !(data.fields || {})[f.key]) && Object.keys(data.fields || {}).length > 0 &&
            <p className="help">Not found with a checkable source: {fields.filter(f => !(data.fields || {})[f.key]).map(f => f.label).join(", ")}.</p>}
        </>}
      </div>
    </Drawer>
  );
}
