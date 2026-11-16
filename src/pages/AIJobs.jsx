import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { go } from "../lib/router";
import { useApp } from "../lib/store";
import { Alert, Badge, Button, Check, Empty, Field, Icon, Switch, fail, modal, toast } from "../ui/kit";
import { AnswersDrawer } from "./ai-jobs/AnswersDrawer";
import { ApplyDrawer } from "./ai-jobs/ApplyDrawer";
import { ExtensionDrawer } from "./ai-jobs/ExtensionDrawer";
import { KeysDrawer } from "./ai-jobs/KeysDrawer";
import { FollowupsDrawer } from "./ai-jobs/FollowupsDrawer";
import { InsightsDrawer } from "./ai-jobs/InsightsDrawer";
import { KitDrawer } from "./ai-jobs/KitDrawer";
import { LiveView } from "./ai-jobs/LiveView";
import { ReportDrawer, TIER_LABEL, scoreTone } from "./ai-jobs/ReportDrawer";
import { RulesDrawer } from "./ai-jobs/RulesDrawer";
import { CompaniesDrawer } from "./ai-jobs/CompaniesDrawer";
import { ModelDrawer } from "./ai-jobs/ModelDrawer";
import { UpdateDrawer } from "./ai-jobs/UpdateDrawer";
import { FeedbackButtons, LearningDrawer } from "./ai-jobs/LearningDrawer";
import { SOURCES, tone } from "./ai-jobs/shared";

const STEPS = ["Reading your resume", "Searching", "Ranking matches", "Done"];

const TIER = { "High Confidence": "ok", "Proceed with Caution": "warn", Suspicious: "bad", Closed: "bad" };
const KEYLESS = ["career_sites", "remote_boards"];

const MODE_LABEL = { board: "Auto-apply ready", site: "Auto-apply on company site", account: "Watch mode: needs your sign-in" };
const MODE_HINT = { site: "Reachout finds the application form on the company's own site and fills it; it hands back anything only you can do.",
  account: "This site makes you sign in first. With Watch mode on, you sign in in the window and Reachout fills the rest." };
const APPLY = { applied: ["Applied", "ok"], needs_you: ["Needs you", "warn"], closed: ["Closed", ""], ready: ["Ready", "brand"], with_you: ["Open on your screen", "brand"], blocked: ["Apply in your browser", "warn"] };

