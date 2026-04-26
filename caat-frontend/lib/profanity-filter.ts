// Basic profanity filter for community post and comment submissions.
// Checks for whole-word matches only (ignores partial matches inside longer words).
const BLOCKED: string[] = [
  "fuck", "fucker", "fucking", "f**k",
  "shit", "shitting", "sh*t",
  "bitch", "b*tch",
  "asshole", "ass hole",
  "cunt", "c*nt",
  "nigger", "nigga",
  "faggot", "fag",
  "whore", "wh*re",
  "bastard",
  "dick", "cock", "pussy",
  "retard", "retarded",
];

const PATTERN = new RegExp(
  `\\b(${BLOCKED.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`,
  "i"
);

export function containsProfanity(text: string): boolean {
  return PATTERN.test(text);
}
