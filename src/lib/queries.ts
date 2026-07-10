import { supabase } from "@/integrations/supabase/client";

export async function fetchAll() {
  const [subjectsQ, attendanceQ, marksQ, tasksQ, slotsQ] = await Promise.all([
    supabase.from("subjects").select("*").order("name"),
    supabase.from("attendance").select("*").order("date", { ascending: false }),
    supabase.from("marks").select("*"),
    supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("timetable_slots").select("*"),
  ]);
  return {
    subjects: subjectsQ.data ?? [],
    attendance: attendanceQ.data ?? [],
    marks: marksQ.data ?? [],
    tasks: tasksQ.data ?? [],
    slots: slotsQ.data ?? [],
  };
}