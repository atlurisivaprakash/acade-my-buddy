import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, SectionTitle, Button, Select, Input } from "@/components/ui-primitives";
import { Loader2, Save, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/timetable")({
  head: () => ({ meta: [{ title: "Timetable — ScholarOS" }] }),
  component: TimetablePage,
});

const DAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  0: "Sun",
};

type Subject = { id: string; name: string; code: string | null; color: string | null };
type Slot = {
  id?: string;
  day_of_week: number;
  period: number;
  subject_id: string | null;
  faculty: string | null;
  room: string | null;
  slot_type: string;
  label: string | null;
  color: string | null;
};

const COLORS = ["indigo", "sky", "violet", "emerald", "amber", "rose", "cyan", "fuchsia"];
const COLOR_CLASS: Record<string, string> = {
  indigo: "bg-indigo-500/15 text-indigo-500",
  sky: "bg-sky-500/15 text-sky-500",
  violet: "bg-violet-500/15 text-violet-500",
  emerald: "bg-emerald-500/15 text-emerald-500",
  amber: "bg-amber-500/15 text-amber-600",
  rose: "bg-rose-500/15 text-rose-500",
  cyan: "bg-cyan-500/15 text-cyan-500",
  fuchsia: "bg-fuchsia-500/15 text-fuchsia-500",
};

