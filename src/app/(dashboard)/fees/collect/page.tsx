import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import CollectorPortal from "./CollectorPortal";
import BillFeeForm from "./BillFeeForm";

export default async function CollectFeesPage({
  searchParams,
}: {
  searchParams: { classId?: string; studentId?: string; search?: string };
}) {
  const { role } = await auth();
  if (role !== "admin" && role !== "teacher") redirect("/");

  const selectedStudentId = searchParams.studentId;

  // ── SCREEN 2: Student detail ──────────────────────────────────────────────
  if (selectedStudentId) {
    const selectedStudent = await prisma.student.findUnique({
      where: { id: selectedStudentId },
      include: { class: true },
    });

    if (!selectedStudent) redirect("/fees/collect");

    const allCollections = await prisma.feeCollection.findMany({
      where: { studentId: selectedStudentId },
      orderBy: { id: "asc" },
    });
    const unpaidFees = allCollections.filter((c) => c.status === "UNPAID");
    const paidFees = allCollections.filter((c) => c.status === "PAID").reverse();

    const standardPackage = await prisma.feePackage.findFirst({
      where: {
        classId: selectedStudent.classId,
        type: "TUITION",
      },
    });
    const baseClassFee = standardPackage?.amount || 0;

    return (
      <div className="flex-1 bg-[#f8fafe]">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
          <Link
            href="/fees/collect"
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Students
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-xs font-bold text-gray-800">
            {selectedStudent.name} {selectedStudent.surname}
          </span>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Student profile card */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-4 items-start justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-lamaSkyLight opacity-30 rounded-full translate-x-8 -translate-y-8 pointer-events-none" />
            <div className="flex gap-4 items-center">
              <div className="w-12 h-12 rounded-full bg-lamaSkyLight flex items-center justify-center text-lamaSky text-xl font-black">
                {selectedStudent.name[0]}
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-800 flex items-center gap-2 flex-wrap">
                  {selectedStudent.name} {selectedStudent.surname}
                  <span className="text-xs font-semibold text-lamaSky bg-lamaSkyLight px-2 py-0.5 rounded-full">
                    Class {selectedStudent.class?.name || "Unassigned"}
                  </span>
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  ID: <span className="font-semibold text-gray-500">{selectedStudent.studentId}</span>
                </p>
              </div>
            </div>
            <div className="border-t sm:border-t-0 sm:border-l border-gray-100 pt-3 sm:pt-0 sm:pl-5 flex flex-col gap-0.5 flex-shrink-0">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Guardian</span>
              <span className="text-xs font-bold text-gray-700">
                {selectedStudent.guardianName || "—"}
              </span>
              <span className="text-xs text-gray-500">📞 {selectedStudent.guardianPhone || "—"}</span>
            </div>
          </div>

          {/* Fee ledger + sidebar */}
          <div className="grid gap-5 lg:grid-cols-3 items-start">
            <div className="lg:col-span-2">
              <CollectorPortal
                studentId={selectedStudent.id}
                studentName={`${selectedStudent.name} ${selectedStudent.surname}`}
                customTuitionFee={selectedStudent.customTuitionFee}
                baseClassFee={baseClassFee}
                unpaidFees={unpaidFees}
                paidFees={paidFees}
              />
            </div>
            <div className="flex flex-col gap-4">
              <BillFeeForm
                studentId={selectedStudent.id}
                studentName={`${selectedStudent.name} ${selectedStudent.surname}`}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── SCREEN 1: Student list ────────────────────────────────────────────────
  const selectedClassId = searchParams.classId ? parseInt(searchParams.classId) : null;
  const searchQuery = searchParams.search?.trim() || "";

  const classes = await prisma.class.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const students = await prisma.student.findMany({
    where: {
      ...(selectedClassId ? { classId: selectedClassId } : {}),
      ...(searchQuery
        ? {
            OR: [
              { name: { contains: searchQuery, mode: "insensitive" } },
              { surname: { contains: searchQuery, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      surname: true,
      class: { select: { name: true } },
    },
    orderBy: [{ name: "asc" }, { surname: "asc" }],
  });

  return (
    <div className="p-6 bg-[#f8fafe] flex-1 flex flex-col gap-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Accountant Portal</h1>
        <p className="text-sm text-gray-500 mt-0.5">Select a student to view or collect fees.</p>
      </div>

      {/* Filters row */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
        {/* Class tabs */}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/fees/collect"
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              !selectedClassId ? "bg-lamaSky text-white shadow-sm" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            All Classes
          </Link>
          {classes.map((cls) => (
            <Link
              key={cls.id}
              href={`/fees/collect?classId=${cls.id}`}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                selectedClassId === cls.id
                  ? "bg-lamaSky text-white shadow-sm"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              Class {cls.name}
            </Link>
          ))}
        </div>

        {/* Search */}
        <form className="flex gap-2">
          {selectedClassId && (
            <input type="hidden" name="classId" value={selectedClassId} />
          )}
          <input
            type="text"
            name="search"
            placeholder="Search by name..."
            defaultValue={searchQuery}
            className="flex-1 ring-1 ring-gray-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-lamaSky transition-all placeholder:text-gray-300"
          />
          <button
            type="submit"
            className="bg-lamaSky hover:bg-[#1e40af] text-white font-bold py-2.5 px-5 rounded-xl text-sm shadow-sm transition-colors"
          >
            Search
          </button>
          {searchQuery && (
            <Link
              href={selectedClassId ? `/fees/collect?classId=${selectedClassId}` : "/fees/collect"}
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 px-4 rounded-xl text-sm transition-colors"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* Student list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between rounded-t-2xl overflow-hidden">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            {students.length} Student{students.length !== 1 ? "s" : ""}
            {selectedClassId
              ? ` — Class ${classes.find((c) => c.id === selectedClassId)?.name}`
              : ""}
            {searchQuery ? ` matching "${searchQuery}"` : ""}
          </span>
        </div>

        {students.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <span className="text-3xl">🔍</span>
            <p className="text-sm font-bold text-gray-500">No students found</p>
            <p className="text-xs text-gray-400">Try a different class or search term.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {students.map((std) => (
              <Link
                key={std.id}
                href={`/fees/collect?studentId=${std.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="w-9 h-9 rounded-full bg-lamaSkyLight flex items-center justify-center text-lamaSky text-sm font-black flex-shrink-0 group-hover:bg-lamaSky group-hover:text-white transition-colors">
                  {std.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800">
                    {std.name} {std.surname}
                  </p>
                  <p className="text-xs text-gray-400">Class {std.class?.name || "—"}</p>
                </div>
                <svg
                  className="w-4 h-4 text-gray-300 group-hover:text-lamaSky transition-colors flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
