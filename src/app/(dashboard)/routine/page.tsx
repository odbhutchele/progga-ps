import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import RoutineTable, { Period, RoutineCell, RoutineRow } from "./RoutineTable";

const DAYS = ["SAT", "SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY"] as const;
const DAY_LABELS: Record<string, string> = {
  SAT: "Saturday",
  SUNDAY: "Sunday",
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
};

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function RoutineViewPage({
  searchParams,
}: {
  searchParams: { classId?: string };
}) {
  const { role, userId } = await auth();
  if (!role || !userId) redirect("/");

  const classes = await prisma.class.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  let targetClassId: number | null = null;

  if (role === "student") {
    const student = await prisma.student.findUnique({
      where: { id: userId },
      select: { classId: true },
    });
    targetClassId = student?.classId ?? null;
  } else {
    targetClassId = searchParams.classId
      ? parseInt(searchParams.classId)
      : (classes[0]?.id ?? null);
  }

  const rawLessons = targetClassId
    ? await prisma.lesson.findMany({
        where:
          role === "teacher"
            ? { teacherId: userId }
            : { classId: targetClassId },
        include: {
          subject: { select: { id: true, name: true } },
          teacher: { select: { id: true, name: true, surname: true } },
        },
        orderBy: { startTime: "asc" },
      })
    : [];

  // Serialize dates before passing to client
  const lessons: Array<{
    id: number;
    day: string;
    startTime: string;
    endTime: string;
    subject: { name: string };
    teacher: { name: string; surname: string };
  }> = JSON.parse(JSON.stringify(rawLessons));

  // Build unique period slots sorted by startTime
  const slotMap = new Map<string, { startTime: string; endTime: string }>();
  for (const l of lessons) {
    const key = `${l.startTime}|${l.endTime}`;
    if (!slotMap.has(key)) slotMap.set(key, { startTime: l.startTime, endTime: l.endTime });
  }
  const slots = Array.from(slotMap.values()).sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const periods: Period[] = slots.map((slot, i) => ({
    startTime: slot.startTime,
    endTime: slot.endTime,
    label: `${ordinal(i + 1)} Period`,
    timeRange: `${fmtTime(slot.startTime)}–${fmtTime(slot.endTime)}`,
  }));

  const rows: RoutineRow[] = DAYS.map((day) => ({
    day,
    dayLabel: DAY_LABELS[day],
    cells: periods.map((period): RoutineCell => {
      const lesson = lessons.find(
        (l) =>
          l.day === day &&
          l.startTime === period.startTime &&
          l.endTime === period.endTime
      );
      return lesson
        ? {
            subjectName: lesson.subject.name,
            teacherName: `Tr. ${lesson.teacher.name} ${lesson.teacher.surname[0]}.`,
          }
        : null;
    }),
  }));

  const activeClass = classes.find((c) => c.id === targetClassId);
  const className = activeClass?.name ?? "—";
  const showClassPicker = role === "admin" || role === "teacher";

  return (
    <div className="p-6 bg-[#f8fafe] flex-1 flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">
            Class Routine
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {role === "teacher"
              ? "Your teaching schedule"
              : role === "student"
              ? "Your class schedule"
              : "Weekly timetable by class"}
          </p>
        </div>
      </div>

      {showClassPicker && (
        <form
          method="GET"
          action="/routine"
          className="no-print bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-end gap-3 max-w-sm"
        >
          <div className="flex flex-col gap-1 flex-1">
            <label className="text-xs font-semibold text-gray-500">Select Class</label>
            <select
              name="classId"
              defaultValue={targetClassId?.toString() ?? ""}
              className="ring-1 ring-gray-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-lamaSky bg-white"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  Class {c.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="bg-lamaSky text-white font-semibold py-2.5 px-5 rounded-xl text-sm hover:bg-[#1e40af] transition-colors"
          >
            View
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <RoutineTable
          periods={periods}
          rows={rows}
          className={className}
          classId={targetClassId}
          role={role}
        />
      </div>
    </div>
  );
}
