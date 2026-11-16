
export const SOURCES = [
  ["career_sites", "Company career sites", "Greenhouse, Lever, Ashby, Workable & more. No key needed.", null],
  ["remote_boards", "Job boards", "55+ boards: remote, tech, big employers and your country’s. No key needed.", null],
  ["tavily", "Tavily web search", "Search built for AI agents. Free: 1,000 searches a month, no card needed.", "https://app.tavily.com"],
  ["brave", "Brave web search", "Independent web search. $5 free credit a month (about 1,000 searches); needs a card.", "https://api-dashboard.search.brave.com"],
];

export const tone = s => (s >= 80 ? "great" : s >= 65 ? "good" : s >= 50 ? "fair" : "low");
