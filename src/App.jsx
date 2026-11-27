import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { Suspense, lazy, useEffect } from "react";
import Shell from "./layout/Shell";
import SendView from "./layout/SendView";
import { useRoute } from "./lib/router";
import { useApp } from "./lib/store";
import { Button, Empty, ModalHost, SkBlock, Toasts, ease } from "./ui/kit";
import { ResearchHost } from "./ui/research";

const P = {
  dashboard: lazy(() => import("./pages/Dashboard")),
  campaign: lazy(() => import("./pages/Campaign")),
  contacts: lazy(() => import("./pages/Contacts")),
  contact: lazy(() => import("./pages/Contact")),
  templates: lazy(() => import("./pages/Templates")),
  files: lazy(() => import("./pages/Files")),
  replies: lazy(() => import("./pages/Replies")),
  activity: lazy(() => import("./pages/Activity")),
  inbox: lazy(() => import("./pages/Inbox")),
  applications: lazy(() => import("./pages/Applications")),
  jobs: lazy(() => import("./pages/Jobs")),
  posts: lazy(() => import("./pages/Posts")),
  naukri: lazy(() => import("./pages/Naukri")),
  linkedin: lazy(() => import("./pages/LinkedIn")),
  github: lazy(() => import("./pages/GitHub")),
  portfolio: lazy(() => import("./pages/Portfolio")),
  whatsapp: lazy(() => import("./pages/WhatsApp")),
  profile: lazy(() => import("./pages/Profile")),
  settings: lazy(() => import("./pages/Settings")),
  leads: lazy(() => import("./pages/Leads")),
  finder: lazy(() => import("./pages/Finder")),
  nearby: lazy(() => import("./pages/Nearby")),
  "ai-jobs": lazy(() => import("./pages/AIJobs")),
  learning: lazy(() => import("./pages/Learning")),
  approvals: lazy(() => import("./pages/Approvals")),
};
export const TITLES = {
  dashboard: ["Dashboard", ""],
  campaign: ["New campaign", "Pick your audience and message, check the preview, then send."],
  contacts: ["Contacts", "Click any cell to edit. Changes save automatically."],
  contact: ["Contact", ""],
  templates: ["Templates", "Reusable messages. Fields like {name} and {company} are filled in for each person."],
  files: ["Files", "Files you can attach to messages, like a resume, brochure or price list."],
  replies: ["Replies", "People who answered the emails you sent from Inkwell, what they said, and what they're asking for."],
  activity: ["Activity", "A record of every message sent from your account."],
  inbox: ["Inbox insights", "Your inbox grouped by company and sorted into categories. Inkwell only reads it."],
  applications: ["Applications", "Every job you've applied for, found in your mailbox, and where each one stands."],
  jobs: ["Job matches", "Jobs from the alert emails in your inbox, scored against your resume. You apply on the job site."],
  posts: ["Hiring posts", "Paste a post that asks for CVs by email. Inkwell drafts your reply and sends it after a delay you choose."],
  naukri: ["Naukri", "Your Naukri applications, recruiter activity and job alerts, read from the emails Naukri sends you."],
  linkedin: ["LinkedIn", "Your LinkedIn profile and posts. Publish now or schedule for later."],
  portfolio: ["Portfolio", "Build and run your own one-page website, pick the projects it shows and read messages from visitors."],
  github: ["GitHub", "Your repositories, files, branches and pull requests. Edit and push straight to GitHub."],
  whatsapp: ["WhatsApp", "Link your WhatsApp once. Messages are sent from your own number."],
  profile: ["Profile & email", "Your details, the email account messages are sent from, and Gmail sync."],
  settings: ["Settings", ""],
  "ai-jobs": ["AI job match", "Tell Inkwell AI what you want. It reads your resume, searches for openings, ranks every match and can apply for you."],
  finder: ["Email finder", "Find the HR and careers email addresses that companies publish on their websites, then save them as contacts."],
  nearby: ["Companies near me", "Every company around you or any place you pick, on a map: what they do, their careers page, open jobs and the HR email they publish."],
  learning: ["Learning", "A 90-day interview course, daily DSA, spaced review of what you studied, and a morning briefing with papers, tech news and your job search."],
  approvals: ["Approvals", "What your agents want to do outside Inkwell. Nothing is sent or submitted until you approve it."],
  leads: ["Leads", "Enquiries from the contact form on your website. Reply, add notes and track each one."],
};

export default function App() {
  const app = useApp();
  const route = useRoute();
  let page = P[route.page] ? route.page : "dashboard";
  const [title, sub] = TITLES[page];

  useEffect(() => { document.title = `${title} · Inkwell`; }, [title]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [page]);
  useEffect(() => {
    const warn = e => { if (app.job.running) { e.preventDefault(); e.returnValue = ""; } };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [app.job.running]);

  if (app.error) return (
    <div className="boot-error"><Empty icon="alert" title="Couldn't load your workspace" action={<Button onClick={() => location.reload()}>Try again</Button>}>{app.error}</Empty></div>
  );
  if (!app.loaded) return <Boot />;
  const Page = P[page];
  return (
    <MotionConfig reducedMotion="user">
      <Shell page={page} title={title} sub={sub}>
        <AnimatePresence mode="wait">
          <motion.div key={page + (page === "contact" ? route.param : "")} className="page"
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(2px)", transition: { duration: .14 } }} transition={{ duration: .32, ease }}>
            <Suspense fallback={<PageSkeleton />}>
              <Page route={route} />
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </Shell>
      <SendView />
      <ModalHost />
      <ResearchHost />
      <Toasts />
    </MotionConfig>
  );
}

const PageSkeleton = () => (
  <div className="page-sk">
    <div className="kpis">{[0, 1, 2, 3].map(i => <div key={i} className="kpi sk-card" style={{ height: 104 }} />)}</div>
    <div className="grid-2"><SkBlock h={260} /><SkBlock h={260} /></div>
  </div>
);

function Boot() {
  return (
    <div className="boot">
      <motion.div className="boot-logo" initial={{ scale: .6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}>
        <svg viewBox="0 0 24 24" className="i"><rect x="3" y="7" width="13" height="10" rx="1.6" /><path d="m3.4 7.6 6.1 4.6 6.1-4.6" /><path d="m21 4-6.5 9.5" /><path d="m14.5 13.5-.6 2.4 2.2-1.1" /></svg>
      </motion.div>
      <motion.div className="boot-bar" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .2 }}><span /></motion.div>
    </div>
  );
}
