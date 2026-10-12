import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ScheduleEditor, { SubjectRow } from "./ScheduleEditor";
import PrintButton from "@/components/PrintButton";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "long" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default async function ExamSchedulePage({
  searchParams,
}: {
  searchParams: { examId?: string; classId?: string };
}) {
  const { role, userId } = await auth();
  if (!role || !userId) redirect("/");

  const exams = await prisma.exam.findMany({
    select: { id: true, title: true },
    orderBy: { id: "desc" },
  });

  const classes = await prisma.class.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Determine selected exam + class
  let selectedExamId = searchParams.examId ? parseInt(searchParams.examId) : (exams[0]?.id ?? null);
  let selectedClassId: number | null = null;

  if (role === "student") {
    const student = await prisma.student.findUnique({
      where: { id: userId },
      select: { classId: true },
    });
    selectedClassId = student?.classId ?? null;
  } else {
    selectedClassId = searchParams.classId ? parseInt(searchParams.classId) : (classes[0]?.id ?? null);
  }

  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const rawEntries =
    selectedExamId && selectedClassId
      ? await prisma.examSchedule.findMany({
          where: { examId: selectedExamId, classId: selectedClassId },
          include: { subject: { select: { name: true } } },
          orderBy: { date: "asc" },
        })
      : [];

  const entries = JSON.parse(JSON.stringify(rawEntries));

  const subjects =
    selectedClassId
      ? await prisma.subject.findMany({
          where: { classId: selectedClassId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [];

  const subjectsWithEntries: SubjectRow[] = subjects.map((sub) => {
    const e = entries.find((e: any) => e.subjectId === sub.id) ?? null;
    return {
      ...sub,
      entry: e
        ? { id: e.id, date: e.date, startTime: e.startTime, endTime: e.endTime, room: e.room, totalMarks: e.totalMarks }
        : null,
    };
  });

  const year = new Date().getFullYear();
  const hasData = entries.length > 0;

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #exam-schedule-print, #exam-schedule-print * { visibility: visible !important; }
          #exam-schedule-print {
            position: fixed; inset: 0; padding: 28px 32px; background: #fff;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="p-6 bg-[#f8fafe] flex-1 flex flex-col gap-6">
        {/* Header */}
        <div className="no-print flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Exam Schedule</h1>
            <p className="text-sm text-gray-500 mt-0.5">View and manage subject-wise exam timetables by class.</p>
          </div>
          {role === "admin" && selectedExamId && selectedClassId && (
            <Link
              href={`/exams/admit-cards?examId=${selectedExamId}&classId=${selectedClassId}`}
              className="flex items-center gap-2 bg-lamaPurple text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
            >
              🎟️ Admit Cards
            </Link>
          )}
        </div>

        {/* Filters */}
        {role !== "student" && (
          <form
            method="GET"
            action="/exams/schedule"
            className="no-print bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-end gap-3"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500">Exam</label>
              <select
                name="examId"
                defaultValue={selectedExamId?.toString() ?? ""}
                className="ring-1 ring-gray-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-lamaSky bg-white min-w-[180px]"
              >
                {exams.length === 0 && <option value="">No exams — create one first</option>}
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>{e.title}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-gray-500">Class</label>
              <select
                name="classId"
                defaultValue={selectedClassId?.toString() ?? ""}
                className="ring-1 ring-gray-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-lamaSky bg-white"
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>Class {c.name}</option>
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

        {/* Main content */}
        {!selectedExamId || !selectedClassId ? (
          <div className="text-center py-20 text-gray-400 text-sm">Select an exam and class to view the schedule.</div>
        ) : (
          <div id="exam-schedule-print" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-4">
            {/* Print header */}
            <div className="hidden print:block text-center mb-4">
              <p className="text-xs text-gray-500 uppercase tracking-widest">Progga Preparatory &amp; High School</p>
              <h1 className="text-xl font-extrabold text-gray-900 mt-0.5">{selectedExam?.title}</h1>
              <p className="text-sm font-semibold text-gray-700">Class {selectedClass?.name} · {year}</p>
              <div className="border-t-2 border-gray-800 mt-3" />
            </div>

            {/* Screen header row */}
            <div className="no-print flex items-center justify-between flex-wrap gap-2">
              <div>
                <h2 className="text-base font-bold text-gray-800">{selectedExam?.title}</h2>
                <p className="text-xs text-gray-400">Class {selectedClass?.name}</p>
              </div>
              <div className="flex gap-2">
                {hasData && <PrintButton label="Print Schedule" />}
              </div>
            </div>

            {/* Schedule table */}
            {hasData ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                      <th className="border border-gray-200 px-4 py-3 text-left print:border-gray-800">Subject</th>
                      <th className="border border-gray-200 px-4 py-3 text-left print:border-gray-800">Date</th>
                      <th className="border border-gray-200 px-4 py-3 text-left print:border-gray-800">Day</th>
                      <th className="border border-gray-200 px-4 py-3 text-left print:border-gray-800">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry: any, i: number) => (
                      <tr key={entry.id} className={i % 2 === 0 ? "bg-white" : "bg-gray-50/40"}>
                        <td className="border border-gray-100 px-4 py-3 font-semibold text-gray-800 print:border-gray-300">
                          {entry.subject.name}
                        </td>
                        <td className="border border-gray-100 px-4 py-3 text-gray-700 print:border-gray-300">
                          {fmtDate(entry.date)}
                        </td>
                        <td className="border border-gray-100 px-4 py-3 text-gray-500 print:border-gray-300">
                          {fmtDay(entry.date)}
                        </td>
                        <td className="border border-gray-100 px-4 py-3 text-gray-700 print:border-gray-300">
                          {entry.startTime && entry.endTime ? `${fmtTime(entry.startTime)}–${fmtTime(entry.endTime)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8 italic">No subjects scheduled yet for this exam and class.</p>
            )}

            {/* Edit section — admin only, hidden on print */}
            {role === "admin" && (
              <div className="no-print border-t border-gray-100 pt-4 mt-2">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Manage Schedule</h3>
                <ScheduleEditor
                  subjects={subjectsWithEntries}
                  examId={selectedExamId}
                  classId={selectedClassId}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
