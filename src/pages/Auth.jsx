import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { EMAIL_RE, LANDING } from "../lib/format";

const LEGAL = LANDING === "/" ? "" : LANDING;
import { Button, Check, Field, FormError, Icon, ModalHost, Toasts } from "../ui/kit";

// Email and password sign-in (email codes return once the mail service is set up again).
export default function Auth({ signup }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { document.title = signup ? "Create account · Inkwell" : "Log in · Inkwell"; }, [signup]);

  const submit = async e => {
    e.preventDefault(); setErrors({}); setFormError("");
    const errs = {};
    if (signup && name.trim().length < 2) errs.name = "Enter your full name.";
    if (!EMAIL_RE.test(email.trim())) errs.email = "Enter a valid email address, like name@example.com.";
    if (signup && password.length < 8) errs.password = "Use at least 8 characters.";
    if (!signup && !password) errs.password = "Enter your password.";
    if (signup && !agree) errs.agree = "Please confirm to continue.";
    if (Object.keys(errs).length) return setErrors(errs);
    setBusy(true);
    try {
      await api(signup ? "/api/auth/signup" : "/api/auth/login", { json: signup ? { email: email.trim(), name: name.trim(), password, agree } : { email: email.trim(), password } });
      location.href = "/app";
    } catch (err) { err.field ? setErrors({ [err.field]: err.message }) : setFormError(err.message); setBusy(false); }
  };

  const tabs = (
    <nav className="auth2-tabs" aria-label="Account">
      <a href="/login" className={signup ? "" : "on"} aria-current={signup ? undefined : "page"}>Log in</a>
      <a href="/signup" className={signup ? "on" : ""} aria-current={signup ? "page" : undefined}>Sign up</a>
    </nav>
  );
  return (
    <div className="auth2">
      <svg className="auth2-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 21.5h13v-4.6a3.6 3.6 0 0 0-2.8-3.5v-2.2H8.3v2.2a3.6 3.6 0 0 0-2.8 3.5z" /><path d="M7.6 17.4h8.8" /><path d="M12 9.6 9.4 5.6 12 1.8l2.6 3.8z" /><path d="M12 9.6V6.4" /></svg>
      <header className="auth2-top">
        <a href={LANDING} className="brand-link"><span className="logo"><Icon name="logo" /></span><span className="brand-name">Inkwell</span></a>
        <a href={LANDING} className="btn btn-sm btn-ghost">Back to site</a>
      </header>
      <main className="auth2-main">
        <motion.form className="auth2-card" onSubmit={submit} noValidate initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .22 }}>
          {tabs}
          <h1>{signup ? "Create your account" : "Welcome back"}</h1>
          <p className="sub">{signup ? "Free to use. Pick a password you don't use anywhere else." : "Log in with your email and password."}</p>
          <div className="stack">
            {signup && <Field label="Full name" error={errors.name}><input className="input" value={name} onChange={e => setName(e.target.value)} autoComplete="name" placeholder="Jane Cooper" maxLength={80} /></Field>}
            <Field label="Email" error={errors.email}><input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete={signup ? "email" : "username"} placeholder="you@example.com" maxLength={254} autoFocus /></Field>
            <Field label="Password" error={errors.password} hint={signup ? "At least 8 characters. A short phrase works well." : undefined}>
              <div className="pw-wrap"><input className="input" type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} autoComplete={signup ? "new-password" : "current-password"} maxLength={128} />
                <button type="button" className="link-btn pw-toggle" onClick={() => setShow(v => !v)} aria-label={show ? "Hide password" : "Show password"}><Icon name="eye" /></button></div>
            </Field>
            {signup && <div><Check checked={agree} onChange={setAgree}>I agree to the <a href={`${LEGAL}/terms`} target="_blank" rel="noopener noreferrer">terms</a> and <a href={`${LEGAL}/privacy`} target="_blank" rel="noopener noreferrer">privacy policy</a>, and I'll only message people who'd expect to hear from me.</Check>{errors.agree && <span className="field-error">{errors.agree}</span>}</div>}
            <FormError>{formError}</FormError>
            <Button variant="primary" size="lg" type="submit" busy={busy} busyLabel={signup ? "Creating account…" : "Logging in…"}>{signup ? "Create account" : "Log in"}</Button>
          </div>
        </motion.form>
      </main>
      <footer className="auth2-foot">
        <span>By continuing you agree to the <a href={`${LEGAL}/terms`} target="_blank" rel="noopener noreferrer">terms</a> and <a href={`${LEGAL}/privacy`} target="_blank" rel="noopener noreferrer">privacy policy</a>.</span>
        <span>Made by <a href="https://sarbeshtiwari.vercel.app" target="_blank" rel="noopener author">Sarbesh Kumar Tiwari</a> · Not affiliated with WhatsApp or Meta.</span>
      </footer>
      <ModalHost /><Toasts />
    </div>
  );
}
