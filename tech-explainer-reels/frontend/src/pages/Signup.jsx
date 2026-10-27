import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { categoriesApi } from "../services/endpoints";
import { UserPlus, Check } from "lucide-react";

const Signup = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: "", email: "", password: "", accountType: "student" });
  const [skillLevel, setSkillLevel] = useState("beginner");
  const [interests, setInterests] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    categoriesApi.list().then(({ data }) => setCategories(data.categories));
  }, []);

  const toggleInterest = (id) => {
    setInterests((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : prev.length < 5 ? [...prev, id] : prev));
  };

  const goToStep2 = (e) => {
    e.preventDefault();
    setStep(2);
  };

  const finish = async () => {
    setError("");
    setLoading(true);
    try {
      await signup(form.name, form.email, form.password, { interests, skillLevel, accountType: form.accountType });
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.message || "Signup failed. Please try again.");
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md card p-8 animate-slide-up">
        <div className="flex justify-center mb-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white">
            <UserPlus className="h-6 w-6" />
          </div>
        </div>

        {step === 1 ? (
          <>
            <h1 className="text-2xl font-display font-bold text-center">Create your account</h1>
            <p className="text-center text-sm text-ink-light/60 dark:text-ink-dark/50 mt-1">Start learning tech in 60-second reels</p>

            {error && (
              <div className="mt-4 rounded-xl bg-error/10 text-error text-sm px-4 py-3">{error}</div>
            )}

            <form onSubmit={goToStep2} className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Full name</label>
                <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Alex Johnson" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Email</label>
                <input type="email" required className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">I want to</label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[["student", "Learn"], ["creator", "Learn & create lessons"]].map(([v, l]) => (
                    <button type="button" key={v} onClick={() => setForm({ ...form, accountType: v })} className={`rounded-xl border px-3 py-2 text-sm font-medium transition ${form.accountType === v ? "border-brand-500 bg-brand-500/10 text-brand-500" : "border-surface-border dark:border-surface-border-dark"}`}>{l}</button>
                  ))}
                </div>
                <label className="text-sm font-medium mb-1 block">Password</label>
                <input type="password" required minLength={8} className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" />
              </div>
              <button type="submit" className="btn-primary w-full">Continue</button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-display font-bold text-center">What are you into?</h1>
            <p className="text-center text-sm text-ink-light/60 dark:text-ink-dark/50 mt-1">Pick 3-5 topics to personalize your feed</p>

            <div className="flex flex-wrap gap-2 justify-center mt-6">
              {categories.map((c) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => toggleInterest(c._id)}
                  className={`badge border gap-1 ${interests.includes(c._id) ? "bg-brand-600 text-white border-brand-600" : "border-surface-border dark:border-surface-border-dark"}`}
                >
                  {interests.includes(c._id) && <Check className="h-3 w-3" />} {c.name}
                </button>
              ))}
            </div>

            <div className="mt-6">
              <label className="text-sm font-medium mb-1 block">Your skill level</label>
              <div className="grid grid-cols-3 gap-2">
                {["beginner", "intermediate", "advanced"].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSkillLevel(lvl)}
                    className={`rounded-xl border py-2 text-sm font-medium capitalize ${skillLevel === lvl ? "bg-brand-600 text-white border-brand-600" : "border-surface-border dark:border-surface-border-dark"}`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-error mt-4">{error}</p>}

            <button onClick={finish} disabled={loading} className="btn-primary w-full mt-6">
              {loading ? "Creating account..." : interests.length ? `Continue with ${interests.length} interest${interests.length > 1 ? "s" : ""}` : "Skip for now"}
            </button>
          </>
        )}

        <p className="text-center text-sm text-ink-light/60 dark:text-ink-dark/50 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-600 font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
