import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import AdmitCardPrintButton from "./AdmitCardPrintButton";

export default async function AdmitCardsPage({
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

  const students =
    selectedClassId
      ? await prisma.student.findMany({
          where: role === "student" ? { id: userId } : { classId: selectedClassId },
          include: { class: { select: { name: true } } },
          orderBy: [{ studentId: "asc" }],
        })
      : [];

  const year = new Date().getFullYear();

  return (
    <div className="p-6 bg-[#f8fafe] flex-1 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Link href={`/exams/schedule?examId=${selectedExamId}&classId=${selectedClassId}`} className="hover:text-lamaSky">
              Exam Schedule
            </Link>
            <span>/</span>
            <span className="text-gray-600 font-medium">Admit Cards</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Admit Cards</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {selectedExam ? `${selectedExam.title} · Class ${selectedClass?.name}` : "Select exam and class"}
          </p>
        </div>
        {students.length > 0 && selectedExam && (
          <AdmitCardPrintButton
            students={students.map((s) => ({
              id: s.id,
              name: s.name,
              surname: s.surname,
              studentId: s.studentId,
              className: s.class?.name ?? selectedClass?.name ?? null,
              section: s.section ?? null,
              rollNo: s.rollNo ?? null,
            }))}
            examTitle={selectedExam.title}
            year={year}
          />
        )}
      </div>

      {/* Filters */}
      {role !== "student" && (
        <form
          method="GET"
          action="/exams/admit-cards"
          className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-end gap-3"
        >
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500">Exam</label>
            <select
              name="examId"
              defaultValue={selectedExamId?.toString() ?? ""}
              className="ring-1 ring-gray-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-lamaSky bg-white min-w-[180px]"
            >
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
            Load
          </button>
        </form>
      )}

      {(!selectedExamId || !selectedClassId) && (
        <div className="text-center py-10 text-gray-400 text-sm">
          Select an exam and class to generate admit cards.
        </div>
      )}

      {selectedExam && selectedClassId && students.length === 0 && (
        <div className="text-center py-10 text-gray-400 text-sm">
          No students found in this class.
        </div>
      )}

      {/* Preview — landscape cards, top-to-bottom layout */}
      {students.length > 0 && selectedExam && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {students.map((student) => (
            <div
              key={student.id}
              className="overflow-hidden"
              style={{ background: "repeating-linear-gradient(-45deg,#1a5c1a 0,#1a5c1a 3px,#3d8c3d 3px,#3d8c3d 7px)", padding: "10px" }}
            >
              <div className="relative flex flex-col gap-0" style={{ background: "#fdf8ee", border: "1px solid #2d7a2d", padding: "10px" }}>
                {/* Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.07]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/school-logo.jpg" alt="" className="w-20 h-20 object-contain" />
                </div>

                {/* Header */}
                <div className="flex flex-col items-center text-center gap-1 pb-2 relative z-10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/school-logo.jpg" alt="" className="w-8 h-8 rounded-full object-cover" />
                  <p className="text-[9px] font-black uppercase tracking-wide text-green-900">Progga Preparatory &amp; High School</p>
                  <div className="flex items-center gap-2">
                    <span className="bg-red-700 text-white text-[8px] font-bold px-2 py-0.5 rounded-full">{selectedExam.title}</span>
                    <span className="text-[9px] font-bold text-gray-600">{year}</span>
                  </div>
                  <span className="text-[8px] font-bold uppercase tracking-widest text-green-800 border border-green-700 px-3 py-0.5 rounded">Admit Card</span>
                </div>

                <div className="border-t border-green-700 my-1.5" />

                {/* Student info */}
                <div className="flex flex-col gap-1.5 relative z-10 flex-1">
                  <div>
                    <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wide">Name</p>
                    <p className="text-[11px] font-bold text-gray-900">{student.name} {student.surname}</p>
                    <div className="border-b border-dashed border-gray-300 mt-0.5" />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wide">Class</p>
                      <p className="text-[11px] font-bold text-gray-900">Class {student.class?.name}</p>
                      <div className="border-b border-dashed border-gray-300 mt-0.5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wide">Section</p>
                      <p className="text-[11px] font-bold text-gray-900">{student.section || "—"}</p>
                      <div className="border-b border-dashed border-gray-300 mt-0.5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wide">Roll No</p>
                      <p className="text-[11px] font-bold text-gray-900">{student.rollNo ?? "—"}</p>
                      <div className="border-b border-dashed border-gray-300 mt-0.5" />
                    </div>
                  </div>
                </div>

                <div className="border-t border-green-700 my-1.5" />

                {/* Signatures */}
                <div className="flex gap-8 relative z-10">
                  {["Accountant", "Principal"].map((lbl) => (
                    <div key={lbl} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full h-6 border-b border-gray-500" />
                      <p className="text-[8px] font-bold text-gray-500 uppercase tracking-wide">{lbl}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
