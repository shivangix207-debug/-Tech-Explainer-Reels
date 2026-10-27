import { useState } from "react";
import { FileText, Sparkles, RefreshCw, Copy, Info } from "lucide-react";
import { aiApi } from "../services/endpoints";
import { useToast } from "../context/ToastContext";
import Spinner from "./Spinner";

const Section = ({ title, children }) => (
  <div>
    <p className="font-semibold text-ink-light/60 dark:text-ink-dark/50 text-xs uppercase tracking-wide mb-1">{title}</p>
    {children}
  </div>
);
const List = ({ items }) => <ul className="list-disc list-inside space-y-1">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>;

const toText = (n) => [
  `SUMMARY\n${n.summary}`, `KEY POINTS\n${(n.keyPoints || []).map((x) => `- ${x}`).join("\n")}`,
  n.importantTerms?.length ? `TERMS\n${n.importantTerms.map((t) => `- ${t.term}: ${t.definition}`).join("\n")}` : "",
  n.examples?.length ? `EXAMPLES\n${n.examples.map((x) => `- ${x}`).join("\n")}` : "",
  n.revisionNotes?.length ? `REVISION\n${n.revisionNotes.map((x) => `- ${x}`).join("\n")}` : "",
  n.interviewQuestions?.length ? `INTERVIEW QUESTIONS\n${n.interviewQuestions.map((x) => `- ${x}`).join("\n")}` : "",
].filter(Boolean).join("\n\n");

const AINotes = ({ reelId }) => {
  const toast = useToast();
  const [data, setData] = useState(null); // { notes, source, notice }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    setLoading(true); setError("");
    try {
      const res = await aiApi.notes(reelId);
      setData(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't generate notes right now.");
    } finally { setLoading(false); }
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(toText(data.notes)); toast("Notes copied", "success"); }
    catch { toast("Couldn't copy - select the text manually", "error"); }
  };
  const notes = data?.notes;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2"><FileText className="h-5 w-5 text-brand-500" /> Study notes</h3>
        {notes && (
          <div className="flex items-center gap-3">
            <button onClick={copy} className="text-xs font-medium text-brand-500 flex items-center gap-1 hover:underline"><Copy className="h-3.5 w-3.5" /> Copy</button>
            <button onClick={generate} disabled={loading} className="text-xs font-medium text-brand-500 flex items-center gap-1 hover:underline"><RefreshCw className="h-3.5 w-3.5" /> Regenerate</button>
          </div>
        )}
      </div>

      {!notes && !loading && (
        <button onClick={generate} className="btn-primary w-full"><Sparkles className="h-4 w-4" /> Generate notes with AI</button>
      )}
      {loading && <div className="py-8"><Spinner full={false} /></div>}
      {error && <p role="alert" className="text-sm text-error mt-2">{error}</p>}

      {notes && !loading && (
        <div className="space-y-4 text-sm animate-fade-in">
          {data.source === "lesson" && (
            <div className="flex gap-2 rounded-lg bg-gold-400/10 border border-gold-400/30 p-3 text-xs">
              <Info className="h-4 w-4 text-gold-500 shrink-0 mt-0.5" /> <span>{data.notice}</span>
            </div>
          )}
          <Section title="Summary"><p>{notes.summary}</p></Section>
          {notes.keyPoints?.length > 0 && <Section title="Key points"><List items={notes.keyPoints} /></Section>}
          {notes.importantTerms?.length > 0 && (
            <Section title="Important terms">
              <div className="space-y-1.5">{notes.importantTerms.map((t, i) => <p key={i}><span className="font-medium">{t.term}:</span> {t.definition}</p>)}</div>
            </Section>
          )}
          {notes.examples?.length > 0 && <Section title="Examples"><List items={notes.examples} /></Section>}
          {notes.revisionNotes?.length > 0 && <Section title="Revision points"><List items={notes.revisionNotes} /></Section>}
          {notes.interviewQuestions?.length > 0 && <Section title="Interview questions"><List items={notes.interviewQuestions} /></Section>}
        </div>
      )}
    </div>
  );
};

export default AINotes;
