import { useState, useRef, useEffect } from "react";
import { Send, Bot, Sparkles } from "lucide-react";
import { aiApi } from "../services/endpoints";

const QUICK = ["Explain this simply", "Give me an example", "Why does this matter?"];

// Answers stream in word by word, so the first text appears as soon as the model starts writing.
const AIChatbot = ({ reelId, reelTitle }) => {
  const [messages, setMessages] = useState([
    { role: "assistant", text: `Hi! I'm your AI tutor for "${reelTitle}". Ask me anything about this topic.` },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);       // a request is in flight
  const [waiting, setWaiting] = useState(false);  // ...and no text has arrived yet (show typing dots)
  const [error, setError] = useState("");
  const scrollRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []); // stop streaming if the user leaves
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, waiting]);

  const ask = async (raw) => {
    const question = raw.trim();
    if (!question || busy) return;
    setError(""); setInput(""); setBusy(true); setWaiting(true);
    const history = messages.slice(1); // without the greeting
    setMessages((m) => [...m, { role: "user", text: question }]);

    const ctrl = new AbortController(); abortRef.current = ctrl;
    let started = false;
    try {
      await aiApi.chatStream(reelId, question, history, {
        signal: ctrl.signal,
        onToken: (piece) => {
          if (!started) { started = true; setWaiting(false); setMessages((m) => [...m, { role: "assistant", text: piece }]); }
          else setMessages((m) => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: c[c.length - 1].text + piece }; return c; });
        },
      });
    } catch (err) {
      if (err.name === "AbortError") return;
      if (!started && !err.status) {
        // streaming blocked (old proxy/network): fall back to a normal request
        try {
          const { data } = await aiApi.chat(reelId, question, history);
          setMessages((m) => [...m, { role: "assistant", text: data.answer }]);
        } catch (e2) { setError(e2.response?.data?.message || "The AI tutor is unavailable right now."); }
      } else setError(err.message || "The AI tutor is unavailable right now.");
    } finally { setBusy(false); setWaiting(false); }
  };

  return (
    <div className="card flex flex-col h-[480px]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border dark:border-surface-border-dark">
        <Bot className="h-5 w-5 text-brand-600" />
        <h3 className="font-semibold text-sm">Ask the AI Tutor</h3>
        <Sparkles className="h-3.5 w-3.5 text-brand-400 ml-auto" />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
              m.role === "user" ? "bg-brand-600 text-white rounded-br-sm" : "bg-brand-50 dark:bg-surface-card-dark rounded-bl-sm"}`}>
              {m.text}
            </div>
          </div>
        ))}
        {waiting && (
          <div className="flex justify-start" aria-label="The tutor is typing">
            <div className="bg-brand-50 dark:bg-surface-card-dark rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
              {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
            </div>
          </div>
        )}
        {error && <p role="alert" className="text-xs text-error">{error}</p>}
        {messages.length === 1 && !busy && (
          <div className="flex flex-wrap gap-2 pt-1">
            {QUICK.map((q) => <button key={q} onClick={() => ask(q)} className="text-xs rounded-full border border-brand-500/40 text-brand-500 px-3 py-1.5 hover:bg-brand-500/10">{q}</button>)}
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex items-center gap-2 p-3 border-t border-surface-border dark:border-surface-border-dark">
        <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} placeholder="Ask a question about this topic..." className="input flex-1" />
        <button type="submit" disabled={busy || !input.trim()} className="btn-primary p-2.5" aria-label="Send"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  );
};

export default AIChatbot;
