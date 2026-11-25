import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Alert, Badge, Button, Drawer, DrawerHead, Empty, fail, modal, toast } from "../../ui/kit";

export function FeedbackButtons({ r, given, onDone }) {
  const [open, setOpen] = useState(false);
  const [reasons, setReasons] = useState(null);
  const send = async (verdict, reason = "") => {
    try {
      await api(`/api/ai-jobs/feedback/${encodeURIComponent(r.id)}`, { json: { verdict, reason } });
      setOpen(false); onDone?.();
      if (verdict !== "clear") toast(verdict === "good" ? "Noted: more jobs like this." : "Noted: fewer jobs like this.");
    } catch (e) { fail(e); }
  };
  const showReasons = async () => {
    if (!reasons) { try { setReasons((await api("/api/ai-jobs/learning")).reasons_list); } catch (e) { fail(e); return; } }
    setOpen(o => !o);
  };
  return (
    <span className="ai-fb" onBlur={e => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}
      onKeyDown={e => e.key === "Escape" && setOpen(false)}>
      <button type="button" className={`ai-fb-btn ${given === "good" ? "on ok" : ""}`} aria-pressed={given === "good"} title="Good fit: show more like this"
        onClick={() => send(given === "good" ? "clear" : "good")}>Good fit</button>
      <button type="button" className={`ai-fb-btn ${given === "bad" ? "on bad" : ""}`} aria-pressed={given === "bad"} title="Not for me: show fewer like this"
        onClick={() => given === "bad" ? send("clear") : showReasons()}>Not for me</button>
      {open && reasons && <span className="ai-fb-reasons" role="menu">
        {reasons.map(([k, v]) => <button key={k} type="button" role="menuitem" onClick={() => send("bad", k)}>{v}</button>)}
      </span>}
    </span>
  );
}

export function LearningDrawer({ open, onClose, onChanged }) {
  const [d, setD] = useState(null);
  const load = () => api("/api/ai-jobs/learning").then(setD).catch(fail);
  useEffect(() => { if (open) load(); }, [open]);
  const decide = async (s, accept) => {
    try { const r = await api(`/api/ai-jobs/learning/suggestion/${encodeURIComponent(s.id)}`, { json: { accept } }); setD(x => ({ ...x, ...r.learning }));
      toast(accept ? "Added to your rules." : "Won't suggest that again."); onChanged?.(); } catch (e) { fail(e); }
  };
  const reset = async () => {
    if (!await modal({ title: "Forget what Inkwell learned?", text: "Your Good fit / Not for me feedback is cleared and matches are ranked without it. Your rules and statuses stay.", confirm: "Forget it", danger: true })) return;
    try { const r = await api("/api/ai-jobs/learning/reset", { json: {} }); setD(x => ({ ...x, ...r.learning, given: {} })); onChanged?.(); } catch (e) { fail(e); }
  };
  const cal = d?.calibration;
  return (
    <Drawer open={open} onClose={onClose} label="What Inkwell learned">
      <DrawerHead title="What Inkwell learned" sub="From your Good fit / Not for me, the jobs you apply to and what happens next. It nudges each match by up to 15 points and says why." onClose={onClose} />
      {d && <div className="dr-pad ai-drawer">
        {!d.active ? <Alert tone="info">It starts learning after {d.needed} jobs with feedback or an outcome ({d.lessons} so far). Mark matches Good fit or Not for me, or set their status.</Alert>
          : <Alert tone="ok" icon="check">Learning from {d.lessons} jobs. New matches are ranked with it.</Alert>}
        {(d.likes.length > 0 || d.dislikes.length > 0) && <div className="ai-answer">
          {d.likes.length > 0 && <><b>You tend to like</b><div className="ai-badges">{d.likes.map(x => <Badge key={x} tone="ok" dot={false}>{x}</Badge>)}</div></>}
          {d.dislikes.length > 0 && <><b>You tend to pass on</b><div className="ai-badges">{d.dislikes.map(x => <Badge key={x} tone="bad" dot={false}>{x}</Badge>)}</div></>}
          {d.reasons.length > 0 && <p className="help">Your reasons: {d.reasons.map(r => `${r.reason} (${r.count})`).join(", ")}</p>}
        </div>}
        <h4 className="sec-h">Suggested rules</h4>
        {!d.suggestions.length ? <p className="help">None yet. When your feedback keeps pointing the same way, a rule is suggested here; nothing changes until you say yes.</p>
          : d.suggestions.map(s => (
            <div key={s.id} className="ai-kit-row"><span>{s.text}</span>
              <Button size="sm" variant="ghost" onClick={() => decide(s, false)}>No</Button>
              <Button size="sm" variant="primary" onClick={() => decide(s, true)}>Add rule</Button></div>))}
        <h4 className="sec-h">Do higher scores lead to interviews?</h4>
        {!cal?.bands.length ? <Empty icon="trend" title="No outcomes yet">Set the status of jobs you applied to (Interview, Rejected…) and this fills in.</Empty> : <>
          <div className="table-wrap"><table className="table"><thead><tr><th>Match score</th><th>Jobs</th><th>Interviews</th><th>Rate</th></tr></thead>
            <tbody>{cal.bands.map(b => <tr key={b.band}><td>{b.band}</td><td>{b.total}</td><td>{b.interviews}</td><td>{b.rate == null ? <span className="help">needs {cal.floor}+</span> : `${b.rate}%`}</td></tr>)}</tbody></table></div>
          {cal.verdict && <p className="help">{cal.verdict}</p>}
          {cal.waiting > 0 && <p className="help">{cal.waiting} still waiting for a reply aren't counted.</p>}
        </>}
        {d.lessons > 0 && <div className="form-actions"><Button variant="ghost" icon="trash" onClick={reset}>Forget what it learned</Button></div>}
      </div>}
    </Drawer>
  );
}
