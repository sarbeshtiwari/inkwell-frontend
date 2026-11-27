
// Every search uses all of these; shown on the AI job match page, not chosen.
export const SOURCES = [
  ["Company career sites", "Greenhouse, Lever, Ashby, Workable & more"],
  ["Job boards", "55+ boards: remote, tech, big employers and your country’s"],
];

export const tone = s => (s >= 80 ? "great" : s >= 65 ? "good" : s >= 50 ? "fair" : "low");
