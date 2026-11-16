import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Alert, Badge, Button, Drawer, DrawerHead, Icon, Spinner, fail, toast } from "../../ui/kit";

const MATCH_TONE = { Strong: "ok", Partial: "warn", Gap: "bad" };
const TIER_TONE = { "High Confidence": "ok", "Proceed with Caution": "warn", Suspicious: "bad", Closed: "bad" };
const WEIGHT_TONE = { Positive: "ok", Neutral: "", Concerning: "bad" };
const CLARITY_TONE = { present: "ok", partial: "warn", missing: "bad" };

export const TIER_LABEL = { "High Confidence": "Posting looks real", "Proceed with Caution": "Posting: check first", Suspicious: "Posting looks suspicious", Closed: "Posting closed" };

export const scoreTone = s => (s >= 4.5 ? "great" : s >= 4 ? "good" : s >= 3.5 ? "fair" : "low");

function Block({ letter, title, children, open = true }) {
  return (
    <details className="ai-block" open={open}>
      <summary><span className="ai-block-l">{letter}</span>{title}</summary>
      <div className="ai-block-body">{children}</div>
    </details>
  );
}

function CoverLetter({ job, initial }) {
  const [c, setC] = useState(initial || null);
  const [text, setText] = useState(initial?.text || "");
  const [busy, setBusy] = useState("");
  const draft = async () => {
    setBusy("draft");
    try { const r = await api(`/api/ai-jobs/cover/${encodeURIComponent(job.id)}`, { json: {} }); setC(r.cover); setText(r.cover.text); }
    catch (e) { fail(e); }
    setBusy("");
  };
  const save = async use => {
    setBusy(use ? "use" : "save");
    try {
      const r = await api(`/api/ai-jobs/cover/${encodeURIComponent(job.id)}`, { method: "PUT", json: { text, ...(use !== undefined ? { use } : {}) } });
      setC(r.cover);
      toast(use ? `Saved as “${r.cover.doc}” in Files. It's attached when you apply to this job.` : use === false ? "This job uses your usual cover letter again." : "Saved");
    } catch (e) { fail(e); }
    setBusy("");
  };
  if (!c) return (
    <div className="ai-cover-empty">
      <p className="help">A one-page letter that matches this posting's main needs to real lines from your resume. You edit it before it's used.</p>
      <Button icon="sparkles" busy={busy === "draft"} busyLabel="Writing…" onClick={draft}>Draft a cover letter</Button>
    </div>
  );
  return (
    <div className="ai-cover">
      <textarea className="textarea" rows={12} value={text} onChange={e => setText(e.target.value)} maxLength={6000} aria-label="Cover letter" />
      <div className="ai-answer-foot">
        {c.doc ? <Badge tone="ok">Attached when applying: {c.doc}</Badge> : <span className="help">Check every claim before you use it.</span>}
        <span className="grow" />
        <Button size="sm" variant="ghost" icon="refresh" busy={busy === "draft"} onClick={draft}>Redraft</Button>
        <Button size="sm" busy={busy === "save"} onClick={() => save()}>Save</Button>
        {c.doc ? <Button size="sm" variant="ghost" onClick={() => save(false)}>Stop using</Button>
          : <Button size="sm" variant="primary" icon="file" busy={busy === "use"} onClick={() => save(true)}>Use for this job</Button>}
      </div>
    </div>
  );
}

