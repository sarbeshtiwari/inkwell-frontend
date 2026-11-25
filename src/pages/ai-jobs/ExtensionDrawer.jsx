import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { Badge, Button, Drawer, DrawerHead, Icon, fail, modal, toast } from "../../ui/kit";

export function ExtensionDrawer({ open, onClose }) {
  const [st, setSt] = useState(null);
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setKey(""); api("/api/extension").then(setSt).catch(fail); } }, [open]);
  const create = async () => {
    if (st?.has_key && !await modal({ title: "Create a new key?", text: "The extension stops working with the old key until you paste the new one.", confirm: "Create new key" })) return;
    setBusy(true);
    try { const r = await api("/api/extension/key", { json: {} }); setKey(r.key); setSt(x => ({ ...x, has_key: true })); } catch (e) { fail(e); }
    setBusy(false);
  };
  const [installed, setInstalled] = useState("");
  const install = async () => {
    setBusy(true);
    try { const r = await api("/api/extension/install", { json: {} }); setInstalled(r.folder); toast("Unpacked into Documents. Finder is showing the folder."); } catch (e) { fail(e); }
    setBusy(false);
  };
  const revoke = async () => { await api("/api/extension/key", { method: "DELETE" }).catch(fail); setKey(""); setSt(x => ({ ...x, has_key: false })); toast("Key revoked. The extension can't reach your account any more."); };
  const copy = async () => { try { await navigator.clipboard.writeText(key); toast("Key copied"); } catch { toast("Select the key and copy it.", true); } };
  return (
    <Drawer open={open} onClose={onClose} label="Browser extension" wide>
      <DrawerHead title="Inkwell Autofill" sub="A Chrome extension that fills job applications in your own browser. You check the form and press Submit." onClose={onClose} />
      <div className="dr-pad ai-drawer">
        <div className="ai-ext-what">
          {[["sparkles", "Fills it for you", "Your details, resume, location and approved answers, in one click."], ["shield", "In your browser", "No robot: it's your browser and your Submit, so sites accept it."],
            ["note", "Learns with you", "“Save my answers” sends what you typed to My answers for your approval."]].map(([ic, t, d]) => (
            <div key={t}><Icon name={ic} /><b>{t}</b><span className="help">{d}</span></div>))}
        </div>
        <h4 className="sec-h" style={{ margin: 0 }}>Set it up (about 2 minutes, once)</h4>
        <ol className="ai-ext-steps">
          {st?.can_install ? (
            <li><Button size="sm" variant="primary" icon="folder" busy={busy} onClick={install}>Get the unpacked folder</Button> puts the extension, already unpacked, in
              <code>{st.folder}</code> and opens it in Finder. Leave it there: Chrome loads it from that folder.
              {installed && <div className="help" style={{ marginTop: 6 }}>✓ Ready in {installed}</div>}
              <div className="help" style={{ marginTop: 6 }}>Or <a className="link" href="/downloads/inkwell-autofill.zip" download>download the zip</a> and double-click it to unzip.</div></li>
          ) : (
            <li><a className="btn btn-sm btn-primary" href="/downloads/inkwell-autofill.zip" download><Icon name="download" />Download the extension</a> and double-click the zip
              to unpack it (browsers can only download files, so the folder comes zipped). Move the folder somewhere it can stay, like Documents.</li>
          )}
          <li>In Chrome, open <code>chrome://extensions</code> (type it in the address bar) and turn on <b>Developer mode</b> (top right).</li>
          <li>Click <b>Load unpacked</b> and pick the <b>{st?.can_install ? "Inkwell Autofill" : "unzipped"}</b> folder (tip: <b>Cmd + Shift + G</b> lets you paste its path). Pin it from the puzzle-piece icon so it's always in your toolbar.</li>
          <li>Create your extension key below, click the extension, choose <b>On this Mac</b> (or <b>Online</b> if you use the website), paste the key and press <b>Connect</b>.</li>
        </ol>
        <div className="ai-answer">
          <div className="ai-answer-head"><b>Extension key</b>{st?.has_key ? <Badge tone="ok">Active</Badge> : <Badge>Not created</Badge>}
            {st?.last_used > 0 && <span className="help">Last used {new Date(st.last_used * 1000).toLocaleString()}</span>}</div>
          {key ? <>
            <div className="ai-key-row"><input className="input mono" readOnly value={key} onFocus={e => e.target.select()} /><Button variant="primary" icon="copy" onClick={copy}>Copy</Button></div>
            <span className="help">Shown once. Paste it into the extension now. It only lets the extension read your application details and save answers for your review.</span>
          </> : <span className="help">The key connects the extension to your account. It can't send emails, change settings or see anything else.</span>}
          <div className="ai-answer-foot"><span className="grow" />
            {st?.has_key && <Button size="sm" variant="ghost" onClick={revoke}>Revoke</Button>}
            <Button size="sm" variant={st?.has_key ? "" : "primary"} icon="plus" busy={busy} onClick={create}>{st?.has_key ? "Create a new key" : "Create key"}</Button></div>
        </div>
        <h4 className="sec-h" style={{ margin: 0 }}>Using it</h4>
        <ol className="ai-ext-steps">
          <li>Open a job application form (from a match: <b>Apply in my browser → Open the application form</b>).</li>
          <li>Click <b>Inkwell Autofill → Fill this application</b>. Filled fields turn green, unapproved drafts amber (only if you tick that option), and questions that need you red.</li>
          <li>Answer the red ones, check everything, and press the site's <b>Submit</b> yourself.</li>
          <li>Before submitting, click <b>Save my answers on this page</b> so Inkwell can fill them next time, after you approve them in My answers.</li>
        </ol>
      </div>
    </Drawer>
  );
}
