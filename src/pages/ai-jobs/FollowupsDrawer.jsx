import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { go } from "../../lib/router";
import { Alert, Badge, Button, Drawer, DrawerHead, Empty, Icon, fail, modal, toast } from "../../ui/kit";

const KIND = { follow_up: ["Follow up", "warn"], responded: ["Reply to them", "brand"], thank_you: ["Send a thank-you", "ok"], cold: ["Gone cold", ""] };

export function FollowupsDrawer({ open, onClose, onChanged }) {
  const [rows, setRows] = useState(null);
  const [openId, setOpenId] = useState("");
  const [busy, setBusy] = useState("");
  useEffect(() => { if (open) { setRows(null); api("/api/ai-jobs/followups").then(r => setRows(r.followups)).catch(fail); } }, [open]);
  const mark = async (f, action, days) => {
    setBusy(f.id + action);
    try { const r = await api(`/api/ai-jobs/followups/${encodeURIComponent(f.id)}`, { json: { action, days } }); setRows(r.followups); onChanged?.();
      toast(action === "sent" ? "Marked as sent. The next one is scheduled." : `Snoozed for ${days} days`); }
    catch (e) { fail(e); }
    setBusy("");
  };
  const closeStale = async () => {
    const r = await api("/api/ai-jobs/stale?days=60").catch(fail);
    if (!r) return;
    if (!r.stale.length) { toast("Nothing has been silent for 60 days."); return; }
    if (!await modal({ title: `Close ${r.stale.length} silent application${r.stale.length === 1 ? "" : "s"}?`, confirm: "Close them",
      text: `Applications with no reply in 60 days are marked “Position closed”, with a note saying you closed them. You can change any of them back in Applications.` })) return;
    try { const x = await api("/api/ai-jobs/stale", { json: { days: 60, confirm: true } }); toast(`Closed ${x.closed}`); onChanged?.(); } catch (e) { fail(e); }
  };
  const copy = async text => { try { await navigator.clipboard.writeText(text); toast("Copied"); } catch { toast("Couldn't copy. Select the text and copy it.", true); } };
  return (
    <Drawer open={open} onClose={onClose} label="Follow-ups" wide>
      <DrawerHead title="Follow-ups" sub="Who to nudge today, with a draft. Inkwell never sends these: you send them yourself." onClose={onClose} />
      <div className="dr-pad ai-drawer">
        {!rows ? <p className="help">Loading…</p> : !rows.length ? (
          <Empty icon="check" title="Nothing due">Applications are followed up after a week (twice at most), replies within a day, and interviews get a thank-you the next day.</Empty>
        ) : rows.map(f => (
          <div key={f.id} className="ai-answer">
            <div className="ai-answer-head">
              <Badge tone={KIND[f.kind][1]}>{KIND[f.kind][0]}</Badge>
              <b>{f.role}</b><span className="help">· {f.company} · applied {f.days} days ago{f.count ? ` · ${f.count} follow-up${f.count === 1 ? "" : "s"} sent` : ""}</span>
              <span className="grow" />
              {f.overdue > 0 && <span className="help">{f.overdue} day{f.overdue === 1 ? "" : "s"} overdue</span>}
            </div>
            {f.kind === "cold" ? <p className="help">{f.note}</p> : <>
              <button type="button" className="link-btn ai-fu-toggle" onClick={() => setOpenId(openId === f.id ? "" : f.id)}>{openId === f.id ? "Hide draft" : "Show draft"}</button>
              {openId === f.id && <div className="ai-fu-draft">
                {f.to && <p className="help">To: {f.to}</p>}
                <p className="help">Subject: <b>{f.subject}</b></p>
                <pre className="ai-kit-answer">{f.body}</pre>
              </div>}
              <div className="ai-answer-foot">
                <span className="grow" />
                <Button size="sm" variant="ghost" onClick={() => mark(f, "snooze", 3)} busy={busy === f.id + "snooze"}>Snooze 3 days</Button>
                <Button size="sm" icon="copy" onClick={() => copy(`Subject: ${f.subject}\n\n${f.body}`)}>Copy</Button>
                {f.to && <a className="btn btn-sm" href={`mailto:${f.to}?subject=${encodeURIComponent(f.subject)}&body=${encodeURIComponent(f.body)}`}><Icon name="mail" />Open in mail app</a>}
                <Button size="sm" variant="primary" icon="check" busy={busy === f.id + "sent"} onClick={() => mark(f, "sent")}>I sent it</Button>
              </div>
            </>}
          </div>
        ))}
        <Alert tone="info">Follow-ups come from your <button type="button" className="link-btn" onClick={() => { onClose(); go("applications"); }}>Applications</button> list, including ones found in your email. Change the timing in My rules.</Alert>
        <Button variant="ghost" size="sm" icon="clock" onClick={closeStale}>Close applications silent for 60+ days</Button>
      </div>
    </Drawer>
  );
}
