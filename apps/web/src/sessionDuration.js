export function getSessionDurationSeconds(session, now = Date.now()) {
  const startedAt = Date.parse(session.createdAt);
  const endedAt = session.state === "completed" || session.state === "failed"
    ? Date.parse(session.updatedAt)
    : now;

  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt)) {
    return null;
  }

  return Math.max(0, Math.floor((endedAt - startedAt) / 1000));
}