function Extras({ job, stale }) {
  const [x, setX] = useState(null);
  const [busy, setBusy] = useState("");
  const load = () => api(`/api/ai-jobs/context/${encodeURIComponent(job.id)}`).then(setX).catch(() => {});
  useEffect(() => { load(); }, [job.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const act = async (key, path, json, done) => {
    setBusy(key);
    try { const r = await api(path, { json }); done?.(r); load(); } catch (e) { fail(e); }
    setBusy("");
  };
  const useResume = async use => {
    try { await api(`/api/ai-jobs/resume/${encodeURIComponent(job.id)}`, { method: "PUT", json: { use } }); load(); toast(use ? "This resume is sent when you apply to this job." : "Your usual resume is sent again."); }
    catch (e) { fail(e); }
  };
  if (!x) return null;
  const h = x.history;
  const id = encodeURIComponent(job.id);
  return <>
    {(stale || x.stale) && <Alert tone="warn" icon="refresh">Your resume changed after this evaluation. Re-evaluate to update it.</Alert>}
    {x.deadline && <Alert tone={new Date(x.deadline) < new Date(Date.now() + 5 * 864e5) ? "warn" : "info"} icon="calendar">Applications close on {x.deadline}.</Alert>}
    {h.count > 0 && <p className="help ai-note"><Icon name="info" />You applied to {job.company} {h.count} time{h.count === 1 ? "" : "s"} before
      ({h.applications.map(a => `${a.role || "a role"}, ${a.applied}: ${a.status}`).join("; ")}).{h.label === "silent" ? " They haven't replied yet; weigh how much effort to put in." : ""}</p>}
    {x.similar.length > 0 && <p className="help ai-note"><Icon name="layers" />Reads like jobs you already evaluated: {x.similar.map(s => `${s.title} at ${s.company} (${s.similarity}% alike)`).join(", ")}. Reuse that cover letter and stories.</p>}

    <Block letter="R" title="Resume for this job">
      <p className="help">Your resume, aimed at this posting: summary, skills and the most relevant work first. Facts stay exactly as on your resume; any line that adds one is dropped.</p>
      {x.resume && <div className="ai-answer-foot">
        <Badge tone={x.resume.use ? "ok" : ""}>{x.resume.doc}</Badge>{x.resume.keywords != null && <span className="help">keywords {x.resume.keywords}%</span>}
        <span className="grow" />
        <a className="btn btn-sm" href="/app/files" target="_blank" rel="noopener noreferrer"><Icon name="file" />Open in Files</a>
        {x.resume.use ? <Button size="sm" variant="ghost" onClick={() => useResume(false)}>Stop using</Button>
          : <Button size="sm" variant="primary" onClick={() => useResume(true)}>Send it for this job</Button>}
      </div>}
      {x.resume?.dropped?.length > 0 && <p className="help">Left out {x.resume.dropped.length} reworded line{x.resume.dropped.length === 1 ? "" : "s"} that added something not on your resume.</p>}
      <div><Button size="sm" icon="file" busy={busy === "resume"} busyLabel="Making…" onClick={() => act("resume", `/api/ai-jobs/resume/${id}`, {}, () => toast("Saved in Files. Check it before sending."))}>
        {x.resume ? "Make it again" : "Make a tailored resume"}</Button></div>
    </Block>

    <Block letter="P" title="Prepare" open={!!x.prep}>
      <div className="ai-answer-foot" style={{ justifyContent: "flex-start" }}>
        <Button size="sm" icon="users" busy={busy === "interview"} busyLabel="Preparing…" onClick={() => act("interview", `/api/ai-jobs/prep/${id}`, { kind: "interview" })}>Interview prep</Button>
        <Button size="sm" icon="star" busy={busy === "offer"} busyLabel="Preparing…" onClick={() => act("offer", `/api/ai-jobs/prep/${id}`, { kind: "offer" })}>I got an offer: negotiation prep</Button>
        <Button size="sm" variant="ghost" icon="download" busy={busy === "archive"} onClick={() => act("archive", `/api/ai-jobs/archive/${id}`, {}, r => toast(`Saved “${r.doc}” in Files`))}>Save the posting</Button>
      </div>
      {x.prep && <>
        <p className="help">{x.prep.kind === "offer" ? "Offer negotiation" : "Interview"} prep · {x.prep.engine}</p>
        {x.prep.sections.map(sec => <div key={sec.title}><h5>{sec.title}</h5><ul className="ai-list">{sec.points.map(pt => <li key={pt}>{pt}</li>)}</ul></div>)}
      </>}
    </Block>
  </>;
}

export function ReportDrawer({ job, onClose, onEvaluated, onAnswers }) {
  const [r, setR] = useState(null);
  const [cover, setCover] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { const x = await api(`/api/ai-jobs/evaluate/${encodeURIComponent(job.id)}`, { json: {} }); setR(x.report); onEvaluated?.(); }
    catch (e) { fail(e); }
    setBusy(false);
  };
  useEffect(() => {
    setR(null); setCover(null);
    if (!job) return;
    if (job.report) api(`/api/ai-jobs/report/${encodeURIComponent(job.id)}`).then(x => { setR(x.report); setCover(x.cover); }).catch(() => run());
    else run();
  }, [job?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const s = r?.summary;
  return (
    <Drawer open={!!job} onClose={onClose} label="Job evaluation" wide>
      <DrawerHead title="Evaluation" sub={job ? `${job.title} · ${job.company}` : ""} onClose={onClose}>
        {r && <Button size="sm" variant="ghost" icon="refresh" busy={busy} onClick={run}>Re-evaluate</Button>}
      </DrawerHead>
      <div className="dr-pad ai-drawer">
        {!r ? <div className="ai-eval-wait"><Spinner /><span>Checking the posting is still open, then reading it against your resume…</span></div> : <>
          <div className="ai-verdict-card">
            <div className={`ai-score5 ${scoreTone(r.score5)}`}><b>{r.score5.toFixed(1)}</b><small>/ 5</small></div>
            <div>
              <h3>{r.verdict}</h3>
              <p className="help">{s.tldr}</p>
              <div className="ai-badges">
                <Badge tone={TIER_TONE[r.legitimacy.tier]}>{TIER_LABEL[r.legitimacy.tier]}</Badge>
                <Badge dot={false} title="How much evidence the score rests on">Evidence: {r.confidence.toLowerCase()}</Badge>
                <Badge dot={false}>{r.engine}</Badge>
              </div>
            </div>
          </div>
          {r.rules.length > 0 && <Alert tone="bad" icon="flag">Breaks your rules: {r.rules.map(x => `${x.rule} (“${x.because}”)`).join("; ")}. Auto-apply skips it unless you choose “apply anyway”.</Alert>}
          {r.live?.state === "expired" && <Alert tone="bad">{r.live.reason}. Don't spend time on it.</Alert>}
          <div className="ai-dims">
            {r.dimensions.map(d => (
              <div key={d.name} className="ai-dim"><span className="help">{d.name}</span><b>{d.score}</b>
                <i className={`ai-ev ${d.evidence}`} title={`Evidence: ${d.evidence}`}>{d.evidence}</i></div>
            ))}
          </div>
          {r.checks.length > 0 && <p className="help"><b>Could change the score:</b> {r.checks.join(" · ")}</p>}

          <Block letter="A" title="Role summary">
            <dl className="ai-dl">
              <dt>Kind of role</dt><dd>{s.archetype}{s.targeted === true ? " · one you target" : s.targeted === false ? " · not one you target" : ""}</dd>
              <dt>Level</dt><dd>{s.seniority}</dd>
              <dt>Where</dt><dd>{s.remote}{job?.location ? ` · ${job.location}` : ""}</dd>
              {s.team_size && <><dt>Team</dt><dd>{s.team_size} people</dd></>}
              <dt>Pay</dt><dd>{s.pay?.text || "Not stated"}</dd>
            </dl>
          </Block>

          <Block letter="B" title={`Match with your resume · ${r.match.rows.filter(x => x.match === "Strong").length} of ${r.match.rows.length} strong`}>
            {!r.match.rows.length ? <p className="help">The posting doesn't list clear requirements.</p> : (
              <div className="ai-req">
                {r.match.rows.map(x => (
                  <div key={x.requirement} className="ai-req-row">
                    <div className="ai-req-top"><Badge tone={MATCH_TONE[x.match]}>{x.match}</Badge><span className="help">{x.importance}</span></div>
                    <p>{x.requirement}</p>
                    {x.evidence && <blockquote>{x.evidence}</blockquote>}
                  </div>
                ))}
              </div>
            )}
            {r.match.gaps.length > 0 && <>
              <h5>Gaps and how to handle them</h5>
              <ul className="ai-list">{r.match.gaps.map(g => <li key={g.gap}><b>{g.gap}</b>{g.blocker ? " (must-have)" : ""}: {g.mitigation}</li>)}</ul>
            </>}
          </Block>

          <Block letter="C" title="Level and strategy" open={false}>
            <p>{r.level.strategy}</p>
            {r.level.years_asked && <p className="help">Asks {r.level.years_asked[0]}{r.level.years_asked[1] ? `–${r.level.years_asked[1]}` : "+"} years.</p>}
          </Block>

          <Block letter="D" title="Pay" open={false}>
            <p>{r.comp.pay?.text ? <><b>{r.comp.pay.text}</b> · reliability {r.comp.reliability}</> : "No pay stated."}</p>
            <p className="help">{r.comp.note}</p>
          </Block>

          <Block letter="E" title={`Tailor your application · keywords ${r.keywords.percent ?? "–"}% covered`}>
            {r.plan.summary && <><h5>Summary for this job <span className="help">(from your resume; check it)</span></h5><p className="ai-quote">{r.plan.summary}</p></>}
            {r.plan.emphasize.length > 0 && <><h5>Move these up</h5><ul className="ai-list">{r.plan.emphasize.map(x => <li key={x}>{x}</li>)}</ul></>}
            <h5>Keywords</h5>
            <div className="ai-kw">
              {r.keywords.covered.map(k => <span key={k} className="ai-kw-on"><Icon name="check" />{k}</span>)}
              {r.keywords.missing.map(k => <span key={k} className="ai-kw-off" title="Not on your resume">{k}</span>)}
            </div>
            {r.keywords.missing.length > 0 && <p className="help">Add a missing keyword only if you've really used it: reword, never invent.</p>}
          </Block>

          <Block letter="F" title="Interview plan" open={false}>
            {r.interview.stories.map(x => (
              <div key={x.story} className="ai-story"><b>{x.theme}</b>{x.requirement && <span className="help"> · for “{String(x.requirement).slice(0, 90)}”</span>}<p>{x.story}</p></div>
            ))}
            <h5>Likely questions</h5>
            <ol className="ai-list">{r.interview.questions.map(q => <li key={q}>{q}</li>)}</ol>
          </Block>

          <Block letter="G" title={`Is the posting real and open? · ${TIER_LABEL[r.legitimacy.tier]}`}>
            <div className="ai-signals">
              {r.legitimacy.signals.map(x => (
                <div key={x.signal} className="ai-signal"><span>{x.signal}</span><span className="help">{x.finding}</span><Badge tone={WEIGHT_TONE[x.weight]}>{x.weight}</Badge></div>
              ))}
            </div>
            {[...r.legitimacy.notes, ...r.legitimacy.flags].map(n => <p key={n} className="help ai-note"><Icon name="info" />{n}</p>)}
            <h5>Does it say what the job really is?</h5>
            <div className="ai-signals">
              {r.clarity.points.map(p => (
                <div key={p.id} className="ai-signal"><span>{p.label}</span><span className="help">{p.evidence ? `“${p.evidence}”` : ""}</span>
                  <Badge tone={CLARITY_TONE[p.status]}>{p.status}</Badge></div>
              ))}
            </div>
            {r.clarity.ask_before && <Alert tone="warn">Ask before you commit: {r.clarity.questions.join(" ")}</Alert>}
          </Block>

          <Block letter="H" title="Application answers and cover letter">
            {r.answers.length > 0 && <Alert tone="info" icon="note">Drafted {r.answers.length} answer{r.answers.length === 1 ? "" : "s"} for this form's questions.
              They're in <button type="button" className="link-btn" onClick={() => onAnswers?.({})}>My answers</button> to review; nothing unreviewed is ever typed into a form.</Alert>}
            {r.open_questions.length > 0 && !r.answers.length && <p className="help">{r.open_questions.length} question{r.open_questions.length === 1 ? "" : "s"} on this form still need your answer.</p>}
            {job && <CoverLetter key={job.id} job={job} initial={cover} />}
          </Block>
          {job && <Extras key={job.id} job={job} />}
        </>}
      </div>
    </Drawer>
  );
}
