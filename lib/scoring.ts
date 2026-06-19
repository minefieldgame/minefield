export const SNIPPET_LENGTHS = [0.25, 0.5, 1, 2, 4, 8, 12] as const;
export const SCORES = [100, 90, 80, 65, 50, 35, 20] as const;

export function scoreForAttempt(attempt: number) {
  return SCORES[attempt] ?? 0;
}
