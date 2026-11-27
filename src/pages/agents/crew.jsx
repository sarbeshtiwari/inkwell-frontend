// Inkwell's agents as a crew: each has a person's name, a role, and its own robot. Used by My agents and Approvals.

// id: [name, role, colour, head, antenna, eyes, mouth, what they do]
const CREW = {
  orchestrator: ["Maya", "Job search lead", "#7c5cbf", "round", "twin", "happy", "smile",
    "Takes the role you want, sends Arjun and Priya out, and puts the shortlist on AI job match."],
  job_scout: ["Arjun", "Job scout", "#2f8f83", "square", "dish", "visor", "line",
    "Searches company career sites and job boards for open roles in the place you asked for."],
  job_analyst: ["Priya", "Job analyst", "#3d6fc4", "round", "ball", "wide", "line",
    "Scores each job against your resume and says why it fits or doesn't."],
  researcher: ["Kabir", "Company researcher", "#b0702a", "dome", "ball", "one", "grille",
    "Reads a company's own website for its size, team and hiring contacts."],
  writer: ["Ira", "Writer", "#c2557f", "dome", "bolt", "happy", "smile",
    "Reorders your resume and drafts a cover letter for one job. Nothing is sent."],
  applicant: ["Dev", "Applicant", "#4c9a4f", "square", "twin", "dots", "grille",
    "Fills in an application form once you've approved it."],
  communicator: ["Nora", "Replies", "#d0663f", "round", "dish", "dots", "smile",
    "Reads replies to your emails and drafts an answer for you to approve."],
  inbox_watcher: ["Leo", "Inbox keeper", "#2d86b8", "square", "ball", "wide", "grille",
    "Files interview invites, rejections and recruiter mail as they arrive."],
  outreach: ["Zara", "Campaigns", "#a94fb5", "dome", "twin", "visor", "smile",
    "Sends a campaign you've written, one person at a time, after you approve it."],
  job_alerts: ["Rohan", "Job alerts", "#5a5fc9", "round", "bolt", "one", "line",
    "Reads your job-alert emails and tells you which new jobs are worth opening."],
  weekly_digest: ["Anika", "Weekly summary", "#6f9a32", "dome", "dish", "happy", "line",
    "Sends a Monday note: strong matches, follow-ups due and replies."],
  morning: ["Sam", "Morning routine", "#c98a1c", "round", "ball", "happy", "smile",
    "Syncs your mail each morning and lists what needs you today."],
  email_finder: ["Vikram", "Email finder", "#1f7a70", "square", "bolt", "dots", "line",
    "Finds the hiring addresses companies publish on their own websites."],
  supervisor: ["Atlas", "Supervisor", "#5b6472", "square", "twin", "visor", "grille",
    "Watches every agent and stops one that misbehaves."],
};

const crew = id => CREW[id] || [id.replace(/_/g, " ").replace(/^./, c => c.toUpperCase()), "Agent", "#64748b", "round", "ball", "dots", "line", ""];
export const agentName = id => crew(id)[0];
export const agentRole = id => crew(id)[1];
export const agentColor = id => crew(id)[2];
export const agentAbout = id => crew(id)[7];
export const agentLabel = id => `${agentName(id)} · ${agentRole(id)}`;

const HEADS = {
  round: <rect x="14" y="20" width="36" height="30" rx="14" />,
  square: <rect x="14" y="20" width="36" height="30" rx="6" />,
  dome: <path d="M14 36a18 17 0 0 1 36 0v8a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6z" />,
};
const ANTENNAS = {
  ball: <><line x1="32" y1="20" x2="32" y2="12" /><circle cx="32" cy="10" r="3" className="rb-fill" /></>,
  twin: <><line x1="25" y1="21" x2="21" y2="12" /><line x1="39" y1="21" x2="43" y2="12" />
    <circle cx="21" cy="11" r="2.4" className="rb-fill" /><circle cx="43" cy="11" r="2.4" className="rb-fill" /></>,
  bolt: <polyline points="33,7 29,14 35,14 31,21" fill="none" />,
  dish: <><line x1="32" y1="20" x2="32" y2="14" /><path d="M24 13a8 5 0 0 0 16 0z" className="rb-fill" /></>,
};
const EYES = {
  dots: <><circle cx="26" cy="33" r="3" /><circle cx="38" cy="33" r="3" /></>,
  wide: <><ellipse cx="25.5" cy="33" rx="4" ry="3" /><ellipse cx="38.5" cy="33" rx="4" ry="3" /></>,
  visor: <rect x="21" y="30.5" width="22" height="5" rx="2.5" />,
  one: <circle cx="32" cy="33" r="4.2" />,
  happy: <path d="M22.5 34.5q3.5-4.5 7 0M34.5 34.5q3.5-4.5 7 0" fill="none" strokeWidth="2.2" className="rb-line" />,
};
const MOUTHS = {
  line: <line x1="28" y1="44.5" x2="36" y2="44.5" />,
  smile: <path d="M27 43.5q5 3.5 10 0" fill="none" />,
  grille: <><line x1="27" y1="43" x2="27" y2="46" /><line x1="30.5" y1="43" x2="30.5" y2="46" />
    <line x1="34" y1="43" x2="34" y2="46" /><line x1="37.5" y1="43" x2="37.5" y2="46" /></>,
};

// The agent's robot. `working` makes it blink.
export function Robot({ id, size = 56, working = false }) {
  const [, , color, head, antenna, eyes, mouth] = crew(id);
  const clip = `rb-${id}`;
  return (
    <svg className={`robot ${working ? "working" : ""}`} width={size} height={size} viewBox="0 0 64 64" role="img"
      aria-label={`${agentName(id)}, the ${agentRole(id).toLowerCase()} robot`} style={{ "--rb": color }}>
      <defs><clipPath id={clip}><circle cx="32" cy="32" r="32" /></clipPath></defs>
      <g clipPath={`url(#${clip})`}>
        <circle cx="32" cy="32" r="32" className="rb-bg" />
        <rect x="18" y="52" width="28" height="16" rx="7" className="rb-body" />
        <g className="rb-stroke">{ANTENNAS[antenna]}</g>
        <rect x="10" y="30" width="5" height="11" rx="2.5" className="rb-body" />
        <rect x="49" y="30" width="5" height="11" rx="2.5" className="rb-body" />
        <g className="rb-head">{HEADS[head]}</g>
        <rect x="19" y="26" width="26" height="14" rx="6" className="rb-screen" />
        <g className="rb-eyes">{EYES[eyes]}</g>
        <g className="rb-mouth">{MOUTHS[mouth]}</g>
      </g>
    </svg>
  );
}
