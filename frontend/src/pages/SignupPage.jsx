import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import API from "../api";
import { Mail, Lock, User, ShieldAlert, CheckCircle2, Compass } from "lucide-react";
import { motion } from "framer-motion";

export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite_token");
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await API.post("/auth/signup", { 
        ...formData, 
        invite_token: inviteToken || undefined 
      });

      const email = response.data.email;

      // Redirect to verification page
      const inviteQuery = inviteToken ? `&invite_token=${encodeURIComponent(inviteToken)}` : "";
      navigate(`/verify-email?email=${encodeURIComponent(email)}${inviteQuery}`);
    } catch (err) {
      console.error("Signup error:", err);
      setError(err.response?.data?.detail || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-73px)] flex items-center justify-center px-4 py-12 bg-brand-bg">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white p-8 rounded-2xl border border-slate-200 shadow-xl"
      >
        <div className="text-center mb-8">
          <div className="inline-flex p-3 bg-sky-50 border border-sky-100 text-brand-secondary rounded-2xl mb-4">
            <Compass className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Create Account</h2>
          <p className="text-xs text-slate-500 mt-2">Join Travel Trip and plan together</p>
        </div>

        {inviteToken && (
          <div className="mb-6 flex items-start gap-2.5 bg-emerald-50 border border-emerald-100 p-3.5 rounded-xl text-emerald-700 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="font-semibold text-left">You have a workspace invite pending! Sign up to join the shared trip planner.</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5 text-left">
            <label htmlFor="username" className="text-xs font-bold uppercase tracking-wider text-slate-500">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-1 focus:ring-brand-secondary focus:border-transparent outline-none transition-all"
                placeholder="Choose a username"
              />
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-500">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-1 focus:ring-brand-secondary focus:border-transparent outline-none transition-all"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="space-y-1.5 text-left">
            <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength="6"
                className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 focus:ring-1 focus:ring-brand-secondary focus:border-transparent outline-none transition-all"
                placeholder="Min. 6 characters"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-600 p-3.5 rounded-xl text-xs font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span className="text-left">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-brand-accent to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-extrabold rounded-xl shadow-md disabled:opacity-50 transition-all text-xs uppercase tracking-wider cursor-pointer border-none"
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-500">
          <p>
            Already have an account?{" "}
            <Link
              to={inviteToken ? `/login?invite_token=${encodeURIComponent(inviteToken)}` : "/login"}
              className="text-brand-secondary font-bold hover:underline"
            >
              Login here
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
