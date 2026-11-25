import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Alert, Badge, Button, Drawer, DrawerHead, Field, Icon, fail, toast } from "../../ui/kit";

export function ModelDrawer({ open, onClose, onSaved }) {
  const [d, setD] = useState(null);
  const [f, setF] = useState({ provider: "ollama", model: "", base_url: "", key: "" });
  const [names, setNames] = useState([]);
  const [busy, setBusy] = useState("");
  const load = () => api("/api/ai-jobs/model").then(r => { setD(r); setF({ provider: r.provider, model: r.model, base_url: r.base_url, key: "" }); }).catch(fail);
  useEffect(() => { if (open) { load(); setNames([]); } }, [open]);
  const p = d?.providers.find(x => x.id === f.provider);
  const save = async () => {
    setBusy("save");
    try {
      const r = await api("/api/ai-jobs/model", { method: "PUT", json: { ...f, ...(f.key ? { key: f.key } : {}) } });
      setD(r); setF(x => ({ ...x, key: "" })); onSaved?.(r); toast(r.ready ? `Using ${r.label}` : "Saved. Add what's missing to use it.");
    } catch (e) { fail(e); }
    setBusy("");
  };
  const test = async () => {
    setBusy("test");
    try { const r = await api("/api/ai-jobs/model/test", { json: {} }); toast(`It works: ${r.label}`); } catch (e) { fail(e); }
    setBusy("");
  };
  const list = async () => {
    setBusy("list");
    try { const r = await api("/api/ai-jobs/model/list"); setNames(r.models); if (!r.models.length) toast("The provider didn't list any models. Type the name instead.", true); }
    catch (e) { fail(e); }
    setBusy("");
  };
  return (
    <Drawer open={open} onClose={onClose} label="AI model">
      <DrawerHead title="AI model" sub="Which AI writes verdicts, reports, cover letters, tailored resumes and prep. Matching itself needs none." onClose={onClose} />
      {d && <div className="dr-pad ai-drawer">
        {d.ready ? <Alert tone="ok" icon="check">In use: <b>{d.label}</b></Alert> : <Alert tone="warn">No model is ready, so reports use Inkwell's plain versions.</Alert>}
        <Field label="Provider">
          <select className="select" value={f.provider} onChange={e => { setF(x => ({ ...x, provider: e.target.value, model: "", key: "" })); setNames([]); }}>
            {d.providers.map(x => <option key={x.id} value={x.id}>{x.label}{d.keys[x.id] ? " ✓" : ""}</option>)}
          </select>
        </Field>
        {f.provider === "claude_cli" || f.provider === "kiro_cli" ? <>
          <Alert tone="info" icon="sparkles">Uses the {f.provider === "claude_cli" ? "Claude Code" : "Kiro"} login on this Mac, so it counts against your own plan's usage. Your resume and the job text go to {f.provider === "claude_cli" ? "Anthropic" : "Kiro"} under your account. On the hosted Inkwell it falls back to Ollama.</Alert>
          <Field label="Model" opt="(optional)" hint={f.provider === "claude_cli" ? "Leave empty for Claude Code's default, or pick sonnet, opus or haiku." : "Leave empty for Kiro's default."}>
            <input className="input" list="ai-model-names" value={f.model} onChange={e => setF(x => ({ ...x, model: e.target.value }))} placeholder="default" />
            <datalist id="ai-model-names">{(f.provider === "claude_cli" ? ["sonnet", "opus", "haiku"] : []).map(n => <option key={n} value={n} />)}</datalist>
          </Field>
        </> : f.provider === "ollama" ? (
          <Alert tone="info">Runs on your Mac; nothing leaves it. {d.ollama_up ? "Ollama is running." : <>Ollama isn't running. Install it, then run <code>ollama pull qwen3:4b</code>.</>}</Alert>
        ) : <>
          {f.provider !== "local" && <Field label="API key" hint={d.keys[f.provider] ? "A key is saved. Paste a new one to replace it." : "Stored encrypted, never shown again."}>
            <input className="input" type="password" autoComplete="off" value={f.key} onChange={e => setF(x => ({ ...x, key: e.target.value }))} placeholder={d.keys[f.provider] ? "••••••••" : "Paste your key"} />
          </Field>}
          {f.provider === "local" && <Field label="Server address" hint="An OpenAI-compatible server on this computer (LM Studio, llama.cpp, vLLM).">
            <input className="input" value={f.base_url} onChange={e => setF(x => ({ ...x, base_url: e.target.value }))} placeholder="http://localhost:1234/v1" />
          </Field>}
          <Field label="Model" hint={p?.suggested ? `Suggested: ${p.suggested}` : "The provider's model name."}>
            <div className="ai-key-row">
              <input className="input" list="ai-model-names" value={f.model} onChange={e => setF(x => ({ ...x, model: e.target.value }))} placeholder={p?.suggested || "model name"} />
              <Button variant="ghost" size="sm" busy={busy === "list"} onClick={list} title="Save the key first">List models</Button>
            </div>
            <datalist id="ai-model-names">{names.map(n => <option key={n} value={n} />)}</datalist>
          </Field>
          {p?.key_url && <a className="btn btn-sm" href={p.key_url} target="_blank" rel="noopener noreferrer">Get a key<Icon name="link" /></a>}
          <Alert tone="info" icon="shield">With a cloud provider, your resume and the text of the jobs you evaluate go to that provider under your own account. Choose Ollama to keep everything on your Mac.</Alert>
        </>}
        <div className="form-actions">
          {d.ready && <Button variant="ghost" busy={busy === "test"} onClick={test}>Test</Button>}
          <Button variant="primary" busy={busy === "save"} onClick={save}>Save</Button>
        </div>
        <div className="ai-badges">{Object.entries(d.keys).filter(([, v]) => v).map(([k]) => <Badge key={k} tone="ok">{d.providers.find(x => x.id === k)?.label.split(" (")[0]} key saved</Badge>)}</div>
      </div>}
    </Drawer>
  );
}
