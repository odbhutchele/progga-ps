import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import MarksheetPortal from "./MarksheetPortal";

export default async function MarksheetPage({
  searchParams,
}: {
  searchParams: { classId?: string; subjectId?: string; examId?: string };
}) {
  const { role } = await auth();

  if (role !== "admin" && role !== "teacher") {
    redirect("/");
  }

  const selectedClassId = searchParams.classId;
  const selectedSubjectId = searchParams.subjectId;
  const selectedExamId = searchParams.examId;

  const [exams, classes] = await Promise.all([
    prisma.exam.findMany({ orderBy: { id: "desc" } }),
    prisma.class.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  // Subjects are filtered by the selected class
  const subjects = selectedClassId
    ? await prisma.subject.findMany({
        where: { classId: parseInt(selectedClassId) },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const allSelected = selectedClassId && selectedSubjectId && selectedExamId;

  let students: { id: string; name: string; surname: string }[] = [];
  let existingResults: { studentId: string; score: number; grade: string | null; gpa: number | null }[] = [];
  let currentExam = null;
  let totalMarks = 100;

  if (allSelected) {
    [currentExam] = await Promise.all([
      prisma.exam.findUnique({ where: { id: parseInt(selectedExamId) } }),
    ]);

    const scheduleEntry = await prisma.examSchedule.findFirst({
      where: {
        examId: parseInt(selectedExamId),
        classId: parseInt(selectedClassId),
        subjectId: parseInt(selectedSubjectId),
      },
      select: { totalMarks: true },
    });
    totalMarks = scheduleEntry?.totalMarks ?? 100;

    if (currentExam) {
      [students, existingResults] = await Promise.all([
        prisma.student.findMany({
          where: { classId: parseInt(selectedClassId) },
          select: { id: true, name: true, surname: true },
          orderBy: { surname: "asc" },
        }),
        prisma.result.findMany({
          where: {
            examId: parseInt(selectedExamId),
            subjectId: parseInt(selectedSubjectId),
          },
          select: { studentId: true, score: true, grade: true, gpa: true },
        }),
      ]);
    }
  }

  const selectedSubject = subjects.find((s) => s.id.toString() === selectedSubjectId);

  return (
    <div className="p-6 bg-[#f8fafe] flex-1 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Marksheet Entry</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Select an exam, class, and subject to load the student grade sheet.
        </p>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <form method="GET" action="/exams/marksheet" className="grid gap-4 sm:grid-cols-4 items-end">
          {/* Exam */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">Exam</label>
            <select
              name="examId"
              className="ring-1 ring-gray-200 p-2.5 rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-lamaSky transition-all bg-white"
              defaultValue={selectedExamId || ""}
            >
              <option value="">-- Choose Exam --</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title}
                </option>
              ))}
            </select>
          </div>

          {/* Class */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">Class</label>
            <select
              name="classId"
              className="ring-1 ring-gray-200 p-2.5 rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-lamaSky transition-all bg-white"
              defaultValue={selectedClassId || ""}
            >
              <option value="">-- Choose Class --</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  Class {cls.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subject — filtered by class, disabled until class chosen */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">Subject</label>
            <select
              name="subjectId"
              className="ring-1 ring-gray-200 p-2.5 rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-lamaSky transition-all bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              defaultValue={selectedSubjectId || ""}
              disabled={subjects.length === 0}
            >
              <option value="">
                {subjects.length === 0 ? "-- Choose Class First --" : "-- Choose Subject --"}
              </option>
              {subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-lamaSky hover:bg-[#1e40af] text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-sm transition-all duration-200 flex items-center justify-center gap-1.5"
          >
            Load Marksheet
          </button>
        </form>
      </div>

      {/* MARKSHEET */}
      {allSelected && currentExam ? (
        students.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center">
            <p className="text-gray-500 font-bold text-sm">No students found in this class.</p>
          </div>
        ) : (
          <MarksheetPortal
            examId={currentExam.id}
            examTitle={`${currentExam.title} — ${selectedSubject?.name ?? ""}`}
            subjectId={parseInt(selectedSubjectId!)}
            students={students}
            existingResults={existingResults}
            totalMarks={totalMarks}
          />
        )
      ) : (
        <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center flex flex-col items-center justify-center gap-4 py-20">
          <div className="w-16 h-16 rounded-full bg-lamaSkyLight flex items-center justify-center text-lamaSky text-2xl">
            📝
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-800">Select Exam Parameters</h2>
            <p className="text-xs text-gray-400 mt-1 max-w-sm">
              Pick the Exam, Class, and Subject above to load the student grade sheet.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
