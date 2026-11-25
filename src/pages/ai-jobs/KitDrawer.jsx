import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Alert, Badge, Button, Drawer, DrawerHead, Icon, fail, toast } from "../../ui/kit";

export function KitDrawer({ job, onClose, onAnswers }) {
  const [k, setK] = useState(null);
  useEffect(() => { setK(null); if (job) api(`/api/ai-jobs/kit/${encodeURIComponent(job.id)}`).then(setK).catch(e => { fail(e); onClose(); }); }, [job]); // eslint-disable-line react-hooks/exhaustive-deps
  const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); toast(`${what} copied`); } catch { toast("Couldn't copy. Select the text and copy it.", true); } };
  return (
    <Drawer open={!!job} onClose={onClose} label="Apply in my browser" wide>
      <DrawerHead title="Apply in my browser" sub={job ? `${job.title} · ${job.company}` : ""} onClose={onClose} />
      <div className="dr-pad ai-drawer">
        {!k ? <p className="help">Loading…</p> : <>
          <Alert tone="info" icon="shield">Some sites only accept applications from a person's own browser. Open the form in your browser and click
            the <b>Inkwell Autofill</b> extension to fill it in one go (set it up under “Browser extension”), or copy each answer from here.</Alert>
          <div className="form-actions" style={{ justifyContent: "flex-start" }}>
            <a className="btn btn-primary" href={k.apply_url} target="_blank" rel="noopener noreferrer"><Icon name="link" />Open the application form</a>
            <a className="btn" href="/app/files" target="_blank" rel="noopener noreferrer"><Icon name="file" />Download resume</a>
          </div>
          <div className="ai-kit">
            {k.fields.map(f => (
              <div key={f.label} className="ai-kit-row"><span className="help">{f.label}</span><b>{f.value}</b>
                <Button size="sm" variant="ghost" icon="copy" onClick={() => copy(f.value, f.label)}>Copy</Button></div>
            ))}
          </div>
          {k.answers.length > 0 && <h4 className="sec-h" style={{ margin: "6px 0 0" }}>Questions on this form</h4>}
          {k.answers.map(a => (
            <div key={a.question} className={`ai-answer ${a.draft ? "review" : ""}`}>
              <div className="ai-answer-head"><b>{a.question}</b>{a.draft && <Badge tone="warn">Draft: check it first</Badge>}</div>
              {a.answer ? <>
                <p className="ai-kit-answer">{a.answer}</p>
                <div className="ai-answer-foot"><span className="grow" /><Button size="sm" icon="copy" onClick={() => copy(a.answer, "Answer")}>Copy answer</Button></div>
              </> : <div className="ai-answer-foot"><span className="help">No saved answer yet.</span><span className="grow" />
                <Button size="sm" variant="ghost" icon="note" onClick={() => onAnswers({ question: a.question, company: /why|interest|excite/i.test(a.question) ? job.company : "" })}>Write an answer</Button></div>}
            </div>
          ))}
        </>}
      </div>
    </Drawer>
  );
}
