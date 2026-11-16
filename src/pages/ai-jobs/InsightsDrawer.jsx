import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Alert, Drawer, DrawerHead, Icon, fail } from "../../ui/kit";

function Bars({ title, rows }) {
  if (!rows?.length) return null;
  const max = Math.max(...rows.map(r => r.total), 1);
  return (
    <div className="ai-ins">
      <h5>{title}</h5>
      {rows.map(r => (
        <div key={r.name} className="ai-ins-row">
          <span className="ai-ins-name" title={r.name}>{r.name}</span>
          <span className="ai-ins-bar"><i style={{ width: `${(100 * r.total) / max}%` }} /><b style={{ width: `${(100 * r.heard) / max}%` }} /></span>
          <span className="help">{r.rate}% replied · {r.total}</span>
        </div>
      ))}
    </div>
  );
}

export function InsightsDrawer({ open, onClose }) {
  const [d, setD] = useState(null);
  const [days, setDays] = useState(180);
  const [sk, setSk] = useState(null);
  useEffect(() => { if (open) { setD(null); api(`/api/ai-jobs/insights?days=${days}`).then(r => setD(r.insights)).catch(fail); } }, [open, days]);
  useEffect(() => { if (open) api("/api/ai-jobs/skills").then(setSk).catch(() => {}); }, [open]);
  return (
    <Drawer open={open} onClose={onClose} label="Insights" wide>
      <DrawerHead title="What gets replies" sub="Patterns in your own applications, so you spend time where it works." onClose={onClose}>
        <select className="select auto" value={days} onChange={e => setDays(+e.target.value)} aria-label="Period">
          <option value={30}>30 days</option><option value={90}>90 days</option><option value={180}>6 months</option><option value={365}>1 year</option>
        </select>
      </DrawerHead>
      <div className="dr-pad ai-drawer">
        {!d ? <p className="help">Loading…</p> : <>
          <div className="ai-dims">
            <div className="ai-dim"><span className="help">Applications</span><b>{d.total.total}</b></div>
            <div className="ai-dim"><span className="help">Got a reply</span><b>{d.total.rate}%</b></div>
            <div className="ai-dim"><span className="help">Interviews</span><b>{d.total.interviews}</b></div>
            <div className="ai-dim"><span className="help">Days to first reply</span><b>{d.median_days_to_reply == null ? "–" : d.median_days_to_reply < 1 ? "under 1" : d.median_days_to_reply}</b></div>
            <div className="ai-dim"><span className="help">Jobs evaluated</span><b>{d.evaluated}</b></div>
          </div>
          {d.tips.map(t => <Alert key={t} tone="info" icon="sparkles">{t}</Alert>)}
          <Bars title="By evaluation score" rows={d.by_band} />
          <Bars title="By where you applied" rows={d.by_portal} />
          <Bars title="By kind of role" rows={d.by_archetype} />
          <Bars title="By work setup" rows={d.by_remote} />
          {d.skipped_because.length > 0 && <div className="ai-ins"><h5>Why jobs were skipped</h5>
            <ul className="ai-list">{d.skipped_because.map(s => <li key={s.rule}>{s.rule}: {s.count}</li>)}</ul></div>}
          {sk?.skills?.length > 0 && <div className="ai-ins"><h5>Skills worth learning</h5>
            <p className="help">Asked for by the {sk.evaluated} jobs you evaluated and missing from your resume.</p>
            {sk.skills.slice(0, 10).map(x => (
              <div key={x.skill} className="ai-ins-row"><span className="ai-ins-name">{x.skill}</span>
                <span className="ai-ins-bar"><b style={{ width: `${x.share}%` }} /></span>
                <span className="help">{x.missing_in} job{x.missing_in === 1 ? "" : "s"}{x.in_good_fits ? ` · ${x.in_good_fits} good fit${x.in_good_fits === 1 ? "" : "s"}` : ""}</span></div>
            ))}</div>}
          <p className="help"><Icon name="info" /> Scores, kinds of role and work setup show for jobs you evaluated before applying.</p>
        </>}
      </div>
    </Drawer>
  );
}
