import { motion } from "framer-motion";
import { useState } from "react";
import { api } from "../../lib/api";
import { Button, Field, Icon, applyError, toast } from "../../ui/kit";

export function Connect({ onDone }) {
  const [token, setToken] = useState("");
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault(); setErrors({});
    if (!token.trim()) return setErrors({ token: "Paste your token." });
    setBusy(true);
    try { const r = await api("/api/gh/connect", { json: { token: token.trim() } }); toast(`Connected as ${r.login}`); onDone(); } catch (er) { applyError(er, setErrors); }
    setBusy(false);
  };
  return (
    <motion.form className="card card-pad connect-card" onSubmit={submit} noValidate initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ maxWidth: 640 }}>
      <motion.div className="connect-ic gh" initial={{ scale: .5, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}><Icon name="github" /></motion.div>
      <h3>Connect your GitHub account</h3>
      <p className="help">Inkwell uses a <b>personal access token</b> to read and update your repositories. It's stored encrypted and only used from this app.</p>
      <ol className="howto">
        <li>Open <a href="https://github.com/settings/tokens/new?scopes=repo,workflow&description=Inkwell" target="_blank" rel="noopener noreferrer">GitHub → Settings → Developer settings → Tokens (classic)</a>. The <b>repo</b> and <b>workflow</b> permissions are pre-selected.</li>
        <li>Pick an expiry, click <b>Generate token</b>, and copy it (it starts with <code>ghp_</code>).</li>
        <li>Paste it below.</li>
      </ol>
      <Field label="Personal access token" error={errors.token}><input className="input" type="password" autoComplete="off" placeholder="ghp_…" value={token} onChange={e => setToken(e.target.value)} /></Field>
      <div className="form-actions"><span className="grow" /><Button type="submit" variant="primary" icon="link" busy={busy} busyLabel="Connecting…">Connect GitHub</Button></div>
    </motion.form>
  );
}
