import { useEffect, useMemo, useState } from "react";
import {
  fetchCallQa,
  fetchCalls,
  fetchRecipes,
  fetchSessions,
  triggerDemoCall,
  type CallSummary,
  type QaCallDetail,
  type SessionSummary
} from "./api";

const REFRESH_MS = 2500;

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function verdictClass(verdict: string | null): string {
  if (verdict === "pass") return "badge-pass";
  if (verdict === "warning") return "badge-warning";
  if (verdict === "fail") return "badge-fail";
  return "badge-neutral";
}

export function App() {
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedRecipeId, setSelectedRecipeId] = useState("lead-qualification");
  const [selectedProvider, setSelectedProvider] = useState<"twilio" | "livekit" | "mock">("mock");
  const [recipes, setRecipes] = useState<string[]>([]);
  const [qaDetail, setQaDetail] = useState<QaCallDetail | null>(null);
  const [qaStatus, setQaStatus] = useState<"idle" | "pending" | "ready">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function refreshOverview(): Promise<void> {
    try {
      const [loadedCalls, loadedSessions] = await Promise.all([fetchCalls(), fetchSessions()]);
      setCalls(loadedCalls);
      setSessions(loadedSessions);

      const firstCall = loadedCalls[0];
      if (!selectedCallId && firstCall) {
        setSelectedCallId(firstCall.callId);
      }

      const firstSession = loadedSessions[0];
      if (!selectedSessionId && firstSession) {
        setSelectedSessionId(firstSession.sessionId);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load overview");
    }
  }

  useEffect(() => {
    fetchRecipes()
      .then((loadedRecipes) => {
        setRecipes(loadedRecipes);
        const firstRecipe = loadedRecipes[0];
        if (firstRecipe) {
          setSelectedRecipeId(firstRecipe);
        }
      })
      .catch(() => undefined);

    refreshOverview().catch(() => undefined);

    const interval = window.setInterval(() => {
      refreshOverview().catch(() => undefined);
    }, REFRESH_MS);

    return () => {
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCallId) {
      setQaDetail(null);
      setQaStatus("idle");
      return;
    }
    const callId = selectedCallId;

    let cancelled = false;

    async function refreshQa(): Promise<void> {
      try {
        const result = await fetchCallQa(callId);

        if (cancelled) {
          return;
        }

        if (result.status === "pending") {
          setQaStatus("pending");
          setQaDetail(null);
          return;
        }

        setQaStatus("ready");
        setQaDetail(result.call ?? null);
      } catch (qaError) {
        if (!cancelled) {
          setError(qaError instanceof Error ? qaError.message : "Failed to fetch QA detail");
        }
      }
    }

    refreshQa().catch(() => undefined);

    const interval = window.setInterval(() => {
      refreshQa().catch(() => undefined);
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [selectedCallId]);

  const selectedCall = useMemo(
    () => calls.find((call) => call.callId === selectedCallId) ?? null,
    [calls, selectedCallId]
  );

  const selectedSession = useMemo(
    () => sessions.find((session) => session.sessionId === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">open-bpo / QualiaBits</p>
          <h1>AI BPO Operations Console</h1>
          <p className="subtitle">
            Local mock deployment with inbound/outbound call simulation, live session lifecycle, checklist QA scoring, and
            reproducible APIs.
          </p>
        </div>

        <div className="hero-controls">
          <label>
            Recipe
            <select value={selectedRecipeId} onChange={(event) => setSelectedRecipeId(event.target.value)}>
              {recipes.map((recipeId) => (
                <option key={recipeId} value={recipeId}>
                  {recipeId}
                </option>
              ))}
            </select>
          </label>

          <label>
            Provider
            <select
              value={selectedProvider}
              onChange={(event) => setSelectedProvider(event.target.value as "twilio" | "livekit" | "mock")}
            >
              <option value="mock">mock</option>
              <option value="twilio">twilio-stub</option>
              <option value="livekit">livekit-stub</option>
            </select>
          </label>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={async () => {
              setIsSubmitting(true);
              setError(null);
              try {
                const result = await triggerDemoCall({
                  direction: "inbound",
                  recipeId: selectedRecipeId,
                  provider: selectedProvider
                });
                await refreshOverview();
                setSelectedCallId(result.callId);
                if (result.sessionId) {
                  setSelectedSessionId(result.sessionId);
                }
              } catch (submitError) {
                setError(submitError instanceof Error ? submitError.message : "Failed to create inbound demo");
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            {isSubmitting ? "Working…" : "Simulate inbound call"}
          </button>

          <button
            type="button"
            disabled={isSubmitting}
            className="secondary"
            onClick={async () => {
              setIsSubmitting(true);
              setError(null);
              try {
                const result = await triggerDemoCall({
                  direction: "outbound",
                  recipeId: selectedRecipeId,
                  provider: selectedProvider
                });
                await refreshOverview();
                setSelectedCallId(result.callId);
                if (result.sessionId) {
                  setSelectedSessionId(result.sessionId);
                }
              } catch (submitError) {
                setError(submitError instanceof Error ? submitError.message : "Failed to create outbound demo");
              } finally {
                setIsSubmitting(false);
              }
            }}
          >
            {isSubmitting ? "Working…" : "Simulate outbound call"}
          </button>
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <main className="layout-grid">
        <section className="panel calls">
          <div className="panel-header">
            <h2>Calls</h2>
            <span>{calls.length} records</span>
          </div>

          {calls.length === 0 ? (
            <p className="empty">No calls yet. Trigger inbound or outbound simulation.</p>
          ) : (
            <ul className="call-list">
              {calls.map((call) => (
                <li key={call.callId}>
                  <button
                    type="button"
                    className={call.callId === selectedCallId ? "call-item active" : "call-item"}
                    onClick={() => setSelectedCallId(call.callId)}
                  >
                    <div>
                      <strong>{call.callId}</strong>
                      <p>
                        {call.direction.toUpperCase()} • {formatDateTime(call.createdAt)}
                      </p>
                    </div>
                    <div className="call-meta">
                      <span className={`mini-badge ${verdictClass(call.verdict)}`}>
                        {call.qaPercent === null ? "PENDING" : `${Math.round(call.qaPercent)}%`}
                      </span>
                      <span className="mini-badge badge-neutral">{call.latestSessionState ?? "no-session"}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel qa">
          <div className="panel-header">
            <h2>QA Detail</h2>
            <span>{selectedCall?.recipeId ?? "-"}</span>
          </div>

          {!selectedCall ? (
            <p className="empty">Select a call to inspect QA details.</p>
          ) : qaStatus === "pending" ? (
            <p className="empty">Scoring call {selectedCall.callId}...</p>
          ) : !qaDetail?.qa ? (
            <p className="empty">No QA result yet for this call.</p>
          ) : (
            <>
              <div className="qa-summary">
                <div>
                  <p className="label">Verdict</p>
                  <p className={`verdict ${qaDetail.qa.verdict}`}>{qaDetail.qa.verdict.toUpperCase()}</p>
                </div>
                <div>
                  <p className="label">Score</p>
                  <p>
                    {qaDetail.qa.finalScore}/{qaDetail.qa.maxPossible} ({qaDetail.qa.qaPercent}%)
                  </p>
                </div>
                <div>
                  <p className="label">Fatal errors</p>
                  <p>{qaDetail.qa.hasFatalErrors ? "Yes" : "No"}</p>
                </div>
              </div>

              <h3>Transcript</h3>
              <ul className="transcript-list">
                {qaDetail.transcript.map((turn, index) => (
                  <li key={`${turn.timestamp}-${index}`}>
                    <span className="speaker">{turn.speaker}</span>
                    <p>{turn.text}</p>
                  </li>
                ))}
              </ul>

              <h3>Checklist breakdown</h3>
              <ul className="breakdown-list">
                {qaDetail.qa.result.breakdown.map((item) => (
                  <li key={item.id}>
                    <div className="breakdown-top">
                      <strong>{item.title}</strong>
                      <span>
                        {item.score}/{item.maxScore}
                      </span>
                    </div>
                    <p>{item.rationale}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className="panel sessions">
          <div className="panel-header">
            <h2>Live Sessions</h2>
            <span>{sessions.length} records</span>
          </div>

          {sessions.length === 0 ? (
            <p className="empty">No sessions yet. Demo calls can auto-create sessions.</p>
          ) : (
            <div className="session-layout">
              <ul className="session-list">
                {sessions.map((session) => (
                  <li key={session.sessionId}>
                    <button
                      type="button"
                      className={session.sessionId === selectedSessionId ? "session-item active" : "session-item"}
                      onClick={() => setSelectedSessionId(session.sessionId)}
                    >
                      <strong>{session.sessionId.slice(0, 8)}…</strong>
                      <p>{session.callId}</p>
                      <span className="mini-badge badge-neutral">{session.state}</span>
                    </button>
                  </li>
                ))}
              </ul>

              <div className="session-detail">
                {!selectedSession ? (
                  <p className="empty">Select a session to inspect trace.</p>
                ) : (
                  <>
                    <p>
                      <strong>Call:</strong> {selectedSession.callId}
                    </p>
                    <p>
                      <strong>Direction:</strong> {selectedSession.direction}
                    </p>
                    <p>
                      <strong>Provider:</strong> {selectedSession.provider}
                    </p>
                    <p>
                      <strong>State:</strong> {selectedSession.state}
                    </p>
                    <p>
                      <strong>External ID:</strong> {selectedSession.externalSessionId ?? "-"}
                    </p>
                    <p>
                      <strong>Updated:</strong> {formatDateTime(selectedSession.updatedAt)}
                    </p>
                    {selectedSession.error && <p className="session-error">{selectedSession.error}</p>}

                    <h3>Trace</h3>
                    {selectedSession.trace && selectedSession.trace.length > 0 ? (
                      <pre>{selectedSession.trace.join("\n")}</pre>
                    ) : (
                      <p className="empty">Trace not available yet.</p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
