import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, Button, Input, Select, Textarea, EmptyState, SectionTitle, Badge } from "@/components/ui-primitives";
import { toast } from "sonner";
import { format, isAfter, isBefore } from "date-fns";
import { Trash2, CheckCircle2, Circle, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Task Manager — ScholarOS" }] }),
  component: TasksPage,
});

const CATEGORIES = [
  { value: "assignment", label: "Assignment" },
  { value: "project", label: "Project" },
  { value: "exam", label: "Exam" },
  { value: "deadline", label: "Deadline" },
  { value: "other", label: "Other" },
] as const;

function TasksPage() {
  const qc = useQueryClient();
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () =>
      (await supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false })).data ?? [],
  });
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => (await supabase.from("subjects").select("*").order("name")).data ?? [],
  });

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [due, setDue] = useState("");
  const [category, setCategory] = useState<string>("assignment");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [subjectId, setSubjectId] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("tasks").insert({
      user_id: u.user.id,
      title: title.trim(),
      description: desc.trim() || null,
      due_date: due ? new Date(due).toISOString() : null,
      category,
      priority,
      subject_id: subjectId || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Task added");
    setTitle("");
    setDesc("");
    setDue("");
    qc.invalidateQueries();
  }

  async function toggle(id: string, completed: boolean) {
    await supabase.from("tasks").update({ completed: !completed }).eq("id", id);
    qc.invalidateQueries();
  }
  async function remove(id: string) {
    await supabase.from("tasks").delete().eq("id", id);
    qc.invalidateQueries();
  }

  const filtered = tasks.filter((t) =>
    filter === "all" ? true : filter === "open" ? !t.completed : t.completed,
  );

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle title="New task" subtitle="Assignments, projects, exam prep, deadlines." />
        <form onSubmit={add} className="grid gap-3">
          <Input
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Textarea
            placeholder="Optional description"
            rows={2}
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-4">
            <Input
              type="datetime-local"
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Select
              value={priority}
              onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
            >
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </Select>
            <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              <option value="">No subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end">
            <Button type="submit">
              <Plus className="size-4" /> Add task
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <SectionTitle
          title="Your tasks"
          subtitle={`${tasks.filter((t) => !t.completed).length} open`}
          right={
            <div className="flex gap-1 rounded-xl border border-hairline p-1">
              {(["open", "all", "done"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                    filter === f
                      ? "bg-brand text-brand-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f[0].toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          }
        />
        {filtered.length === 0 ? (
          <EmptyState
            title="Nothing here"
            description="Add tasks above to keep track of assignments and deadlines."
          />
        ) : (
          <ul className="divide-y divide-hairline">
            {filtered.map((t) => {
              const now = new Date();
              const overdue =
                !t.completed && t.due_date && isBefore(new Date(t.due_date), now);
              const soon =
                !t.completed &&
                t.due_date &&
                isAfter(new Date(t.due_date), now) &&
                isBefore(new Date(t.due_date), new Date(now.getTime() + 24 * 3600 * 1000));
              return (
                <li key={t.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-3 py-3">
                  <button
                    onClick={() => toggle(t.id, t.completed)}
                    className="mt-0.5 text-brand"
                    aria-label="Toggle complete"
                  >
                    {t.completed ? (
                      <CheckCircle2 className="size-5" />
                    ) : (
                      <Circle className="size-5 text-muted-foreground" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <div
                      className={`truncate font-semibold ${
                        t.completed ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {t.title}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge
                        tone={
                          t.priority === "high"
                            ? "danger"
                            : t.priority === "medium"
                              ? "brand"
                              : "neutral"
                        }
                      >
                        {t.priority}
                      </Badge>
                      <span>{CATEGORIES.find((c) => c.value === t.category)?.label ?? t.category}</span>
                      {t.due_date && (
                        <span
                          className={
                            overdue
                              ? "font-semibold text-[color:var(--danger)]"
                              : soon
                                ? "font-semibold text-[color:var(--warn)]"
                                : ""
                          }
                        >
                          · {format(new Date(t.due_date), "EEE, dd MMM · p")}
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                    )}
                  </div>
                  <Button variant="ghost" onClick={() => remove(t.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}