export default function AIJobs() {
  const app = useApp();
  const [d, setD] = useState(null);
  const [f, setF] = useState({ role: "", years: "", company: "", location: "", resume: "" });
  const [sources, setSources] = useState(["career_sites"]);
  const [useLlm, setUseLlm] = useState(true);
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState("");
  const [picked, setPicked] = useState(new Set());
  const [keysOpen, setKeysOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [minScore, setMinScore] = useState(0);
  const [watchWindow, setWatchWindow] = useState(true);
  const [kitFor, setKitFor] = useState(null);
  const [extOpen, setExtOpen] = useState(false);
  const [answersOpen, setAnswersOpen] = useState(null); // null = closed; {} = open; {question, company} = open with a new answer
  const [answers, setAnswers] = useState([]);
  const [reportFor, setReportFor] = useState(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [fuOpen, setFuOpen] = useState(false);
  const [insOpen, setInsOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [coOpen, setCoOpen] = useState(false);
  const [updOpen, setUpdOpen] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [canUpdate, setCanUpdate] = useState(false);
  useEffect(() => { api("/api/update/progress").then(r => setCanUpdate(r.enabled)).catch(() => {}); }, []);
  const [hideSkipped, setHideSkipped] = useState(true);
  const loadAnswers = () => api("/api/ai-jobs/answers").then(r => setAnswers(r.answers)).catch(() => {});
  useEffect(() => { loadAnswers(); }, []);
  const toReview = answers.filter(a => a.status === "review").length;
  const timer = useRef(null);

  const load = async () => {
    try {
      const r = await api("/api/ai-jobs");
      setD(r);
      setF(x => ({ ...x, resume: x.resume || r.resumes.find(n => !/cover/i.test(n)) || r.resumes[0] || "",
                   ...(r.want && !x.role ? { role: r.want.role, years: String(r.want.years ?? ""), company: r.want.company || "", location: r.want.location || "" } : {}) }));
      clearTimeout(timer.current);
      if (r.state === "running" || r.applying?.state === "running" || r.handover || r.evaluating?.state === "running") timer.current = setTimeout(load, 1800);
    } catch (e) { fail(e); }
  };
  useEffect(() => { load(); return () => clearTimeout(timer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const set = k => e => setF(x => ({ ...x, [k]: e.target.value }));
  const running = d?.state === "running";
  const start = async () => {
    const e = {};
    if (!f.role.trim()) e.role = "Tell us the job you want.";
    if (f.years === "" || isNaN(+f.years) || +f.years < 0) e.years = "Enter your years of experience (0 is fine).";
    if (!f.resume) e.resume = "Upload your resume as a PDF on the Files page first.";
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy("start");
    try {
      await api("/api/ai-jobs/match", { json: { ...f, years: Math.round(+f.years), sources, use_llm: useLlm } });
      setPicked(new Set()); load();
    } catch (x) { x.field && x.field !== "sources" ? setErr({ [x.field]: x.message }) : fail(x); if (x.field === "sources") setKeysOpen(true); }
    setBusy("");
  };
  const toggleSource = id => {
    if (!KEYLESS.includes(id) && !d?.keys?.[id] && !sources.includes(id)) { setKeysOpen(true); return; }
    setSources(s => s.includes(id) ? (s.length > 1 ? s.filter(x => x !== id) : s) : [...s, id]);
  };

  const skipped = (d?.results || []).filter(r => ["skip", "discarded"].includes(r.status)).length;
  const results = (d?.results || []).filter(r => r.score >= minScore && !(hideSkipped && ["skip", "discarded"].includes(r.status)));
  const canPick = r => r.can_apply && r.apply?.state !== "applied" && r.apply?.state !== "closed";
  const toggle = id => setPicked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const evaluateMany = async () => {
    const ids = picked.size ? [...picked] : results.filter(r => !r.report).slice(0, 10).map(r => r.id);
    if (!ids.length) { toast("Every job shown is already evaluated."); return; }
    setBusy("evaluate");
    try { await api("/api/ai-jobs/evaluate", { json: { ids } }); toast(`Evaluating ${ids.length} job${ids.length === 1 ? "" : "s"}…`); load(); }
    catch (x) { fail(x); }
    setBusy("");
  };
  const setStatus = async (r, status) => {
    try { await api(`/api/ai-jobs/status/${encodeURIComponent(r.id)}`, { method: "PUT", json: { status } }); load(); } catch (x) { fail(x); }
  };
  const applyNow = async (anyway = false) => {
    if (!d.consent) { setApplyOpen(true); return; }
    const ids = [...picked];
    if (!anyway && !await modal({ title: `Apply to ${ids.length} job${ids.length === 1 ? "" : "s"}?`, confirm: "Apply now",
      text: watchWindow && d.can_hand_over
        ? "A browser window opens and each job gets its own tab: Reachout AI fills the form and submits it. Where you're needed (signing in, creating an account, a question only you can answer, a CAPTCHA) it pauses with a bar at the bottom of the page; do that part, then press Continue."
        : "Reachout AI fills each public application form with your resume and details and submits it. Forms with questions only you can answer, or a CAPTCHA, are handed back to you. You can watch it live on this page." })) return;
    setBusy("apply");
    try { await api("/api/ai-jobs/apply", { json: { ids, watch: watchWindow, anyway } }); setPicked(new Set()); toast("Applying… watch it live below."); load(); }
    catch (x) {
      if (x.field === "rules") {
        setBusy("");
        if (await modal({ title: "Some picks break your rules", text: x.message, confirm: "Apply anyway", danger: true })) applyNow(true);
        return;
      }
      x.field === "consent" || x.field === "phone" ? (x.field === "phone" ? (toast(x.message, true), go("profile")) : setApplyOpen(true)) : fail(x);
    }
    setBusy("");
  };

  const finish = async r => {
    setBusy("finish:" + r.id);
    try { await api(`/api/ai-jobs/finish/${encodeURIComponent(r.id)}`, { json: {} }); toast("Opening a browser window… answer what it asks, then press Continue in the page."); load(); }
    catch (x) { x.field === "consent" ? setApplyOpen(true) : fail(x); }
    setBusy("");
  };
  const stage = STEPS.indexOf(d?.stage);
  return (
    <div className="ai-page">
      <div className="ai-hero card">
        <div className="ai-hero-glow" aria-hidden="true" />
        <div className="ai-hero-head">
          <span className="ai-chip"><Icon name="sparkles" />Reachout AI</span>
          <span className="help">{d?.local_model ? `Matching engine + ${d.model_name}` : "Reachout's own matching engine · no outside AI"}</span>
        </div>
        <h2>What job are you looking for?</h2>
        <div className="ai-form">
          <Field label="Job you want" error={err.role} className="ai-wide">
            <input className="input" value={f.role} onChange={set("role")} placeholder="Full Stack Developer, AI Engineer, Data Analyst…" maxLength={80} onKeyDown={e => e.key === "Enter" && start()} />
          </Field>
          <Field label="Years of experience" error={err.years}>
            <input className="input" type="number" min="0" max="40" value={f.years} onChange={set("years")} placeholder="3" />
          </Field>
          <Field label="Company" opt="(optional)">
            <input className="input" value={f.company} onChange={set("company")} placeholder="Any company" maxLength={80} />
          </Field>
          <Field label="Location" opt="(optional)">
            <input className="input" value={f.location} onChange={set("location")} placeholder="Bengaluru, Remote…" maxLength={80} />
          </Field>
          <Field label="Resume" error={err.resume}>
            {d?.resumes?.length ? (
              <select className="select" value={f.resume} onChange={set("resume")}>{d.resumes.map(n => <option key={n} value={n}>{n}</option>)}</select>
            ) : <Button icon="upload" onClick={() => go("files")}>Upload a resume</Button>}
          </Field>
        </div>
        <div className="ai-sources">
          <span className="small-label">SEARCH WITH</span>
          {SOURCES.map(([id, label, hint]) => (
            <button key={id} type="button" className={`ai-source ${sources.includes(id) ? "on" : ""}`} onClick={() => toggleSource(id)} aria-pressed={sources.includes(id)}>
              <span className="ai-tick"><Icon name="check" /></span>
              <span><b>{label}</b><small>{!KEYLESS.includes(id) && !d?.keys?.[id] ? "Add your key to use" : hint}</small></span>
            </button>
          ))}
          <Button variant="ghost" size="sm" icon="settings" onClick={() => setKeysOpen(true)}>Search keys</Button>
          <Button variant="ghost" size="sm" icon="flag" onClick={() => setRulesOpen(true)}>My rules</Button>
          <Button variant="ghost" size="sm" icon="bell" onClick={() => setFuOpen(true)}>
            Follow-ups{d?.followups_due > 0 && <span className="ai-review-dot">{d.followups_due} due</span>}
          </Button>
          <Button variant="ghost" size="sm" icon="trend" onClick={() => setInsOpen(true)}>Insights</Button>
          <Button variant="ghost" size="sm" icon="star" onClick={() => setLearnOpen(true)}>
            What it learned{d?.learning?.suggestions > 0 && <span className="ai-review-dot">{d.learning.suggestions} to review</span>}
          </Button>
          <Button variant="ghost" size="sm" icon="briefcase" onClick={() => setCoOpen(true)}>My companies</Button>
          <Button variant="ghost" size="sm" icon="sparkles" onClick={() => setModelOpen(true)}>AI model</Button>
          {canUpdate && <Button variant="ghost" size="sm" icon="download" onClick={() => setUpdOpen(true)}>Updates</Button>}
          <Button variant="ghost" size="sm" icon="puzzle" onClick={() => setExtOpen(true)}>Browser extension</Button>
          <Button variant="ghost" size="sm" icon="note" onClick={() => { loadAnswers(); setAnswersOpen({}); }}>
            My answers{answers.length ? ` (${answers.length})` : ""}{toReview > 0 && <span className="ai-review-dot">{toReview} to review</span>}
          </Button>
        </div>
        <div className="ai-actions">
          {d?.local_model && <Switch checked={useLlm} onChange={setUseLlm}>Second opinion from {d.model_name}</Switch>}
          <span className="grow" />
          <Button variant="primary" size="lg" icon="sparkles" busy={busy === "start" || running} busyLabel={running ? d.stage + "…" : "Starting…"} onClick={start}>Find my matches</Button>
        </div>
      </div>

      <AnimatePresence>
        {running && (
          <motion.div className="card card-pad ai-steps" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {STEPS.slice(0, 3).map((s, i) => (
              <div key={s} className={`ai-step ${i < stage ? "done" : i === stage ? "now" : ""}`}>
                <span className="ai-step-dot">{i < stage ? <Icon name="check" /> : i + 1}</span>{s}
              </div>
            ))}
            {d.skills?.length > 0 && <p className="help">Skills found in your resume: {d.skills.slice(0, 12).join(", ")}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      {d?.evaluating?.state === "running" && (
        <Alert tone="info" icon="sparkles">Evaluating… {d.evaluating.done} of {d.evaluating.total}{d.evaluating.current ? `: ${d.evaluating.current}` : ""}</Alert>
      )}

      {d?.applying?.state === "running" && (
        <Alert tone="info" icon="sparkles">Applying… {d.applying.done} of {d.applying.total}{d.applying.current ? `: ${d.applying.current}` : ""}</Alert>
      )}

      <LiveView active={d?.applying?.state === "running" || !!d?.handover} />

      {d?.state === "error" && <Alert tone="bad">{d.error}</Alert>}
      {d?.errors?.length > 0 && <Alert tone="warn">Some sources didn't answer: {d.errors.join(" · ")}</Alert>}

      {d?.state === "done" && (
        <div className="ai-results">
          <div className="toolbar">
            <div>
              <h3 className="sec-h" style={{ margin: 0 }}>{d.results.length ? `Top ${d.results.length} matches` : "No matches yet"} for {d.want?.role}</h3>
              <span className="help">{d.considered} openings checked · ranked by {d.engine}</span>
            </div>
            <span className="grow" />
            <select className="select auto" value={minScore} onChange={e => setMinScore(+e.target.value)} aria-label="Minimum match">
              <option value={0}>All matches</option><option value={50}>50%+ match</option><option value={65}>65%+ match</option><option value={80}>80%+ match</option>
            </select>
            {skipped > 0 && <Check checked={hideSkipped} onChange={setHideSkipped}>Hide {skipped} skipped</Check>}
            {d.can_hand_over && <Check checked={watchWindow} onChange={setWatchWindow}>Watch it in a browser window</Check>}
            <Button icon="sparkles" busy={busy === "evaluate" || d.evaluating?.state === "running"} busyLabel="Evaluating…" onClick={evaluateMany}
              title="Score each job out of 5 with a full report: fit, gaps, pay, whether the posting is real, interview prep">
              {picked.size ? `Evaluate (${picked.size})` : "Evaluate top 10"}
            </Button>
            <Button variant="primary" icon="send" busy={busy === "apply"} disabled={!picked.size || d.applying?.state === "running"} onClick={() => applyNow()}>
              Auto-apply{picked.size ? ` (${picked.size})` : ""}
            </Button>
          </div>
          {!results.length ? (
            <Empty icon="sparkles" title="No jobs matched well enough">Try a broader job title, add web search, or lower the minimum match.</Empty>
          ) : (
            <div className="ai-grid">
              {results.map((r, i) => (
                <motion.article key={r.id} className={`ai-job card ${picked.has(r.id) ? "picked" : ""}`}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * .03 }}>
                  <div className="ai-job-top">
                    <div className={`ai-score ${tone(r.score)}`} style={{ "--p": r.score }} aria-label={`${r.score}% match`}><span>{r.score}<small>%</small></span></div>
                    <div className="ai-job-title">
                      <h4>{r.title}</h4>
                      <span className="help">{r.company}{r.location ? ` · ${r.location}` : ""}{r.posted ? ` · ${r.posted}` : ""}{r.via ? ` · via ${r.via}` : ""}</span>
                    </div>
                    {r.report && <button type="button" className={`ai-score5 sm ${scoreTone(r.report.score5)}`} onClick={() => setReportFor(r)} title={r.report.verdict}>
                      <b>{r.report.score5.toFixed(1)}</b><small>/5</small></button>}
                    {canPick(r) && <Check checked={picked.has(r.id)} onChange={() => toggle(r.id)}><span className="sr-only">Select</span></Check>}
                  </div>
                  {r.ai_verdict && <p className="ai-verdict"><Icon name="sparkles" />{r.ai_verdict}</p>}
                  {(r.report || r.rules?.length > 0 || r.pay) && <div className="ai-badges">
                    {r.report && <Badge tone={TIER[r.report.tier]}>{TIER_LABEL[r.report.tier]}</Badge>}
                    {r.rules?.map(x => <Badge key={x.rule} tone="bad" title={x.because}>{x.rule}</Badge>)}
                    {r.pay && <Badge dot={false}>{r.pay}</Badge>}
                    {r.remote && r.remote !== "Not stated" && <Badge dot={false}>{r.remote}</Badge>}
                  </div>}
                  <FeedbackButtons r={r} given={d.feedback?.[r.id]} onDone={load} />
                  <ul className="ai-why">
                    {r.reasons.map(x => <li key={x} className="ok"><Icon name="check" />{x}</li>)}
                    {r.gaps.slice(0, 3).map(x => <li key={x} className="gap"><Icon name="alert" />{/^[A-Z]/.test(x) && !/ /.test(x) ? `Not on your resume: ${x}` : x}</li>)}
                  </ul>
                  <div className="ai-job-foot">
                    {r.apply ? <Badge tone={APPLY[r.apply.state]?.[1]} title={r.apply.detail}>{APPLY[r.apply.state]?.[0]}</Badge>
                      : r.can_apply ? <Badge tone="brand" dot={false} title={MODE_HINT[r.apply_mode]}>{MODE_LABEL[r.apply_mode] || "Auto-apply ready"}</Badge>
                      : <Badge dot={false}>Apply on site</Badge>}
                    {["needs_you", "with_you", "blocked"].includes(r.apply?.state) && <span className="help ai-detail">{r.apply.detail}</span>}
                    {r.apply?.questions?.length > 0 && r.apply.state !== "applied" && (
                      <details className="ai-questions"><summary>{r.apply.questions.length} question{r.apply.questions.length === 1 ? "" : "s"} for you</summary>
                        <ul>{r.apply.questions.map(q => <li key={q}>{q} <button type="button" className="link ai-save-q"
                          onClick={() => setAnswersOpen({ question: q.replace(/ \(choose from the list\)$/, ""), company: /why|interest|excite/i.test(q) ? r.company : "" })}>Save an answer</button></li>)}</ul></details>)}
                    <span className="grow" />
                    <select className="select auto sm ai-status" value={r.status || ""} onChange={e => setStatus(r, e.target.value)} aria-label="Status">
                      <option value="" disabled>Status</option>
                      {Object.entries(d.statuses || {}).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <Button size="sm" variant={r.report ? "" : "ghost"} icon="sparkles" onClick={() => setReportFor(r)}>{r.report ? "Report" : "Evaluate"}</Button>
                    {["needs_you", "blocked"].includes(r.apply?.state) && (
                      <Button size="sm" icon="copy" variant={r.apply.state === "blocked" ? "primary" : ""} onClick={() => setKitFor(r)}>Apply in my browser</Button>)}
                    {r.can_apply && d.can_hand_over && ["needs_you", "ready", undefined].includes(r.apply?.state) && (
                      <Button size="sm" variant="primary" icon="sparkles" busy={busy === "finish:" + r.id} disabled={!!d.handover}
                        title="Opens the form in a browser window on this computer, fills it, and waits for you to answer the rest; press Continue in the page and it submits" onClick={() => finish(r)}>Fill &amp; finish</Button>)}
                    <a className="btn btn-sm" href={r.apply?.url || r.url} target="_blank" rel="noopener noreferrer"
                      title={r.apply?.state === "needs_you" && !d.can_hand_over ? "Opens a fresh copy of the form; answers filled on the server don't carry over" : undefined}>
                      {r.apply?.state === "needs_you" ? (d.can_hand_over ? "Open blank form" : "Open the form") : "View job"}<Icon name="link" /></a>
                  </div>
                </motion.article>
              ))}
            </div>
          )}
        </div>
      )}

      {d && d.state === "idle" && (
        <div className="ai-how">
          {[["file", "Reads your resume", "Finds your skills and experience in the PDF you choose."], ["search", "Searches for openings", "Company career sites, plus web search if you add a key."],
            ["sparkles", "Ranks and evaluates", "Scores every match, then a full report out of 5: fit, gaps, pay, whether the posting is real."], ["send", "Applies if you allow", "Fills application forms on job boards and company sites for jobs you pick, learns from your feedback, and reminds you to follow up."]].map(([ic, t, s], i) => (
            <div key={t} className="card card-pad"><span className="ai-how-n">0{i + 1}</span><Icon name={ic} /><b>{t}</b><p className="help">{s}</p></div>
          ))}
        </div>
      )}

      <ExtensionDrawer open={extOpen} onClose={() => setExtOpen(false)} />
      <ReportDrawer job={reportFor} onClose={() => setReportFor(null)} onEvaluated={load} onAnswers={q => { setReportFor(null); loadAnswers(); setAnswersOpen(q); }} />
      <RulesDrawer open={rulesOpen} onClose={() => setRulesOpen(false)} rules={d?.rules} onSaved={rules => setD(x => ({ ...x, rules }))} />
      <FollowupsDrawer open={fuOpen} onClose={() => setFuOpen(false)} onChanged={load} />
      <InsightsDrawer open={insOpen} onClose={() => setInsOpen(false)} />
      <ModelDrawer open={modelOpen} onClose={() => setModelOpen(false)} onSaved={load} />
      <CompaniesDrawer open={coOpen} onClose={() => setCoOpen(false)} />
      <UpdateDrawer open={updOpen} onClose={() => setUpdOpen(false)} />
      <LearningDrawer open={learnOpen} onClose={() => setLearnOpen(false)} onChanged={load} />
      <KitDrawer job={kitFor} onClose={() => setKitFor(null)} onAnswers={q => { setKitFor(null); setAnswersOpen(q); }} />
      <AnswersDrawer open={answersOpen} onClose={() => setAnswersOpen(null)} answers={answers} reload={loadAnswers} />
      <KeysDrawer open={keysOpen} onClose={() => setKeysOpen(false)} keys={d?.keys || {}} onSaved={k => { setD(x => ({ ...x, keys: k })); }} />
      <ApplyDrawer open={applyOpen} onClose={() => setApplyOpen(false)} d={d} me={app.data.profile} onSaved={r => setD(x => ({ ...x, details: r.details, consent: r.consent }))} />
    </div>
  );
}
