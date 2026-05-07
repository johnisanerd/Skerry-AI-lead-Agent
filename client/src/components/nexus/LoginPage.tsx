import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Mail, Lock, Code2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

// Gantry Core Logo - Exact replica with stacked geometric architecture
function GantryCoreLogo() {
  return (
    <div className="logo-wrapper" style={{ position: 'relative', width: '64px', height: '64px', margin: '0 auto 32px auto', display: 'flex', justifyContent: 'center', alignItems: 'center', filter: 'drop-shadow(0 0 15px rgba(124, 58, 237, 0.4))' }}>
      <svg
        width="64"
        height="64"
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="gantry-grad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#c084fc" />
          </linearGradient>
        </defs>
        {/* Geometric 'S' path with hexagonal architecture */}
        <path d="M12 18 L32 8 L52 18 L52 32 M12 32 L12 46 L32 56 L52 46 M32 20 L44 26 L44 38 L32 44 L20 38 L20 26 Z" stroke="url(#gantry-grad)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"/>
        {/* Inner 'S' shape lines */}
        <path d="M32 28 V36 M28 32 H36" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

export function LoginPage() {
  const login = useAuthStore(s => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isDev = import.meta.env.DEV;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await login(email, password);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Login failed.");
    } else {
      toast.success("Welcome back to Skerry");
    }
  };

  const devAccounts = [
    { label: "Solo", email: "solo@skerry.io" },
    { label: "Team", email: "team@skerry.io" },
    { label: "Agency", email: "agency@skerry.io" },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#050505] px-4">
      {/* Background grid */}
      <div className="fixed inset-0 grid-bg pointer-events-none opacity-30" />
      {/* Glow blobs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-purple-600/20 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-purple-500/15 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <GantryCoreLogo />
          <h1 className="text-[20px] font-bold tracking-tight text-white">
            Skerry
          </h1>
          <p className="mt-1 text-sm font-medium text-zinc-400">
            Sign in to your account
          </p>
        </div>

        {/* Card - Theme-agnostic dark slate */}
        <div className="rounded-2xl border border-[#27272a] bg-[#18181b] p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider"
              >
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="pl-9 bg-[#eef2f6] text-black border-zinc-300 focus:border-[#7c3aed] focus:ring-[#7c3aed]/20 placeholder:text-zinc-400"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-xs font-semibold text-[#e4e4e7] uppercase tracking-wider"
              >
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9 pr-10 bg-[#eef2f6] text-black border-zinc-300 focus:border-[#7c3aed] focus:ring-[#7c3aed]/20 placeholder:text-zinc-400"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-700 transition"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400"
              >
                {error}
              </motion.p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold shadow-lg transition-all"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          {isDev && (
            <div className="mt-6 border-t border-[#27272a] pt-5">
              <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-[#e4e4e7]">
                Dev Login Emails
              </p>
              <div className="grid grid-cols-3 gap-2">
                {devAccounts.map(acc => (
                  <button
                    key={acc.label}
                    type="button"
                    onClick={() => setEmail(acc.email)}
                    className="rounded-lg border border-zinc-700 bg-zinc-800/50 px-2 py-2 text-center text-[11px] font-medium transition hover:bg-zinc-700/80"
                  >
                    <span className="text-[#e4e4e7]">{acc.label}</span>
                    <span className="block text-[10px] text-zinc-500 mt-0.5">
                      {acc.email}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-center text-[10px] text-zinc-500">
                Passwords are intentionally never displayed in UI.
              </p>
            </div>
          )}
        </div>

        {isDev && (
          <div className="mt-4 text-center">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500">
              <Code2 className="h-3 w-3" />
              Development mode enabled
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
