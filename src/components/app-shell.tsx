import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  CalendarCheck,
  GraduationCap,
  BookOpen,
  FileArchive,
  ShieldCheck,
  ListTodo,
  Menu,
  X,
  LogOut,
  Moon,
  Sun,
  Bell,
  BookMarked,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "sonner";
import { initials } from "@/lib/academic";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/marks", label: "Marks & GPA", icon: GraduationCap },
  { to: "/subjects", label: "Subjects", icon: BookMarked },
  { to: "/materials", label: "Study Materials", icon: BookOpen },
  { to: "/papers", label: "Question Papers", icon: FileArchive },
  { to: "/documents", label: "Important Docs", icon: ShieldCheck },
  { to: "/tasks", label: "Task Manager", icon: ListTodo },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("scholaros-theme") : null;
    const isDark = stored ? stored === "dark" : true;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    let ok = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!ok) return;
      const em = data.user?.email ?? "";
      setEmail(em);
      const meta = data.user?.user_metadata as { full_name?: string } | undefined;
      setName(meta?.full_name || em.split("@")[0] || "Student");
    })();
    return () => {
      ok = false;
    };
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("scholaros-theme", next ? "dark" : "light");
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-right" />
      {/* Sidebar */}
      <SidebarInner
        name={name}
        email={email}
        onClose={() => setOpen(false)}
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-hairline bg-sidebar transform transition-transform lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      />

      {open && (
        <button
          aria-label="Close menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-hairline bg-surface/80 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="grid size-10 shrink-0 place-items-center rounded-lg border border-hairline lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </button>
            <PageTitle />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="grid size-10 place-items-center rounded-lg border border-hairline transition hover:bg-surface-alt"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <button
              className="hidden size-10 place-items-center rounded-lg border border-hairline transition hover:bg-surface-alt sm:grid"
              aria-label="Notifications"
            >
              <Bell className="size-4" />
            </button>
            <button
              onClick={signOut}
              className="hidden items-center gap-2 rounded-lg border border-hairline px-3 py-2 text-sm font-medium transition hover:bg-surface-alt sm:flex"
            >
              <LogOut className="size-4" />
              Sign out
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarInner({
  name,
  email,
  className,
  onClose,
}: {
  name: string;
  email: string;
  className: string;
  onClose: () => void;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className={className}>
      <div className="flex h-16 items-center justify-between border-b border-hairline px-6">
        <Link to="/dashboard" className="flex items-center gap-3" onClick={onClose}>
          <div className="grid size-8 place-items-center rounded-lg bg-brand font-bold text-brand-foreground">
            S
          </div>
          <span className="text-lg font-bold tracking-tight">ScholarOS</span>
        </Link>
        <button
          onClick={onClose}
          className="grid size-8 place-items-center rounded-md lg:hidden"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {NAV.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-brand-soft text-brand"
                  : "text-muted-foreground hover:bg-surface-alt hover:text-foreground"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-hairline p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft font-semibold text-brand">
            {initials(name || "S")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{name || "Student"}</div>
            <div className="truncate text-xs text-muted-foreground">{email}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function PageTitle() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const item = NAV.find((n) => pathname === n.to || pathname.startsWith(n.to + "/"));
  return (
    <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">
      {item?.label ?? "ScholarOS"}
    </h1>
  );
}