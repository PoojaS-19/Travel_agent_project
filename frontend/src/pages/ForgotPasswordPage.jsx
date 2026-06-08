import { useState } from "react";
import { Link } from "react-router-dom";
import API from "../api";
import { Compass, Mail, Lock, ShieldAlert, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await API.post("/auth/forgot-password", { email });
      setResetToken(response.data.reset_token || "");
      setMessage(response.data.message || "Reset code generated.");
    } catch (err) {
      console.error("Forgot password error:", err);
      setError(err.response?.data?.detail || "Could not generate reset code.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await API.post("/auth/reset-password", {
        email,
        reset_token: resetToken,
        new_password: newPassword
      });
      setMessage(response.data.message || "Password reset successfully.");
      setNewPassword("");
      setResetToken("");
    } catch (err) {
      console.error("Reset password error:", err);
      setError(err.response?.data?.detail || "Password reset failed.");
    } finally {
      setResetLoading(false);
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
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Reset Password</h2>
          <p className="text-xs text-slate-500 mt-2">Recover access to your account</p>
        </div>

        <form onSubmit={handleRequestReset} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-500">Account Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-slate-250 rounded-xl text-slate-900 focus:ring-1 focus:ring-brand-secondary focus:border-transparent outline-none transition-all"
                placeholder="Enter your email"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-brand-secondary hover:bg-blue-600 text-white font-extrabold rounded-xl shadow-md disabled:opacity-50 transition-all text-xs uppercase tracking-wider cursor-pointer border-none"
          >
            {loading ? "Generating Code..." : "Get Reset Code"}
          </button>
        </form>

        <div className="relative flex py-5 items-center">
          <div className="flex-grow border-t border-slate-200"></div>
          <span className="flex-shrink mx-4 text-slate-400 text-xs font-bold">OR</span>
          <div className="flex-grow border-t border-slate-200"></div>
        </div>

        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label htmlFor="resetToken" className="text-xs font-bold uppercase tracking-wider text-slate-500">Reset Code</label>
            <input
              type="text"
              id="resetToken"
              name="resetToken"
              value={resetToken}
              onChange={(e) => setResetToken(e.target.value)}
              required
              className="w-full px-3 py-3 text-sm bg-white border border-slate-250 rounded-xl text-slate-900 focus:ring-1 focus:ring-brand-secondary focus:border-transparent outline-none transition-all"
              placeholder="Paste your reset code"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <label htmlFor="newPassword" className="text-xs font-bold uppercase tracking-wider text-slate-500">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="password"
                id="newPassword"
                name="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength="6"
                className="w-full pl-10 pr-4 py-3 text-sm bg-white border border-slate-250 rounded-xl text-slate-900 focus:ring-1 focus:ring-brand-secondary focus:border-transparent outline-none transition-all"
                placeholder="Create a new password"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 text-rose-600 p-3.5 rounded-xl text-xs font-bold">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span className="text-left">{error}</span>
            </div>
          )}

          {message && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 text-emerald-700 p-3.5 rounded-xl text-xs font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="text-left">{message}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={resetLoading}
            className="w-full py-3 bg-gradient-to-r from-brand-accent to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-extrabold rounded-xl shadow-md disabled:opacity-50 transition-all text-xs uppercase tracking-wider cursor-pointer border-none"
          >
            {resetLoading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-500">
          <p>
            Remembered your password?{" "}
            <Link to="/login" className="text-brand-secondary font-bold hover:underline">
              Login here
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
