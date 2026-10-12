import { Fragment } from "react";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import PrintButton from "../fees/receipt/[receiptNo]/PrintButton";
import ReportCardMetaEditor from "./ReportCardMetaEditor";

// ── helpers ──────────────────────────────────────────────────────────────────

function gpaToGrade(gpa: number): string {
  if (gpa >= 5.0) return "A+";
  if (gpa >= 4.0) return "A";
  if (gpa >= 3.5) return "A-";
  if (gpa >= 3.0) return "B";
  if (gpa >= 2.0) return "C";
  if (gpa >= 1.0) return "D";
  return "F";
}


const SEM_LABELS = ["1st Semester", "2nd Semester", "3rd Semester", "4th Semester"];

const GRADING_TABLE = [
  { range: "80–100", grade: "A+", gp: "5.00" },
  { range: "70–79",  grade: "A",  gp: "4.00" },
  { range: "60–69",  grade: "A-", gp: "3.50" },
  { range: "50–59",  grade: "B",  gp: "3.00" },
  { range: "40–49",  grade: "C",  gp: "2.00" },
  { range: "33–39",  grade: "D",  gp: "1.00" },
  { range: "0–32",   grade: "F",  gp: "0.00" },
];

// ── page ─────────────────────────────────────────────────────────────────────

