export function getSessionDurationSeconds(
  session: { state: string; createdAt: string; updatedAt: string },
  now?: number
): number | null;
