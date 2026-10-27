import { useState } from "react";
import { HelpCircle, Sparkles, CheckCircle2, XCircle, RotateCcw, BookOpenCheck } from "lucide-react";
import { aiApi } from "../services/endpoints";
import { useAuth } from "../context/AuthContext";
import Spinner from "./Spinner";

// Questions arrive WITHOUT answers. The server holds the key and grades the submission, so nothing
// the browser does can change the score.
const AIQuiz = ({ reelId, hasLessonQuiz = false }) => {
  const { refreshUser } = useAuth();
  const [session, setSession] = useState(null); // { sessionId, source, questions }
  const [answers, setAnswers] = useState([]);
  const [outcome, setOutcome] = useState(null); // { result, review, gamification }
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const start = async (source) => {
    setLoading(true); setError(""); setOutcome(null); setAnswers([]);
    try {
      const { data } = await aiApi.startQuiz(reelId, source, 5);
      setSession(data);
    } catch (err) {
      setSession(null);
      setError(err.response?.data?.message || "Couldn't start the quiz. Please try again.");
    } finally { setLoading(false); }
  };

  const submit = async () => {
    setSubmitting(true); setError("");
    try {
      const { data } = await aiApi.submitQuiz(reelId, session.sessionId, session.questions.map((_, i) => (answers[i] ?? null)));
      setOutcome(data);
      refreshUser?.();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't submit the quiz.");
    } finally { setSubmitting(false); }
  };

  const allAnswered = session && session.questions.every((_, i) => Number.isInteger(answers[i]));

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2"><HelpCircle className="h-5 w-5 text-brand-500" /> Quiz</h3>
        {session && (
          <button onClick={() => { setSession(null); setOutcome(null); setError(""); }} className="text-xs font-medium text-brand-500 flex items-center gap-1 hover:underline">
            <RotateCcw className="h-3.5 w-3.5" /> New quiz
          </button>
        )}
      </div>

      {!session && !loading && (
        <div className="space-y-2">
          {hasLessonQuiz && (
            <button onClick={() => start("lesson")} className="btn-primary w-full"><BookOpenCheck className="h-4 w-4" /> Take the lesson quiz</button>
          )}
          <button onClick={() => start("ai")} className={`${hasLessonQuiz ? "btn-secondary" : "btn-primary"} w-full`}>
            <Sparkles className="h-4 w-4" /> Generate a quiz with AI
          </button>
          <p className="text-xs text-ink-light/55 dark:text-ink-dark/50 pt-1">
            {hasLessonQuiz ? "The lesson quiz is hand-written and works offline from the AI. " : ""}AI quizzes are generated from this lesson's transcript and validated before you see them.
          </p>
        </div>
      )}

      {loading && <div className="py-8"><Spinner full={false} /></div>}
      {error && <p role="alert" className="text-sm text-error mt-2">{error}</p>}

      {outcome && (
        <div className="mb-5 rounded-xl bg-brand-500/10 border border-brand-500/20 p-4 text-center animate-fade-in">
          <p className="text-3xl font-extrabold text-brand-500">{outcome.result.percentage}%</p>
          <p className="text-sm text-ink-light/75 dark:text-ink-dark/60">{outcome.result.score} of {outcome.result.totalQuestions} correct</p>
          {outcome.gamification && <p className="text-xs mt-1 text-accent-500">+{outcome.gamification.xpGained} XP</p>}
        </div>
      )}

      {session && !loading && (
        <div className="space-y-5">
          {session.questions.map((q, i) => {
            const r = outcome?.review?.[i];
            return (
              <div key={i} className="pb-4 border-b border-surface-border dark:border-surface-border-dark last:border-0">
                <p className="font-medium text-sm mb-2 flex items-start gap-2">
                  <span className="text-ink-light/45 dark:text-ink-dark/40">{i + 1}.</span> <span className="flex-1">{q.question}</span>
                  {r && (r.isCorrect ? <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-error shrink-0 mt-0.5" />)}
                </p>
                <div className="space-y-1.5" role="radiogroup">
                  {q.options.map((opt, j) => {
                    const chosen = answers[i] === j;
                    const isRight = r && j === r.correctIndex;
                    const isWrongPick = r && chosen && !r.isCorrect;
                    return (
                      <label key={j} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${outcome ? "cursor-default" : "cursor-pointer"} ${
                        isRight ? "border-success bg-success/10" : isWrongPick ? "border-error bg-error/10"
                        : chosen ? "border-brand-500 bg-brand-500/10" : "border-surface-border dark:border-surface-border-dark hover:border-brand-400"}`}>
                        <input type="radio" disabled={!!outcome} name={`q-${i}`} checked={chosen} onChange={() => setAnswers((a) => { const n = [...a]; n[i] = j; return n; })} />
                        {opt}
                      </label>
                    );
                  })}
                </div>
                {r && <p className="text-xs mt-2 text-ink-light/70 dark:text-ink-dark/60"><span className="font-semibold">Why:</span> {r.explanation}</p>}
              </div>
            );
          })}
          {!outcome && (
            <button onClick={submit} disabled={!allAnswered || submitting} className="btn-primary w-full">
              {submitting ? "Grading..." : allAnswered ? "Submit answers" : "Answer every question to submit"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AIQuiz;
