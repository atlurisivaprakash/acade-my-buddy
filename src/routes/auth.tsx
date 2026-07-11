import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — ScholarOS" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string }>({});

  const signInSchema = z.object({
    email: z.string().trim().email("Enter a valid email"),
    password: z.string().min(1, "Password is required"),
  });
  const signUpSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(80),
    email: z.string().trim().email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters"),
  });
  const forgotSchema = z.object({
    email: z.string().trim().email("Enter a valid email"),
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    if (mode === "signup") {
      const r = signUpSchema.safeParse({ name, email, password });
      if (!r.success) {
        const f = r.error.flatten().fieldErrors;
        setErrors({ name: f.name?.[0], email: f.email?.[0], password: f.password?.[0] });
        return;
      }
    } else if (mode === "signin") {
      const r = signInSchema.safeParse({ email, password });
      if (!r.success) {
        const f = r.error.flatten().fieldErrors;
        setErrors({ email: f.email?.[0], password: f.password?.[0] });
        return;
      }
    } else {
      const r = forgotSchema.safeParse({ email });
      if (!r.success) {
        setErrors({ email: r.error.flatten().fieldErrors.email?.[0] });
        return;
      }
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: name || email.split("@")[0] },
          },
        });
        if (error) {
          if (/registered|exists/i.test(error.message)) {
            toast.error("This email is already registered. Try signing in.");
            setMode("signin");
            return;
          }
          throw error;
        }
        toast.success("Account created. Welcome to ScholarOS.");
        navigate({ to: "/dashboard" });
      } else if (mode === "signin") {
        if (!remember) sessionStorage.setItem("scholaros:ephemeral", "1");
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          if (/invalid/i.test(error.message)) {
            toast.error("Incorrect email or password.");
            return;
          }
          throw error;
        }
        toast.success("Signed in.");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset link sent. Check your email.");
        setMode("signin");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-slate-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-brand font-bold text-brand-foreground">
            S
          </div>
          <span className="text-lg font-bold tracking-tight">ScholarOS</span>
        </div>
        <div className="space-y-6">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-balance">
            Your semester,
            <br />
            in one calm dashboard.
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-slate-300">
            Track attendance, marks, GPA, and study materials — privately, per student.
            Nothing you save leaves your account.
          </p>
          <ul className="space-y-3 text-sm text-slate-300">
            {[
              "Attendance shortage alerts below 75%",
              "Mid-1, Mid-2 and semester marks",
              "Question papers, notes and documents",
              "Task manager for assignments and exams",
            ].map((f) => (
              <li key={f} className="flex items-center gap-3">
                <span className="size-1.5 rounded-full bg-brand" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="font-mono text-xs uppercase tracking-widest text-slate-500">
          Personal · Private · Local to you
        </p>
      </aside>
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-brand font-bold text-brand-foreground">
              S
            </div>
            <span className="text-lg font-bold tracking-tight">ScholarOS</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "signin"
                ? "Welcome back"
                : mode === "signup"
                  ? "Create your account"
                  : "Reset your password"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "signin"
                ? "Sign in to your personal academic dashboard."
                : mode === "signup"
                  ? "One student, one account. Everything stays yours."
                  : "We'll email you a link to set a new password."}
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <Field label="Full name">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Rivers"
                  autoComplete="name"
                  className="w-full rounded-xl border border-hairline bg-surface px-4 py-2.5 text-base sm:text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
              </Field>
            )}
            <Field label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
                autoComplete="email"
                inputMode="email"
                className="w-full rounded-xl border border-hairline bg-surface px-4 py-2.5 text-base sm:text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </Field>
            {mode !== "forgot" && (
              <Field label="Password">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="w-full rounded-xl border border-hairline bg-surface px-4 py-2.5 text-base sm:text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
                {errors.password && <p className="text-xs text-red-500">{errors.password}</p>}
              </Field>
            )}
            {mode === "signin" && (
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center gap-2 text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="size-4 rounded border-hairline accent-brand"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="font-medium text-brand hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:opacity-90 disabled:opacity-60"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading
                ? mode === "signin"
                  ? "Signing in…"
                  : mode === "signup"
                    ? "Creating account…"
                    : "Sending link…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
            </button>
          </form>
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-center text-sm text-muted-foreground transition hover:text-foreground"
          >
            {mode === "signin"
              ? "Don't have an account? Sign up"
              : mode === "signup"
                ? "Already have an account? Sign in"
                : "Back to sign in"}
          </button>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}