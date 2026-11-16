import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Alert, Badge, Button, Drawer, DrawerHead, Empty, Field, fail, toast } from "../../ui/kit";

export function CompaniesDrawer({ open, onClose }) {
  const [d, setD] = useState(null);
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) api("/api/ai-jobs/portals").then(setD).catch(fail); }, [open]);
  const add = async () => {
    const value = v.trim();
    if (!value) return;
    setBusy(true);
    try {
      const r = await api("/api/ai-jobs/portals", { json: /^https?:\/\//i.test(value) ? { link: value } : { name: value } });
      setD(x => ({ ...x, portals: r.portals })); setV(""); toast(`Added ${r.added.name}: ${r.added.jobs} open jobs`);
    } catch (e) { fail(e); }
    setBusy(false);
  };
  const remove = async p => {
    try { const r = await api(`/api/ai-jobs/portals/${p.ats}/${p.slug}`, { method: "DELETE" }); setD(x => ({ ...x, portals: r.portals })); } catch (e) { fail(e); }
  };
  const company = d?.boards.filter(b => b.kind === "company") || [];
  const search = d?.boards.filter(b => b.kind === "search") || [];
  return (
    <Drawer open={open} onClose={onClose} label="My companies" wide>
      <DrawerHead title="My companies and job boards" sub="Companies you want to work for: every search with Company career sites also reads their job boards." onClose={onClose} />
      {d && <div className="dr-pad ai-drawer">
        <Field label="Add a company" hint="Paste the link of its careers page, even its own website's, or type its name. Reachout finds the job board behind it or reads the jobs on the site.">
          <div className="ai-key-row">
            <input className="input" value={v} onChange={e => setV(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="https://careers.example.com or Example Inc" maxLength={400} />
            <Button variant="primary" busy={busy} busyLabel="Checking…" onClick={add}>Add</Button>
          </div>
        </Field>
        {!d.portals.length ? <Empty icon="briefcase" title="No companies yet">Searches still read about 36 well-known company boards and every job board below. Any company website works too, even one not on a job system.</Empty> : (
          <div className="ai-kit">
            {d.portals.map(p => (
              <div key={p.ats + p.slug} className="ai-kit-row"><b>{p.name}</b><span className="help">{d.boards.find(b => b.id === p.ats)?.name || p.ats} · {p.jobs} jobs when added</span>
                <Button size="sm" variant="ghost" icon="trash" onClick={() => remove(p)}>Remove</Button></div>
            ))}
          </div>
        )}
        <Alert tone="info">Reads <b>{company.length + 3}</b> kinds of company job board (Greenhouse, Lever, Ashby, {company.slice(0, 8).map(b => b.name).join(", ")} and more), and the <b>Job boards</b> source searches <b>{search.length}</b> boards: {search.slice(0, 12).map(b => b.name).join(", ")}… Boards for other countries run only when your location is there.</Alert>
        <details><summary className="help">All {search.length} job boards</summary>
          <div className="ai-badges" style={{ marginTop: 8 }}>{search.map(b => <Badge key={b.id} dot={false} title={b.regions.join(", ")}>{b.name}</Badge>)}</div>
        </details>
      </div>}
    </Drawer>
  );
}
