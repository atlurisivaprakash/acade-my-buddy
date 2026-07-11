import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

type Notif = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  created_at: string;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[]>([]);

  async function load() {
    const { data } = await supabase
      .from("notifications")
      .select("id,type,title,body,read,created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setItems((data as Notif[]) ?? []);
  }

  useEffect(() => {
    void load();
    // regenerate contextual alerts once per mount
    void generateContextualNotifications().then(load);
  }, []);

  async function markAllRead() {
    const unread = items.filter((i) => !i.read).map((i) => i.id);
    if (!unread.length) return;
    await supabase.from("notifications").update({ read: true }).in("id", unread);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
  }

  const unread = items.filter((i) => !i.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative grid size-10 place-items-center rounded-lg border border-hairline transition hover:bg-surface-alt"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close notifications"
            className="fixed inset-0 z-30"
          />
          <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xl animate-scale-in">
            <div className="flex items-center justify-between border-b border-hairline p-3">
              <div className="text-sm font-semibold">Notifications</div>
              <button
                onClick={markAllRead}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Mark all read
              </button>
            </div>
            <div className="max-h-96 overflow-auto">
              {items.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  You're all caught up.
                </div>
              ) : (
                items.map((n) => (
                  <div
                    key={n.id}
                    className={`border-b border-hairline p-3 text-sm last:border-0 ${
                      n.read ? "opacity-70" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-medium">{n.title}</div>
                      {!n.read && <span className="mt-1 size-2 shrink-0 rounded-full bg-brand" />}
                    </div>
                    {n.body && <p className="mt-1 text-xs text-muted-foreground">{n.body}</p>}
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Generate contextual notifications (attendance shortage, upcoming exams, due tasks).
// Uses a "type|key" signature stored in meta to avoid duplicates in a 24h window.
async function generateContextualNotifications() {
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const uid = userRes.user?.id;
    if (!uid) return;

    const [subjectsQ, attendanceQ, profileQ, tasksQ] = await Promise.all([
      supabase.from("subjects").select("id,name"),
      supabase.from("attendance").select("subject_id,status"),
      supabase.from("profiles").select("attendance_target").eq("id", uid).maybeSingle(),
      supabase.from("tasks").select("id,title,due_date,completed,category"),
    ]);
    const target = Number(profileQ.data?.attendance_target ?? 75);
    const subjects = subjectsQ.data ?? [];
    const attendance = attendanceQ.data ?? [];
    const tasks = tasksQ.data ?? [];

    const alerts: Array<{ type: string; title: string; body: string; key: string }> = [];

    for (const s of subjects) {
      const rows = attendance.filter((a) => a.subject_id === s.id && a.status !== "leave");
      if (rows.length === 0) continue;
      const present = rows.filter((a) => a.status === "present").length;
      const pct = (present / rows.length) * 100;
      if (pct < target) {
        alerts.push({
          type: "attendance_shortage",
          title: `${s.name} attendance below ${target}%`,
          body: `Currently at ${pct.toFixed(1)}% — attend upcoming classes to recover.`,
          key: `attendance:${s.id}:${Math.floor(pct)}`,
        });
      }
    }

    const now = Date.now();
    const in48h = now + 48 * 3600 * 1000;
    const in7d = now + 7 * 24 * 3600 * 1000;
    for (const t of tasks) {
      if (t.completed || !t.due_date) continue;
      const due = new Date(t.due_date).getTime();
      if (due < now || due > in7d) continue;
      const isExam = t.category === "exam";
      if (isExam) {
        alerts.push({
          type: "exam_reminder",
          title: `Upcoming exam: ${t.title}`,
          body: `Scheduled for ${new Date(t.due_date).toLocaleString()}`,
          key: `exam:${t.id}`,
        });
      } else if (due <= in48h) {
        alerts.push({
          type: "task_due",
          title: `Due soon: ${t.title}`,
          body: `${new Date(t.due_date).toLocaleString()}`,
          key: `task:${t.id}`,
        });
      }
    }

    if (alerts.length === 0) return;

    // Dedupe against last 24h existing notifications with same key
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: existing } = await supabase
      .from("notifications")
      .select("meta")
      .gte("created_at", since);
    const keys = new Set(
      (existing ?? [])
        .map((r) => (r.meta as { key?: string } | null)?.key)
        .filter(Boolean),
    );

    const rowsToInsert = alerts
      .filter((a) => !keys.has(a.key))
      .map((a) => ({
        user_id: uid,
        type: a.type,
        title: a.title,
        body: a.body,
        meta: { key: a.key },
      }));
    if (rowsToInsert.length > 0) {
      await supabase.from("notifications").insert(rowsToInsert);
    }
  } catch (e) {
    console.debug("notif gen failed", e);
  }
}