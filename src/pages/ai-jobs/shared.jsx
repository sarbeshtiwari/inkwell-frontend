
export const SOURCES = [
  ["career_sites", "Company career sites", "Greenhouse, Lever, Ashby, Workable & more. No key needed.", null],
  ["remote_boards", "Job boards", "55+ boards: remote, tech, big employers and your country’s. No key needed.", null],
];

export const tone = s => (s >= 80 ? "great" : s >= 65 ? "good" : s >= 50 ? "fair" : "low");
