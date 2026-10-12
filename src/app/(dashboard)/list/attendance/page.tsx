import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import AttendancePortal from "./AttendancePortal";
import AttendanceAnalytics from "./AttendanceAnalytics";
import Link from "next/link";
import { getSchoolDateString, parseDateOnlyUtc } from "@/lib/schoolDate";

interface PageProps {
  searchParams: {
    classId?: string;
    date?: string;
  };
}

export default async function AttendancePage({ searchParams }: PageProps) {
  const { role, userId } = await auth();

  if (!role || !userId) {
    redirect("/login");
  }

  const isAdminOrTeacher = role === "admin" || role === "teacher";

  const todayStr = getSchoolDateString();
  const requestedDate = searchParams.date ? parseDateOnlyUtc(searchParams.date) : null;
  const selectedDate = requestedDate ? searchParams.date! : todayStr;

  if (isAdminOrTeacher) {
    const classes = await prisma.class.findMany({
      where: role === "teacher" ? { lessons: { some: { teacherId: userId } } } : {},
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    const selectedClassId = searchParams.classId || classes[0]?.id.toString();

    let students: { id: string; name: string; surname: string }[] = [];
    let existingAttendance: { studentId: string; present: boolean }[] = [];
    let currentClass: { id: number; name: string } | null = null;

    if (selectedClassId) {
      currentClass = classes.find((c) => c.id === parseInt(selectedClassId)) ?? null;

      if (currentClass) {
        students = await prisma.student.findMany({
          where: { classId: currentClass.id },
          select: { id: true, name: true, surname: true },
          orderBy: { name: "asc" },
        });

        const attendanceDate = parseDateOnlyUtc(selectedDate)!;

        existingAttendance = await prisma.attendance.findMany({
          where: {
            classId: currentClass.id,
            date: {
              gte: attendanceDate,
              lt: new Date(attendanceDate.getTime() + 24 * 60 * 60 * 1000),
            },
          },
          select: { studentId: true, present: true },
        });
      }
    }

    return (
      <div className="p-6 bg-[#f8fafe] flex-1 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Attendance Register</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Record daily class presence, track absentees, and manage routine roll calls.
            </p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-white border border-gray-100 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-bold shadow-sm transition-all duration-200 self-end"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* FILTERS */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <form method="GET" action="/list/attendance" className="grid gap-4 sm:grid-cols-3 items-end">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Select Class</label>
              <select
                name="classId"
                className="ring-1 ring-gray-200 p-2.5 rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-lamaSky transition-all bg-white font-medium text-gray-700"
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

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500">Register Date</label>
              <input
                type="date"
                name="date"
                defaultValue={selectedDate}
                className="ring-1 ring-gray-200 p-2.5 rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-lamaSky transition-all bg-white font-medium text-gray-700"
              />
            </div>

            <button
              type="submit"
              className="bg-lamaSky hover:bg-[#1e40af] text-white font-bold p-2.5 rounded-xl text-xs transition-all duration-200 shadow-sm flex items-center justify-center gap-1.5 w-full"
            >
              🔍 Load Register
            </button>
          </form>
        </div>

        {selectedClassId && currentClass ? (
          students.length > 0 ? (
            <AttendancePortal
              classId={currentClass.id}
              className={currentClass.name}
              date={selectedDate}
              students={students}
              existingAttendance={existingAttendance}
            />
          ) : (
            <div className="bg-white p-12 text-center border border-gray-100 rounded-2xl shadow-sm">
              <span className="text-3xl block mb-2">👥</span>
              <h3 className="text-sm font-bold text-gray-700">No Students Found</h3>
              <p className="text-xs text-gray-400 mt-1">
                There are no students enrolled in Class {currentClass.name}.
              </p>
            </div>
          )
        ) : (
          <div className="bg-white p-12 text-center border border-gray-100 rounded-2xl shadow-sm flex flex-col items-center justify-center">
            <span className="text-3xl block mb-2">📅</span>
            <h3 className="text-sm font-bold text-gray-700">Select Class & Date</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Choose a class and date to load the attendance register.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Student view — personal read-only analytics
  if (role === "student") {
    const student = await prisma.student.findUnique({
      where: { id: userId },
      select: { id: true, name: true, surname: true },
    });

    const records = await prisma.attendance.findMany({
      where: { studentId: userId },
      include: {
        class: { select: { name: true } },
      },
      orderBy: { date: "desc" },
    });

    return (
      <div className="p-6 bg-[#f8fafe] flex-1 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Attendance Record</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Your personal daily presence history and visual attendance percentage cards.
            </p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-white border border-gray-100 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-bold shadow-sm transition-all duration-200 self-end"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {student ? (
          <AttendanceAnalytics
            studentName={`${student.name} ${student.surname}`}
            studentId={student.id}
            records={records}
          />
        ) : (
          <div className="bg-white p-12 text-center border border-gray-100 rounded-2xl shadow-sm">
            <span className="text-3xl block mb-2">📂</span>
            <h3 className="text-sm font-bold text-gray-700">No Student Records Found</h3>
            <p className="text-xs text-gray-400 mt-1">
              We couldn&apos;t retrieve any student profile connected to this session.
            </p>
          </div>
        )}
      </div>
    );
  }

  redirect("/");
}
