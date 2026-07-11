# ScholarOS Upgrade Plan

This is a large scope. I'll ship it in phases so each is testable. Confirm the phase order or tell me to compress.

## Phase 1 — Auth reliability & polish (ship first)
- Fix "Create Account does nothing": wrap submit in try/finally, disable button only while pending, surface Supabase errors via toast, handle "email already registered" explicitly.
- Zod validation (email format, password ≥ 8 chars, name required on signup) with inline field errors.
- Loading spinner on Sign In / Sign Up buttons; success toast on signup ("Check your email" or auto-login).
- Forgot password: link on auth page → `resetPasswordForEmail` with `redirectTo=/reset-password`. New public `/reset-password` route that calls `updateUser({ password })`.
- Remember Me: when unchecked, sign out on tab close (session-scoped storage flag).
- Mobile: input font-size ≥ 16px (prevents iOS zoom), full-width buttons, autocomplete attrs.

## Phase 2 — Settings, profile, schema
Migration adds:
- `profiles`: `department`, `college_name`, `academic_year`, `avatar_url`, `classes_per_day`, `working_days` (int[]), `attendance_target` (default 75).
- `semester_records` (semester, sgpa, credits_earned, total_credits, backlogs, notes) — user-scoped, RLS.
- `timetable_slots`: add `faculty`, `room`, `slot_type` (`class|lab|break`), `color`.
- `notifications` (type, title, body, read, created_at) — user-scoped, RLS.
- Storage: `avatars` bucket (public read, owner write).

New routes:
- `/settings` — classes per day, working days (Mon–Sat toggles), semester, academic year, attendance target %.
- `/profile` — name, roll no, branch/department, college, academic year, avatar upload.
- `/reset-password` — public.

## Phase 3 — Timetable module rebuild
- Grid: rows = periods (editable count), cols = working days.
- Each cell: subject picker + faculty + room + type (class/lab/break) + color.
- Mobile: day tabs → vertical period list.
- Save per-user; reused by Attendance to auto-fill today's periods.

## Phase 4 — Attendance upgrades
- Calendar view (month) with per-day status dots.
- Trend chart (already partial): keep + add "classes needed to hit target %" using user's `attendance_target`.
- Auto-populate today's periods from timetable.

## Phase 5 — Marks, GPA, academic history
- Semester Records page: table of Sem 1–8 with SGPA, credits earned, backlogs. Auto CGPA = Σ(sgpa·credits)/Σcredits.
- SGPA/CGPA trend line chart.
- Keep existing Mid-1/Mid-2/Sem marks per subject; unify on Marks page with tabs.
- Export: attendance PDF, marks PDF, all data Excel (via `jspdf` + `xlsx`).

## Phase 6 — Tasks, notifications, UI polish
- Tasks: add study streak counter (consecutive days a task was completed).
- Notifications: bell in header, generated client-side on load (attendance <target, task due ≤2d, exam ≤7d). Stored in `notifications` table, marked read on click. Browser Notification API opt-in.
- UI polish pass: glassmorphism card variant, page transitions (`animate-fade-in`), sidebar collapse animation.

## Technical notes
- All new tables get `GRANT ... TO authenticated`, RLS `auth.uid() = user_id`, `service_role` grant.
- Exports run client-side (no server work needed).
- Push notifications = Web Notifications API only (no service worker / FCM unless requested).
- Avatar bucket public so `<img src>` works without signed URLs.

## Not included (tell me if you want them)
- Native mobile push (needs FCM + service worker + VAPID keys).
- OCR of hall tickets / auto-parse marksheets.
- Multi-user / faculty roles.

Reply "go" to start Phase 1, or tell me to reorder / drop phases.