function TimetablePage() {
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);
  const [periods, setPeriods] = useState(6);
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [editing, setEditing] = useState<{ day: number; period: number } | null>(null);
  const [activeDay, setActiveDay] = useState(1);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      setUid(userRes.user.id);
      const [profileQ, subjectsQ, slotsQ] = await Promise.all([
        supabase
          .from("profiles")
          .select("classes_per_day,working_days")
          .eq("id", userRes.user.id)
          .maybeSingle(),
        supabase.from("subjects").select("id,name,code,color").order("name"),
        supabase.from("timetable_slots").select("*"),
      ]);
      if (profileQ.data) {
        setPeriods(profileQ.data.classes_per_day ?? 6);
        setWorkingDays(profileQ.data.working_days ?? [1, 2, 3, 4, 5, 6]);
        setActiveDay((profileQ.data.working_days ?? [1])[0] ?? 1);
      }
      setSubjects((subjectsQ.data as Subject[]) ?? []);
      setSlots((slotsQ.data as Slot[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const slotMap = useMemo(() => {
    const m = new Map<string, Slot>();
    slots.forEach((s) => m.set(`${s.day_of_week}-${s.period}`, s));
    return m;
  }, [slots]);

  async function saveSlot(day: number, period: number, patch: Partial<Slot>) {
    if (!uid) return;
    const existing = slotMap.get(`${day}-${period}`);
    const merged: Slot = {
      day_of_week: day,
      period,
      subject_id: null,
      faculty: null,
      room: null,
      slot_type: "class",
      label: null,
      color: null,
      ...existing,
      ...patch,
    };
    try {
      if (existing?.id) {
        const { error } = await supabase
          .from("timetable_slots")
          .update({
            subject_id: merged.subject_id,
            faculty: merged.faculty,
            room: merged.room,
            slot_type: merged.slot_type,
            label: merged.label,
            color: merged.color,
          })
          .eq("id", existing.id);
        if (error) throw error;
        setSlots((prev) => prev.map((s) => (s.id === existing.id ? { ...merged, id: existing.id } : s)));
      } else {
        const { data, error } = await supabase
          .from("timetable_slots")
          .insert({
            user_id: uid,
            day_of_week: day,
            period,
            subject_id: merged.subject_id,
            faculty: merged.faculty,
            room: merged.room,
            slot_type: merged.slot_type,
            label: merged.label,
            color: merged.color,
          })
          .select()
          .single();
        if (error) throw error;
        setSlots((prev) => [...prev, data as Slot]);
      }
      toast.success("Slot saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }

  async function clearSlot(day: number, period: number) {
    const existing = slotMap.get(`${day}-${period}`);
    if (!existing?.id) return;
    const { error } = await supabase.from("timetable_slots").delete().eq("id", existing.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSlots((prev) => prev.filter((s) => s.id !== existing.id));
  }

  if (loading) {
    return (
      <div className="grid place-items-center py-24 text-muted-foreground">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  const renderCell = (day: number, period: number) => {
    const s = slotMap.get(`${day}-${period}`);
    const subj = s?.subject_id ? subjects.find((x) => x.id === s.subject_id) : null;
    const color = s?.color || subj?.color || "indigo";
    const colorClass = COLOR_CLASS[color] ?? COLOR_CLASS.indigo;
    if (!s) {
      return (
        <button
          onClick={() => setEditing({ day, period })}
          className="grid h-full min-h-[68px] w-full place-items-center rounded-lg border border-dashed border-hairline text-xs text-muted-foreground hover:bg-surface-alt"
        >
          + Add
        </button>
      );
    }
    if (s.slot_type === "break") {
      return (
        <button
          onClick={() => setEditing({ day, period })}
          className="grid h-full min-h-[68px] w-full place-items-center rounded-lg bg-surface-alt text-xs font-medium text-muted-foreground"
        >
          {s.label || "Break"}
        </button>
      );
    }
    return (
      <button
        onClick={() => setEditing({ day, period })}
        className={`h-full min-h-[68px] w-full rounded-lg p-2 text-left ${colorClass}`}
      >
        <div className="truncate text-xs font-bold">
          {subj?.name ?? s.label ?? "Class"}
          {s.slot_type === "lab" && (
            <span className="ml-1 rounded bg-black/10 px-1 py-0.5 text-[9px] uppercase">Lab</span>
          )}
        </div>
        {s.faculty && <div className="truncate text-[10px] opacity-80">{s.faculty}</div>}
        {s.room && <div className="truncate text-[10px] opacity-70">Room {s.room}</div>}
      </button>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <SectionTitle
        title="Weekly timetable"
        subtitle={`${periods} periods · ${workingDays.length} working days`}
      />

      {/* Desktop grid */}
      <Card className="hidden overflow-x-auto p-4 md:block">
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `72px repeat(${workingDays.length}, minmax(140px,1fr))` }}
        >
          <div />
          {workingDays.map((d) => (
            <div key={d} className="pb-2 text-center text-xs font-bold uppercase text-muted-foreground">
              {DAY_LABELS[d]}
            </div>
          ))}
          {Array.from({ length: periods }).map((_, i) => {
            const period = i + 1;
            return (
              <>
                <div
                  key={`h-${period}`}
                  className="grid place-items-center text-xs font-semibold text-muted-foreground"
                >
                  P{period}
                </div>
                {workingDays.map((d) => (
                  <div key={`${d}-${period}`}>{renderCell(d, period)}</div>
                ))}
              </>
            );
          })}
        </div>
      </Card>

      {/* Mobile day tabs */}
      <div className="md:hidden">
        <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
          {workingDays.map((d) => (
            <button
              key={d}
              onClick={() => setActiveDay(d)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold ${
                activeDay === d
                  ? "bg-brand text-brand-foreground"
                  : "border border-hairline text-muted-foreground"
              }`}
            >
              {DAY_LABELS[d]}
            </button>
          ))}
        </div>
        <Card>
          <div className="grid gap-2">
            {Array.from({ length: periods }).map((_, i) => (
              <div key={i} className="grid grid-cols-[48px_1fr] items-center gap-2">
                <div className="text-xs font-semibold text-muted-foreground">P{i + 1}</div>
                {renderCell(activeDay, i + 1)}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {editing && (
        <SlotEditor
          day={editing.day}
          period={editing.period}
          initial={slotMap.get(`${editing.day}-${editing.period}`)}
          subjects={subjects}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            void saveSlot(editing.day, editing.period, patch);
            setEditing(null);
          }}
          onDelete={() => {
            void clearSlot(editing.day, editing.period);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function SlotEditor({
  day,
  period,
  initial,
  subjects,
  onClose,
  onSave,
  onDelete,
}: {
  day: number;
  period: number;
  initial: Slot | undefined;
  subjects: Subject[];
  onClose: () => void;
  onSave: (patch: Partial<Slot>) => void;
  onDelete: () => void;
}) {
  const [subjectId, setSubjectId] = useState(initial?.subject_id ?? "");
  const [faculty, setFaculty] = useState(initial?.faculty ?? "");
  const [room, setRoom] = useState(initial?.room ?? "");
  const [slotType, setSlotType] = useState(initial?.slot_type ?? "class");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [color, setColor] = useState(initial?.color ?? "indigo");

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-hairline bg-surface p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold">
          {DAY_LABELS[day]} · Period {period}
        </h3>
        <div className="mt-4 space-y-3">
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Type
            </span>
            <div className="flex gap-2">
              {(["class", "lab", "break"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSlotType(t)}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize ${
                    slotType === t
                      ? "border-brand bg-brand-soft text-brand"
                      : "border-hairline text-muted-foreground"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {slotType !== "break" && (
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Subject
              </span>
              <Select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                <option value="">— None —</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {slotType === "break" && (
            <Input
              placeholder="Break label (e.g. Lunch)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          )}
          {slotType !== "break" && (
            <>
              <Input placeholder="Faculty" value={faculty} onChange={(e) => setFaculty(e.target.value)} />
              <Input placeholder="Room" value={room} onChange={(e) => setRoom(e.target.value)} />
              <div>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Color
                </span>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`size-8 rounded-full ${COLOR_CLASS[c]} ${
                        color === c ? "ring-2 ring-brand ring-offset-2 ring-offset-surface" : ""
                      }`}
                      aria-label={c}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="mt-6 flex flex-wrap justify-between gap-2">
          {initial?.id ? (
            <Button variant="danger" onClick={onDelete}>
              <Trash2 className="size-4" />
              Remove
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                onSave({
                  subject_id: subjectId || null,
                  faculty: faculty || null,
                  room: room || null,
                  slot_type: slotType,
                  label: label || null,
                  color,
                })
              }
            >
              <Save className="size-4" />
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}