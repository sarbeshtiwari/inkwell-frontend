import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Badge, Button, Drawer, DrawerHead, Empty, Field, Seg, fail, toast } from "../../ui/kit";

export function AnswersDrawer({ open, onClose, answers, reload }) {
  const [tab, setTab] = useState("all");
  const [draft, setDraft] = useState({ question: "", answer: "", company: "" });
  const [edits, setEdits] = useState({});
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState({});
  useEffect(() => { if (open) { setDraft({ question: open.question || "", answer: "", company: open.company || "" }); setErr({}); setEdits({}); if (open.question) setTab("all"); } }, [open]);
  const add = async () => {
    setBusy("add");
    try { await api("/api/ai-jobs/answers", { json: draft }); setDraft({ question: "", answer: "", company: "" }); toast("Answer saved. Inkwell AI will use it on matching questions."); reload(); }
    catch (e) { e.field ? setErr({ [e.field]: e.message }) : fail(e); }
    setBusy("");
  };
  const save = async (a, approve) => {
    setBusy(a.id);
    try { await api(`/api/ai-jobs/answers/${a.id}`, { method: "PUT", json: { ...a, ...(edits[a.id] || {}), approve } }); setEdits(x => ({ ...x, [a.id]: undefined })); reload(); }
    catch (e) { fail(e); }
    setBusy("");
  };
  const del = async a => { await api(`/api/ai-jobs/answers/${a.id}`, { method: "DELETE" }).catch(fail); reload(); };
  const approveAll = async () => { const r = await api("/api/ai-jobs/answers/approve-all", { json: {} }).catch(fail); r && toast(`${r.approved} approved`); reload(); };
  const review = answers.filter(a => a.status === "review");
  const shown = tab === "review" ? review : answers;
  const ed = (a, k) => (edits[a.id] || {})[k] ?? a[k] ?? "";
  const setEd = (a, k, v) => setEdits(x => ({ ...x, [a.id]: { ...(x[a.id] || {}), [k]: v } }));
  return (
    <Drawer open={!!open} onClose={onClose} label="My answers" wide>
      <DrawerHead title="My answers" sub="Answers Inkwell AI uses on application forms. It learns from forms you fill in; you approve what it keeps." onClose={onClose} />
      <div className="dr-pad ai-drawer">
        <div className="ai-answer-new card card-pad">
          <b>Add an answer</b>
          <Field label="Question" error={err.question}><input className="input" value={draft.question} maxLength={300} placeholder="Will you require visa sponsorship?" onChange={e => setDraft(x => ({ ...x, question: e.target.value }))} /></Field>
          <Field label="Your answer" error={err.answer} hint="For dropdowns and Yes/No questions, write the option exactly as the form shows it (e.g. Yes, No, LinkedIn).">
            <textarea className="input" rows={4} value={draft.answer} maxLength={4000} onChange={e => setDraft(x => ({ ...x, answer: e.target.value }))} /></Field>
          <Field label="Only for company" opt="(optional)" hint="Set it for answers like “Why do you want to work here?”, so they never go to another company. You can write {company} in a general answer.">
            <input className="input" value={draft.company} maxLength={80} placeholder="Notion" onChange={e => setDraft(x => ({ ...x, company: e.target.value }))} /></Field>
          <div className="form-actions"><span className="grow" /><Button variant="primary" icon="check" busy={busy === "add"} disabled={!draft.question.trim() || !draft.answer.trim()} onClick={add}>Save answer</Button></div>
        </div>
        <div className="toolbar" style={{ margin: 0 }}>
          <Seg value={tab} onChange={setTab} name="Which answers" size="sm" options={[["all", "All", null, answers.length || undefined], ["review", "To review", null, review.length || undefined]]} />
          <span className="grow" />
          {review.length > 0 && <Button size="sm" icon="check" onClick={approveAll}>Approve all</Button>}
        </div>
        {!shown.length && <Empty icon="note" title={tab === "review" ? "Nothing to review" : "No saved answers yet"}>
          {tab === "review" ? "Answers you type in application forms appear here for you to approve." : "Add one above, or apply with “Watch it in a browser window”: what you answer there is saved here for your review."}</Empty>}
        {shown.map(a => (
          <div key={a.id} className={`ai-answer ${a.status}`}>
            <div className="ai-answer-head">
              {a.status === "review" ? <Badge tone="warn">To review</Badge> : <Badge tone="ok">Used in forms</Badge>}
              {a.company && <Badge dot={false}>Only {a.company}</Badge>}
              <span className="help">{a.source === "learned" ? `Learned from ${a.learned_from}` : a.source === "draft" ? "Draft by Inkwell AI: check it's true for you" : "Added by you"}</span>
            </div>
            <input className="input ai-answer-q" value={ed(a, "question")} onChange={e => setEd(a, "question", e.target.value)} aria-label="Question" />
            <textarea className="input" rows={Math.min(8, Math.max(2, Math.ceil(ed(a, "answer").length / 80)))} value={ed(a, "answer")} onChange={e => setEd(a, "answer", e.target.value)} aria-label="Answer" />
            <div className="ai-answer-foot">
              <input className="input ai-answer-co" value={ed(a, "company")} placeholder="Any company" onChange={e => setEd(a, "company", e.target.value)} aria-label="Only for company" />
              <span className="grow" />
              <Button size="sm" variant="ghost" icon="trash" onClick={() => del(a)}>Delete</Button>
              {edits[a.id] && a.status === "approved" && <Button size="sm" busy={busy === a.id} onClick={() => save(a, true)}>Save</Button>}
              {a.status === "review" && <Button size="sm" variant="primary" icon="check" busy={busy === a.id} onClick={() => save(a, true)}>Approve</Button>}
            </div>
          </div>
        ))}
      </div>
    </Drawer>
  );
}
