import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, Button, Input, EmptyState, SectionTitle } from "@/components/ui-primitives";
import { toast } from "sonner";
import { Plus, Trash2, BookMarked } from "lucide-react";
import type { Subject } from "@/lib/academic";

export const Route = createFileRoute("/_authenticated/subjects")({
  head: () => ({ meta: [{ title: "Subjects — ScholarOS" }] }),
  component: SubjectsPage,
});

function SubjectsPage() {
  const qc = useQueryClient();
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () =>
      (await supabase.from("subjects").select("*").order("name")).data ?? [],
  });

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [credits, setCredits] = useState(3);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("subjects").insert({
      user_id: u.user.id,
      name: name.trim(),
      code: code.trim() || null,
      credits,
    });
    if (error) return toast.error(error.message);
    setName("");
    setCode("");
    setCredits(3);
    toast.success("Subject added");
    qc.invalidateQueries();
  }

  async function remove(s: Subject) {
    if (!confirm(`Delete "${s.name}"? This also removes its attendance & marks.`)) return;
    const { error } = await supabase.from("subjects").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    qc.invalidateQueries();
  }

  return (
    <div className="space-y-6">
      <Card>
        <SectionTitle title="Add a subject" subtitle="Create the subjects you're taking this semester." />
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_120px_100px_auto]">
          <Input
            placeholder="Subject name (e.g. Artificial Intelligence)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            placeholder="Code (AI401)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Input
            type="number"
            min={1}
            max={10}
            placeholder="Credits"
            value={credits}
            onChange={(e) => setCredits(Number(e.target.value) || 3)}
          />
          <Button type="submit">
            <Plus className="size-4" /> Add
          </Button>
        </form>
      </Card>

      <Card>
        <SectionTitle title="Your subjects" subtitle={`${subjects.length} subject${subjects.length === 1 ? "" : "s"}`} />
        {subjects.length === 0 ? (
          <EmptyState
            title="No subjects yet"
            description="Add your first subject to start tracking attendance and marks."
          />
        ) : (
          <div className="divide-y divide-hairline">
            {subjects.map((s) => (
              <div key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                    <BookMarked className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.code ?? "No code"} · {s.credits} credits
                    </div>
                  </div>
                </div>
                <Button variant="ghost" onClick={() => remove(s)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}