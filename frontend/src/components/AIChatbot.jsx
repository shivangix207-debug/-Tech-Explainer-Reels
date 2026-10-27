import { useState, useRef, useEffect } from "react";
import { Send, Bot, Sparkles } from "lucide-react";
import { aiApi } from "../services/endpoints";
import Spinner from "./Spinner";

const AIChatbot = ({ reelId, reelTitle }) => {
  const [messages, setMessages] = useState([
    { role: "assistant", text: `Hi! I'm your AI tutor for "${reelTitle}". Ask me anything about this topic.` },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (e) => {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setError("");
    const newMessages = [...messages, { role: "user", text: question }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const history = newMessages.slice(1); // exclude the initial greeting
      const { data } = await aiApi.chat(reelId, question, history);
      setMessages((m) => [...m, { role: "assistant", text: data.answer }]);
    } catch (err) {
      setError(err.response?.data?.message || "AI service is unavailable right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card flex flex-col h-[480px]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-border dark:border-surface-border-dark">
        <Bot className="h-5 w-5 text-brand-600" />
        <h3 className="font-semibold text-sm">Ask the AI Tutor</h3>
        <Sparkles className="h-3.5 w-3.5 text-brand-400 ml-auto" />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
                m.role === "user"
                  ? "bg-brand-600 text-white rounded-br-sm"
                  : "bg-brand-50 dark:bg-surface-card-dark rounded-bl-sm"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-brand-50 dark:bg-surface-card-dark rounded-2xl rounded-bl-sm px-4 py-3">
              <Spinner size="sm" />
            </div>
          </div>
        )}
        {error && <p className="text-xs text-error">{error}</p>}
      </div>

      <form onSubmit={send} className="flex items-center gap-2 p-3 border-t border-surface-border dark:border-surface-border-dark">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this topic..."
          className="input flex-1"
        />
        <button type="submit" disabled={loading} className="btn-primary p-2.5" aria-label="Send">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};

export default AIChatbot;