export default async function ReportCardsPage({
  searchParams,
}: {
  searchParams: { classId?: string; year?: string };
}) {
  const { role, userId } = await auth();
  if (!role || !userId) redirect("/");

  const selectedYear = searchParams.year ? parseInt(searchParams.year) : new Date().getFullYear();
  const selectedClassId = searchParams.classId ? parseInt(searchParams.classId) : undefined;

  const classes = await prisma.class.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // For students, resolve their classId automatically
  let autoClassId: number | undefined = selectedClassId;
  if (role === "student") {
    const me = await prisma.student.findUnique({ where: { id: userId }, select: { classId: true } });
    autoClassId = me?.classId;
  }

  const targetClassId = autoClassId;

  // Load semester exams for the year (ordered 1→4)
  const semesterExams = targetClassId
    ? await prisma.exam.findMany({
        where: { year: selectedYear, semesterNumber: { not: null } },
        orderBy: { semesterNumber: "asc" },
        include: {
          examSchedules: {
            where: { classId: targetClassId },
            include: { subject: true },
          },
        },
      })
    : [];

  // Load subjects for the class
  const subjects = targetClassId
    ? await prisma.subject.findMany({
        where: { classId: targetClassId },
        orderBy: { id: "asc" },
      })
    : [];

  // Load students with all their results for these exams + attendance + report card meta
  const examIds = semesterExams.map((e) => e.id);

  const semDates = semesterExams.flatMap((e) =>
    [e.semStartDate, e.semEndDate].filter(Boolean) as Date[]
  );
  const minDate = semDates.length ? new Date(Math.min(...semDates.map((d) => d.getTime()))) : undefined;
  const maxDate = semDates.length ? new Date(Math.max(...semDates.map((d) => d.getTime()))) : undefined;

  const studentsQuery =
    role === "student"
      ? { id: userId }
      : targetClassId
      ? { classId: targetClassId }
      : null;

  const students =
    studentsQuery && examIds.length > 0
      ? await prisma.student.findMany({
          where: studentsQuery,
          include: {
            class: true,
            results: {
              where: { examId: { in: examIds } },
              include: { subject: true },
            },
            attendances: minDate && maxDate
              ? { where: { classId: targetClassId, date: { gte: minDate, lte: maxDate } } }
              : { where: { classId: targetClassId } },
            reportCards: { where: { academicYear: String(selectedYear) } },
          },
          orderBy: [{ rollNo: "asc" }, { name: "asc" }],
        })
      : [];

  // Pre-compute highest mark per (examId, subjectId) across all students
  const highestMap = new Map<string, number>();
  for (const student of students) {
    for (const result of student.results) {
      if (!result.examId || !result.subjectId) continue;
      const key = `${result.examId}-${result.subjectId}`;
      const total = result.score + result.oralScore;
      highestMap.set(key, Math.max(highestMap.get(key) ?? 0, total));
    }
  }

  // Pre-compute class/section totals per exam for ranking
  const examTotalsMap = new Map<string, number>(); // `${examId}-${studentId}` → total score
  for (const student of students) {
    for (const exam of semesterExams) {
      const examResults = student.results.filter((r) => r.examId === exam.id);
      const total = examResults.reduce((s, r) => s + r.score + r.oralScore, 0);
      examTotalsMap.set(`${exam.id}-${student.id}`, total);
    }
    // Grand total
    const grandTotal = semesterExams.reduce((s, exam) => {
      return s + (examTotalsMap.get(`${exam.id}-${student.id}`) ?? 0);
    }, 0);
    examTotalsMap.set(`grand-${student.id}`, grandTotal);
  }

  // Build per-exam rank maps
  const examRanks = semesterExams.map((exam) => {
    const sorted = [...students]
      .map((s) => ({ id: s.id, section: s.section, total: examTotalsMap.get(`${exam.id}-${s.id}`) ?? 0 }))
      .sort((a, b) => b.total - a.total);
    const classRank = new Map<string, number>();
    const sectionRank = new Map<string, number>();
    const sectionCounters = new Map<string, number>();
    sorted.forEach((s, idx) => {
      classRank.set(s.id, idx + 1);
      const sec = s.section ?? "__";
      const secIdx = (sectionCounters.get(sec) ?? 0) + 1;
      sectionCounters.set(sec, secIdx);
      sectionRank.set(s.id, secIdx);
    });
    return { classRank, sectionRank };
  });

  const grandSorted = [...students]
    .map((s) => ({ id: s.id, section: s.section, total: examTotalsMap.get(`grand-${s.id}`) ?? 0 }))
    .sort((a, b) => b.total - a.total);
  const grandClassRank = new Map<string, number>();
  const grandSectionRank = new Map<string, number>();
  const grandSectionCounters = new Map<string, number>();
  grandSorted.forEach((s, idx) => {
    grandClassRank.set(s.id, idx + 1);
    const sec = s.section ?? "__";
    const secIdx = (grandSectionCounters.get(sec) ?? 0) + 1;
    grandSectionCounters.set(sec, secIdx);
    grandSectionRank.set(s.id, secIdx);
  });

  const hasData = students.length > 0 && semesterExams.length > 0;

  return (
    <div className="p-4 md:p-6 bg-[#f8fafe] flex-1 flex flex-col gap-6">

      {/* FILTER HEADER */}
      <div className="print:hidden flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Grand Final Transcript</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {role === "admin" || role === "teacher"
              ? "Select a class and year to generate the full 4-semester transcript."
              : "Your academic transcript across all semesters."}
          </p>
        </div>

        {(role === "admin" || role === "teacher") && (
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-end gap-4 justify-between">
            <form id="rc-filter" method="GET" action="/report-cards" className="grid gap-3 sm:grid-cols-2 flex-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500">Class</label>
                <select
                  name="classId"
                  className="ring-1 ring-gray-200 p-2.5 rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-lamaSky bg-white"
                  defaultValue={selectedClassId?.toString() || ""}
                >
                  <option value="">-- Select Class --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>Class {cls.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500">Academic Year</label>
                <select
                  name="year"
                  className="ring-1 ring-gray-200 p-2.5 rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-lamaSky bg-white"
                  defaultValue={selectedYear}
                >
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </form>
            <div className="flex gap-2">
              <button type="submit" form="rc-filter"
                className="bg-lamaSky hover:bg-[#1e40af] text-white font-bold py-2.5 px-6 rounded-xl text-xs shadow-sm transition-colors">
                Generate
              </button>
              {hasData && <PrintButton />}
            </div>
          </div>
        )}

        {role === "student" && hasData && (
          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
            <span className="text-xs text-gray-500 font-semibold">Print your transcript:</span>
            <PrintButton />
          </div>
        )}
      </div>

      {/* EMPTY STATE */}
      {!hasData && (
        <div className="bg-white p-12 rounded-2xl border border-gray-100 shadow-sm text-center py-20 print:hidden">
          <h2 className="text-base font-bold text-gray-800">
            {semesterExams.length === 0 && targetClassId
              ? `No semester exams found for ${selectedYear}. Make sure exams have a Semester Number and Year set.`
              : role === "admin" || role === "teacher"
              ? "Select Class and Year, then click Generate."
              : "No results published yet."}
          </h2>
        </div>
      )}

      {/* TRANSCRIPTS */}
      {hasData && students.map((student) => {
        const reportCard = student.reportCards[0];

        // Per-semester data
        const semData = semesterExams.map((exam, semIdx) => {
          const schedule = exam.examSchedules;

          const subjectData = subjects.map((subj) => {
            const sch = schedule.find((s) => s.subjectId === subj.id);
            const fullMark = sch?.totalMarks ?? 100;
            const result = student.results.find(
              (r) => r.examId === exam.id && r.subjectId === subj.id
            );
            const writtenScore = result?.score ?? null;
            const oralScore = result?.oralScore ?? 0;
            const totalScore = writtenScore !== null ? writtenScore + oralScore : null;
            const highest = highestMap.get(`${exam.id}-${subj.id}`) ?? null;
            const gpa = result?.gpa ?? null;
            const grade = result?.grade ?? null;
            return { subj, fullMark, writtenScore, oralScore, totalScore, highest, gpa, grade };
          });

          const scores = subjectData.filter((s) => s.totalScore !== null);
          const totalMarks = scores.reduce((s, d) => s + (d.totalScore ?? 0), 0);
          const avgGpa = scores.length
            ? parseFloat((scores.reduce((s, d) => s + (d.gpa ?? 0), 0) / scores.length).toFixed(2))
            : 0;
          const overallGrade = gpaToGrade(avgGpa);
          const failedCount = scores.filter((d) => d.grade === "F").length;

          // Attendance for this semester
          let workingDays = 0, present = 0, absent = 0;
          if (exam.semStartDate && exam.semEndDate) {
            const start = exam.semStartDate.getTime();
            const end = exam.semEndDate.getTime();
            const inRange = student.attendances.filter((a) => {
              const t = new Date(a.date).getTime();
              return t >= start && t <= end;
            });
            const uniqueDates = new Set(inRange.map((a) => new Date(a.date).toDateString()));
            workingDays = uniqueDates.size;
            present = inRange.filter((a) => a.present).length;
            absent = workingDays - present;
          }

          const classPos = examRanks[semIdx]?.classRank.get(student.id) ?? "-";
          const sectionPos = examRanks[semIdx]?.sectionRank.get(student.id) ?? "-";

          return {
            exam, subjectData, totalMarks, avgGpa, overallGrade, failedCount,
            workingDays, present, absent, classPos, sectionPos,
          };
        });

        // Grand final
        const grandTotal = semData.reduce((s, d) => s + d.totalMarks, 0);
        const grandAvgGpa = semData.length
          ? parseFloat((semData.reduce((s, d) => s + d.avgGpa, 0) / semData.length).toFixed(2))
          : 0;
        const grandGrade = gpaToGrade(grandAvgGpa);
        const grandFailed = semData.reduce((s, d) => s + d.failedCount, 0);
        const grandWorkingDays = semData.reduce((s, d) => s + d.workingDays, 0);
        const grandPresent = semData.reduce((s, d) => s + d.present, 0);
        const grandAbsent = semData.reduce((s, d) => s + d.absent, 0);
        const grandClassPos = grandClassRank.get(student.id) ?? "-";
        const grandSectionPos = grandSectionRank.get(student.id) ?? "-";

        return (
          <div key={student.id} className="transcript-page bg-white border border-gray-800 print:border-black print:shadow-none print:m-0 print:rounded-none" style={{ fontFamily: "Arial, sans-serif" }}>

            {/* ── HEADER ────────────────────────────────────────── */}
            <div className="flex items-start justify-between px-3 pt-2 pb-1 border-b border-gray-700 print:border-black gap-2">
              {/* Student photo */}
              <div className="flex-shrink-0 w-16 h-20 border border-gray-400 overflow-hidden bg-gray-100">
                {student.img
                  ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={student.img} alt="" className="w-full h-full object-cover" />
                  )
                  : <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-400">Photo</div>}
              </div>

              {/* School name + title */}
              <div className="flex-1 text-center">
                <div className="text-[13px] font-black uppercase tracking-wide">Progga Preparatory & High School</div>
                <div className="text-[8px] text-gray-600">Dhaka, Bangladesh</div>
                <div className="mt-1 inline-block border border-gray-700 px-4 py-0.5 text-[9px] font-bold uppercase tracking-widest">
                  Grand Final Transcript
                </div>
              </div>

              {/* School logo */}
              <div className="flex-shrink-0 w-14 h-14 mx-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/school-logo.jpg" alt="Logo" className="w-full h-full object-contain" />
              </div>

              {/* Grading system */}
              <div className="flex-shrink-0 text-[7px] border border-gray-500">
                <div className="bg-gray-200 font-bold text-center py-0.5 px-1">Grading System</div>
                <table className="border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-400 px-1 py-0 text-[6px]">Range</th>
                      <th className="border border-gray-400 px-1 py-0 text-[6px]">Grade</th>
                      <th className="border border-gray-400 px-1 py-0 text-[6px]">GP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GRADING_TABLE.map((row) => (
                      <tr key={row.grade}>
                        <td className="border border-gray-400 px-1 py-0 text-center">{row.range}</td>
                        <td className="border border-gray-400 px-1 py-0 text-center font-bold">{row.grade}</td>
                        <td className="border border-gray-400 px-1 py-0 text-center">{row.gp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── STUDENT INFO ──────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-x-4 px-3 py-1 border-b border-gray-600 print:border-black text-[8px]">
              <div className="flex flex-col gap-0.5">
                <div><span className="font-semibold">Name of Student</span> : {student.name} {student.surname}</div>
                <div><span className="font-semibold">Father&apos;s Name</span> : {student.fatherName || "—"}</div>
                <div><span className="font-semibold">Mother&apos;s Name</span> : {student.motherName || "—"}</div>
              </div>
              <div className="flex flex-col gap-0.5">
                <div><span className="font-semibold">Student ID</span> : {student.studentId}</div>
                <div><span className="font-semibold">Roll No</span> : {student.rollNo ?? "—"}</div>
                <div><span className="font-semibold">Academic Year</span> : {selectedYear}</div>
              </div>
              <div className="flex flex-col gap-0.5">
                <div><span className="font-semibold">Class</span> : {student.class?.name || "—"}</div>
                <div><span className="font-semibold">Group</span> : {student.group || "—"}</div>
                <div><span className="font-semibold">Section</span> : {student.section || "—"} &nbsp;&nbsp; <span className="font-semibold">Shift</span> : {student.shift || "—"}</div>
              </div>
            </div>

            {/* ── SUBJECT MARKS TABLE ───────────────────────────── */}
            <div>
              <table className="w-full border-collapse text-[7px]" style={{ tableLayout: "fixed" }}>
                <colgroup>
                  {/* Subject name col */}
                  <col style={{ width: "13%" }} />
                  {/* 7 cols per semester × number of semesters */}
                  {semesterExams.flatMap((_, i) => [
                    <col key={`${i}-fm`}  style={{ width: "3%" }} />,
                    <col key={`${i}-hm`}  style={{ width: "3%" }} />,
                    <col key={`${i}-or`}  style={{ width: "2.5%" }} />,
                    <col key={`${i}-wr`}  style={{ width: "3%" }} />,
                    <col key={`${i}-tot`} style={{ width: "3%" }} />,
                    <col key={`${i}-gp`}  style={{ width: "2.5%" }} />,
                    <col key={`${i}-gr`}  style={{ width: "4%" }} />,
                  ])}
                </colgroup>
                <thead>
                  <tr className="bg-gray-100 border border-gray-500">
                    <th className="border border-gray-500 px-1 py-0.5 text-center align-middle" rowSpan={2}>Subject Name</th>
                    {semesterExams.map((exam, i) => (
                      <th key={i} className="border border-gray-500 px-0.5 py-0.5 text-center" colSpan={7}>
                        {SEM_LABELS[i] || exam.title}
                      </th>
                    ))}
                  </tr>
                  <tr className="bg-gray-50 border border-gray-500">
                    {semesterExams.map((_, i) => (
                      <Fragment key={i}>
                        <th className="border border-gray-500 px-0 py-0.5 text-center">FM</th>
                        <th className="border border-gray-500 px-0 py-0.5 text-center">HM</th>
                        <th className="border border-gray-500 px-0 py-0.5 text-center">Oral</th>
                        <th className="border border-gray-500 px-0 py-0.5 text-center">WR</th>
                        <th className="border border-gray-500 px-0 py-0.5 text-center">Total</th>
                        <th className="border border-gray-500 px-0 py-0.5 text-center">GP</th>
                        <th className="border border-gray-500 px-0 py-0.5 text-center">Grade</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subjects.map((subj) => (
                    <tr key={subj.id} className="border border-gray-400">
                      <td className="border border-gray-400 px-1 py-0.5 font-semibold truncate">{subj.name}</td>
                      {semData.map((sem, i) => {
                        const d = sem.subjectData.find((s) => s.subj.id === subj.id);
                        return (
                          <Fragment key={i}>
                            <td className="border border-gray-400 px-0 py-0.5 text-center">{d?.fullMark ?? "—"}</td>
                            <td className="border border-gray-400 px-0 py-0.5 text-center">{d?.highest ?? "—"}</td>
                            <td className="border border-gray-400 px-0 py-0.5 text-center">{d?.oralScore ? d.oralScore : "–"}</td>
                            <td className="border border-gray-400 px-0 py-0.5 text-center">{d?.writtenScore ?? "—"}</td>
                            <td className="border border-gray-400 px-0 py-0.5 text-center font-semibold">{d?.totalScore ?? "—"}</td>
                            <td className="border border-gray-400 px-0 py-0.5 text-center">{d?.gpa != null ? d.gpa.toFixed(0) : "—"}</td>
                            <td className={`border border-gray-400 px-0 py-0.5 text-center font-bold ${d?.grade === "F" ? "text-red-600" : ""}`}>{d?.grade ?? "—"}</td>
                          </Fragment>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── EXAM SUMMARY TABLE ────────────────────────────── */}
            <div className="border-t border-gray-500">
              <table className="w-full border-collapse text-[7px]">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-500 px-1 py-0.5">Exam Name</th>
                    <th className="border border-gray-500 px-1 py-0.5">Total Marks</th>
                    <th className="border border-gray-500 px-1 py-0.5">GPA</th>
                    <th className="border border-gray-500 px-1 py-0.5">Grade</th>
                    <th className="border border-gray-500 px-1 py-0.5">Result</th>
                    <th className="border border-gray-500 px-1 py-0.5">Failed Subj.</th>
                    <th className="border border-gray-500 px-1 py-0.5">Class Pos.</th>
                    <th className="border border-gray-500 px-1 py-0.5">Section Pos.</th>
                    <th className="border border-gray-500 px-1 py-0.5">Working Days</th>
                    <th className="border border-gray-500 px-1 py-0.5">Present</th>
                    <th className="border border-gray-500 px-1 py-0.5">Absent</th>
                  </tr>
                </thead>
                <tbody>
                  {semData.map((sem, i) => {
                    const hasMarks = sem.totalMarks > 0;
                    const resultLabel = !hasMarks ? "—" : sem.failedCount > 0 ? "Failed" : "Passed";
                    const resultColor = !hasMarks ? "" : sem.failedCount > 0 ? "text-red-600" : "text-green-700";
                    return (
                    <tr key={i} className="border border-gray-400">
                      <td className="border border-gray-400 px-1 py-0.5 font-semibold">{SEM_LABELS[i] || sem.exam.title}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{hasMarks ? sem.totalMarks : "—"}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{hasMarks ? sem.avgGpa : "—"}</td>
                      <td className={`border border-gray-400 px-1 py-0.5 text-center font-bold ${hasMarks && sem.overallGrade === "F" ? "text-red-600" : ""}`}>{hasMarks ? sem.overallGrade : "—"}</td>
                      <td className={`border border-gray-400 px-1 py-0.5 text-center font-bold ${resultColor}`}>
                        {resultLabel}
                      </td>
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{hasMarks ? sem.failedCount : "—"}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{sem.classPos}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{sem.sectionPos}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{sem.workingDays || "—"}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{sem.present || "—"}</td>
                      <td className="border border-gray-400 px-1 py-0.5 text-center">{sem.absent || "—"}</td>
                    </tr>
                    );
                  })}
                  {/* Grand Final row */}
                  {(() => {
                    const grandHasMarks = grandTotal > 0;
                    const grandResult = !grandHasMarks ? "—" : grandFailed > 0 ? "Failed" : "Passed";
                    const grandResultColor = !grandHasMarks ? "" : grandFailed > 0 ? "text-red-600" : "text-green-700";
                    return (
                  <tr className="bg-gray-100 font-bold border border-gray-500">
                    <td className="border border-gray-500 px-1 py-0.5">Grand Final</td>
                    <td className="border border-gray-500 px-1 py-0.5 text-center">{grandHasMarks ? (grandTotal / Math.max(semData.length, 1)).toFixed(2) : "—"}</td>
                    <td className="border border-gray-500 px-1 py-0.5 text-center">{grandHasMarks ? grandAvgGpa : "—"}</td>
                    <td className={`border border-gray-500 px-1 py-0.5 text-center ${grandHasMarks && grandGrade === "F" ? "text-red-600" : ""}`}>{grandHasMarks ? grandGrade : "—"}</td>
                    <td className={`border border-gray-500 px-1 py-0.5 text-center ${grandResultColor}`}>
                      {grandResult}
                    </td>
                    <td className="border border-gray-500 px-1 py-0.5 text-center">{grandFailed}</td>
                    <td className="border border-gray-500 px-1 py-0.5 text-center">{grandClassPos}</td>
                    <td className="border border-gray-500 px-1 py-0.5 text-center">{grandSectionPos}</td>
                    <td className="border border-gray-500 px-1 py-0.5 text-center">{grandWorkingDays || "—"}</td>
                    <td className="border border-gray-500 px-1 py-0.5 text-center">{grandPresent || "—"}</td>
                    <td className="border border-gray-500 px-1 py-0.5 text-center">{grandAbsent || "—"}</td>
                  </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>

            {/* ── BOTTOM SECTION ────────────────────────────────── */}
            <div className="flex gap-0 border-t border-gray-500">
              {/* Moral & Co-curricular */}
              <div className="flex-1 border-r border-gray-500 px-2 py-1">
                <div className="text-[7px] font-bold mb-1 border-b border-gray-300 pb-0.5">Moral &amp; Behavior Evaluation</div>
                <div className="flex gap-3 text-[7px] mb-2">
                  {["Best", "Better", "Good", "Need Improvement"].map((label) => (
                    <label key={label} className="flex items-center gap-0.5">
                      <span className={`inline-block w-3 h-3 border border-gray-600 text-center leading-3 text-[8px] ${reportCard?.moralBehavior === label ? "bg-gray-800 text-white" : ""}`}>
                        {reportCard?.moralBehavior === label ? "✓" : ""}
                      </span>
                      {label}
                    </label>
                  ))}
                </div>
                <div className="text-[7px] font-bold mb-1 border-b border-gray-300 pb-0.5">Co-Curricular Activities</div>
                <div className="flex gap-3 text-[7px]">
                  {(["Sports", "Cultural Function", "Scout/BNC", "Math/Olympiad"] as const).map((label, idx) => {
                    const keys = ["sports", "culturalFunction", "scoutBnc", "mathOlympiad"] as const;
                    const checked = reportCard?.[keys[idx]] ?? false;
                    return (
                      <label key={label} className="flex items-center gap-0.5">
                        <span className={`inline-block w-3 h-3 border border-gray-600 text-center leading-3 text-[8px] ${checked ? "bg-gray-800 text-white" : ""}`}>
                          {checked ? "✓" : ""}
                        </span>
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Comments */}
              <div className="flex-1 px-2 py-1 flex flex-col justify-between">
                <div>
                  <div className="text-[7px] font-bold mb-1 border-b border-gray-300 pb-0.5">Comments</div>
                  <div className="text-[8px] font-semibold min-h-[20px]">
                    {reportCard?.comments || "YOUR RESULT IS SATISFACTORY"}
                  </div>
                </div>
              </div>
            </div>

            {/* ── SIGNATURES ────────────────────────────────────── */}
            <div className="flex justify-between items-end px-8 py-2 border-t border-gray-500 mt-1">
              <div className="text-center text-[8px]">
                <div className="border-t border-gray-600 w-32 mt-8 pt-1">Class Teacher</div>
              </div>
              <div className="text-center text-[8px]">
                <div className="border-t border-gray-600 w-32 mt-8 pt-1">Headmaster</div>
              </div>
            </div>

            {/* ── ADMIN EDITOR (hidden on print) ────────────────── */}
            {(role === "admin" || role === "teacher") && (
              <div className="print:hidden border-t border-dashed border-gray-300 p-3 bg-gray-50">
                <ReportCardMetaEditor
                  studentId={student.id}
                  studentName={`${student.name} ${student.surname}`}
                  academicYear={String(selectedYear)}
                  initialData={{
                    comments: reportCard?.comments ?? "",
                    moralBehavior: reportCard?.moralBehavior ?? "",
                    sports: reportCard?.sports ?? false,
                    culturalFunction: reportCard?.culturalFunction ?? false,
                    scoutBnc: reportCard?.scoutBnc ?? false,
                    mathOlympiad: reportCard?.mathOlympiad ?? false,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page { size: A4 landscape; margin: 5mm; }

          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Reset outer layout so it doesn't clip content */
          .h-screen {
            height: auto !important;
            overflow: visible !important;
          }
          .overflow-y-auto {
            overflow: visible !important;
          }

          /* Each transcript is its own print page */
          .transcript-page {
            page-break-after: always !important;
            break-after: page !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            border: 1px solid black !important;
            font-size: 7px !important;
            width: 100% !important;
            overflow: hidden !important;
            margin: 0 !important;
          }

          /* Hide UI chrome */
          .print\\:hidden { display: none !important; }
        }
      `}} />
    </div>
  );
}
