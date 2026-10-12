import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";

const getCgpaGrade = (cgpa: number) => {
  if (cgpa >= 5.0) return "A+";
  if (cgpa >= 4.0) return "A";
  if (cgpa >= 3.5) return "A-";
  if (cgpa >= 3.0) return "B";
  if (cgpa >= 2.0) return "C";
  if (cgpa >= 1.0) return "D";
  return "F";
};

const gradeColor = (grade: string) => {
  if (grade === "A+" || grade === "A") return "text-emerald-600 font-black";
  if (grade === "A-" || grade === "B") return "text-blue-600 font-bold";
  if (grade === "C" || grade === "D") return "text-amber-600 font-bold";
  return "text-red-500 font-black";
};

const scoreCell = (score: number | null, grade: string | null) => {
  if (score === null) return { bg: "bg-gray-50", text: "text-gray-300" };
  const g = grade ?? "F";
  if (g === "F") return { bg: "bg-red-50", text: "text-red-500 font-bold" };
  if (g === "D" || g === "C") return { bg: "bg-amber-50", text: "text-amber-700 font-semibold" };
  if (g === "A+" || g === "A") return { bg: "bg-emerald-50", text: "text-emerald-700 font-semibold" };
  return { bg: "bg-white", text: "text-gray-700 font-semibold" };
};

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: { examId?: string; classId?: string };
}) {
  const { role, userId } = await auth();

  if (role === "student") redirect("/report-cards");
  if (!role || !userId) redirect("/");

  const selectedExamId = searchParams.examId ? parseInt(searchParams.examId) : undefined;
  const selectedClassId = searchParams.classId ? parseInt(searchParams.classId) : undefined;

  const [exams, classes] = await Promise.all([
    prisma.exam.findMany({ orderBy: { id: "desc" } }),
    prisma.class.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  let subjects: { id: number; name: string }[] = [];
  let students: any[] = [];
  const selectedExam = exams.find((e) => e.id === selectedExamId) ?? null;
  const selectedClass = classes.find((c) => c.id === selectedClassId) ?? null;

  if (selectedExamId && selectedClassId) {
    [subjects, students] = await Promise.all([
      prisma.subject.findMany({
        where: { classId: selectedClassId },
        orderBy: { name: "asc" },
      }),
      prisma.student.findMany({
        where: { classId: selectedClassId },
        include: {
          results: {
            where: { examId: selectedExamId },
            select: { subjectId: true, score: true, grade: true, gpa: true },
          },
        },
        orderBy: { surname: "asc" },
      }),
    ]);
  }

  // Build pivot: one row per student, one column per subject
  const pivotRows = students.map((student) => {
    const resultMap: Record<number, { score: number; grade: string; gpa: number }> = {};
    for (const r of student.results) {
      if (r.subjectId != null) {
        resultMap[r.subjectId] = { score: r.score, grade: r.grade ?? "F", gpa: r.gpa ?? 0 };
      }
    }
    const subjectCells = subjects.map((sub) => resultMap[sub.id] ?? null);
    const entered = subjectCells.filter(Boolean);
    const cgpa =
      entered.length > 0
        ? parseFloat((entered.reduce((s, r) => s + r!.gpa, 0) / entered.length).toFixed(2))
        : 0;
    return { student, cells: subjectCells, cgpa, grade: getCgpaGrade(cgpa), entered: entered.length };
  });

  // Column averages
  const subjectAvgs = subjects.map((_, i) => {
    const scores = pivotRows.map((r) => r.cells[i]?.score).filter((s): s is number => s != null);
    return scores.length > 0 ? parseFloat((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)) : null;
  });
  const cgpaAvg =
    pivotRows.length > 0
      ? parseFloat((pivotRows.reduce((s, r) => s + r.cgpa, 0) / pivotRows.length).toFixed(2))
      : null;

  const passCount = pivotRows.filter((r) => r.grade !== "F" && r.entered > 0).length;

  const hasData = selectedExamId && selectedClassId;

  return (
    <div className="p-4 md:p-6 bg-[#f8fafe] flex-1 flex flex-col gap-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Class Results</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Select an exam and class to view the full performance breakdown.
        </p>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
        <form method="GET" action="/list/results" className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-xs font-semibold text-gray-500">Exam</label>
            <select
              name="examId"
              className="ring-1 ring-gray-200 p-2.5 rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-lamaSky transition-all bg-white"
              defaultValue={selectedExamId?.toString() ?? ""}
            >
              <option value="">-- Select Exam --</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-xs font-semibold text-gray-500">Class</label>
            <select
              name="classId"
              className="ring-1 ring-gray-200 p-2.5 rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-lamaSky transition-all bg-white"
              defaultValue={selectedClassId?.toString() ?? ""}
            >
              <option value="">-- Select Class --</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  Class {cls.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="bg-lamaSky hover:bg-[#1e40af] text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-sm transition-colors whitespace-nowrap"
          >
            View Results
          </button>
        </form>
      </div>

      {/* SUMMARY STRIP */}
      {hasData && students.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Exam", value: selectedExam?.title ?? "—" },
            { label: "Class", value: `Class ${selectedClass?.name ?? "—"}` },
            { label: "Students", value: pivotRows.length },
            {
              label: "Pass Rate",
              value: pivotRows.length > 0 ? `${Math.round((passCount / pivotRows.length) * 100)}%` : "—",
            },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{stat.label}</p>
              <p className="text-lg font-extrabold text-gray-800 mt-0.5 truncate">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* PIVOT TABLE */}
      {!hasData ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center py-20">
          <div className="w-14 h-14 rounded-full bg-lamaSkyLight flex items-center justify-center text-lamaSky text-2xl mx-auto mb-4">
            📊
          </div>
          <h2 className="text-base font-bold text-gray-800">Select Exam and Class</h2>
          <p className="text-xs text-gray-400 mt-1">Use the filters above to load the class results sheet.</p>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center py-20">
          <p className="text-sm font-bold text-gray-500">No students found in this class.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left py-3 px-4 text-[10px] uppercase font-bold text-gray-400 tracking-wider sticky left-0 bg-gray-50 min-w-[160px]">
                    Student
                  </th>
                  {subjects.map((sub) => (
                    <th
                      key={sub.id}
                      className="py-3 px-3 text-[10px] uppercase font-bold text-gray-400 tracking-wider text-center min-w-[80px]"
                    >
                      {sub.name.length > 10 ? sub.name.slice(0, 10) + "…" : sub.name}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-[10px] uppercase font-bold text-gray-400 tracking-wider text-center min-w-[70px] border-l border-gray-100">
                    CGPA
                  </th>
                  <th className="py-3 px-4 text-[10px] uppercase font-bold text-gray-400 tracking-wider text-center min-w-[60px]">
                    Grade
                  </th>
                </tr>
              </thead>
              <tbody>
                {pivotRows.map(({ student, cells, cgpa, grade, entered }) => (
                  <tr key={student.id} className="border-b border-gray-50 hover:bg-[#f8fafe] transition-colors">
                    <td className="py-3 px-4 sticky left-0 bg-white hover:bg-[#f8fafe]">
                      <p className="font-bold text-gray-800">{student.name} {student.surname}</p>
                      {entered === 0 && (
                        <p className="text-[10px] text-gray-300 mt-0.5">No marks entered</p>
                      )}
                    </td>
                    {cells.map((cell, i) => {
                      const { bg, text } = scoreCell(cell?.score ?? null, cell?.grade ?? null);
                      return (
                        <td key={i} className={`py-3 px-3 text-center ${bg}`}>
                          <span className={text}>{cell ? cell.score : "—"}</span>
                        </td>
                      );
                    })}
                    <td className={`py-3 px-4 text-center border-l border-gray-100 ${entered === 0 ? "text-gray-300" : ""}`}>
                      {entered > 0 ? (
                        <span className={`text-sm font-extrabold ${gradeColor(grade)}`}>{cgpa.toFixed(2)}</span>
                      ) : "—"}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {entered > 0 ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          grade === "F"
                            ? "bg-red-100 text-red-600"
                            : grade === "A+" || grade === "A"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-100 text-gray-600"
                        }`}>
                          {grade}
                        </span>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* CLASS AVERAGE ROW */}
              <tfoot>
                <tr className="bg-lamaSkyLight border-t-2 border-lamaSky/20">
                  <td className="py-3 px-4 sticky left-0 bg-lamaSkyLight">
                    <p className="text-[10px] uppercase font-bold text-lamaSky tracking-wider">Class Average</p>
                  </td>
                  {subjectAvgs.map((avg, i) => (
                    <td key={i} className="py-3 px-3 text-center">
                      {avg !== null ? (
                        <span className="font-bold text-gray-700">{avg}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  ))}
                  <td className="py-3 px-4 text-center border-l border-lamaSky/20">
                    {cgpaAvg !== null ? (
                      <span className={`text-sm font-extrabold ${gradeColor(getCgpaGrade(cgpaAvg))}`}>
                        {cgpaAvg.toFixed(2)}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {cgpaAvg !== null ? (
                      <span className="text-xs font-bold text-lamaSky">{getCgpaGrade(cgpaAvg)}</span>
                    ) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
