import { useState } from "react";
import { api } from "../../lib/api";
import { Alert, Badge, Button, Drawer, DrawerHead, Icon, fail, toast } from "../../ui/kit";
import { SOURCES } from "./shared";

export const KEY_STEPS = {
  tavily: [
    <>Open <a className="link" href="https://app.tavily.com" target="_blank" rel="noopener noreferrer">app.tavily.com</a> and sign up (Google, GitHub or email). No credit card is needed.</>,
    <>Your dashboard opens with an API key already made. It starts with <code>tvly-</code>.</>,
    <>Click the copy icon next to the key, paste it below and press <b>Save</b>.</>,
    <>The free plan gives 1,000 searches a month; one Inkwell search uses one or two.</>,
  ],
  brave: [
    <>Open <a className="link" href="https://api-dashboard.search.brave.com" target="_blank" rel="noopener noreferrer">api-dashboard.search.brave.com</a> and create an account, then confirm your email.</>,
    <>Go to <b>Subscriptions</b> and pick the <b>Search</b> plan. Brave asks for a credit card and adds $5 of free credit every month (about 1,000 searches).</>,
    <>To avoid charges, set a monthly limit in the dashboard if it offers one, and keep an eye on usage. Brave's terms ask for a “Powered by Brave” mention to keep the free credit.</>,
    <>Go to <b>API Keys</b>, click <b>Add API key</b>, name it “Inkwell”, copy it, paste it below and press <b>Save</b>.</>,
  ],
};

export function KeysDrawer({ open, onClose, keys, onSaved }) {
  const [v, setV] = useState({ tavily: "", brave: "" });
  const [busy, setBusy] = useState(false);
  const save = async (k, value) => {
    setBusy(true);
    try { onSaved(await api("/api/ai-jobs/keys", { method: "PUT", json: { [k]: value } })); setV(x => ({ ...x, [k]: "" })); toast(value ? "Key saved" : "Key removed"); }
    catch (e) { fail(e); }
    setBusy(false);
  };
  return (
    <Drawer open={open} onClose={onClose} label="Search keys">
      <DrawerHead title="Web search keys" sub="Optional. Career sites work without any key." onClose={onClose} />
      <div className="dr-pad ai-drawer">
        {SOURCES.filter(x => KEY_STEPS[x[0]]).map(([id, label, hint, url]) => (
          <div key={id} className="ai-key">
            <b>{label}</b> {keys[id] && <Badge tone="ok">Saved</Badge>}
            <p className="help">{hint}</p>
            <details className="ai-steps-howto" open={!keys[id]}>
              <summary>How to get a {label.split(" ")[0]} key</summary>
              <ol>{KEY_STEPS[id].map((step, i) => <li key={i}>{step}</li>)}</ol>
              <a className="btn btn-sm" href={url} target="_blank" rel="noopener noreferrer">Open {label.split(" ")[0]}<Icon name="link" /></a>
            </details>
            <div className="ai-key-row">
              <input className="input" type="password" autoComplete="off" value={v[id]} placeholder={keys[id] ? "Replace the saved key" : "Paste your API key"} onChange={e => setV(x => ({ ...x, [id]: e.target.value }))} />
              <Button variant="primary" busy={busy} disabled={!v[id].trim()} onClick={() => save(id, v[id].trim())}>Save</Button>
              {keys[id] && <Button variant="ghost" onClick={() => save(id, "")}>Remove</Button>}
            </div>
          </div>
        ))}
        <Alert tone="info">You don't need either key: <b>Company career sites</b> works without one. Keys are stored encrypted, used only for your own searches, and never shown again or sent to your browser.</Alert>
      </div>
    </Drawer>
  );
}
