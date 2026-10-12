import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import PayrollPortal from "./PayrollPortal";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: { teacherId?: string; search?: string };
}) {
  const { role } = await auth();
  if (role !== "admin") redirect("/");

  const selectedTeacherId = searchParams.teacherId;

  // ── SCREEN 2: Teacher detail ──────────────────────────────────────────────
  if (selectedTeacherId) {
    const teacher = await prisma.teacher.findUnique({
      where: { id: selectedTeacherId },
      select: {
        id: true,
        name: true,
        surname: true,
        img: true,
        email: true,
        phone: true,
        monthlySalary: true,
        subjects: { select: { name: true } },
      },
    });

    if (!teacher) redirect("/salaries/payroll");

    const allSalaries = await prisma.salaryCollection.findMany({
      where: { teacherId: selectedTeacherId },
      orderBy: { month: "asc" },
    });

    const unpaidSalaries = allSalaries
      .filter((s) => s.status === "UNPAID")
      .map((s) => ({ ...s, status: s.status as "UNPAID", type: s.type as "SALARY" | "BONUS", bonus: s.bonus, deduction: s.deduction, note: s.note }));

    const paidSalaries = allSalaries
      .filter((s) => s.status === "PAID")
      .reverse()
      .map((s) => ({
        id: s.id,
        name: s.name,
        paidAmount: s.paidAmount,
        month: s.month,
        paidAt: s.paidAt,
        receiptNo: s.receiptNo,
      }));

    const totalPaid = paidSalaries.reduce((sum, s) => sum + s.paidAmount, 0);
    const totalUnpaid = unpaidSalaries.reduce((sum, s) => sum + s.amount, 0);

    return (
      <div className="flex-1 bg-[#f8fafe]">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
          <Link
            href="/salaries/payroll"
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All Teachers
          </Link>
          <span className="text-gray-300">/</span>
          <span className="text-xs font-bold text-gray-800">
            {teacher.name} {teacher.surname}
          </span>
        </div>

        <div className="p-6 flex flex-col gap-5">
          {/* Teacher profile card */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-4 items-start justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-lamaPurpleLight opacity-40 rounded-full translate-x-8 -translate-y-8 pointer-events-none" />
            <div className="flex gap-4 items-center">
              <Image
                src={teacher.img || "/noAvatar.png"}
                alt=""
                width={48}
                height={48}
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <h2 className="text-base font-bold text-gray-800">
                  {teacher.name} {teacher.surname}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {teacher.subjects.map((s) => s.name).join(", ") || "No subjects"}
                </p>
              </div>
            </div>

            <div className="flex gap-6 border-t sm:border-t-0 sm:border-l border-gray-100 pt-3 sm:pt-0 sm:pl-5 flex-shrink-0">
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Monthly Salary</span>
                <span className="text-sm font-extrabold text-gray-800">
                  {teacher.monthlySalary ? `৳${teacher.monthlySalary.toLocaleString()}` : "Not set"}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Paid</span>
                <span className="text-sm font-extrabold text-green-700">৳{totalPaid.toLocaleString()}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Outstanding</span>
                <span className="text-sm font-extrabold text-amber-600">৳{totalUnpaid.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Payroll portal */}
          <PayrollPortal
            teacherId={teacher.id}
            unpaidSalaries={unpaidSalaries}
            paidSalaries={paidSalaries}
          />
        </div>
      </div>
    );
  }

  // ── SCREEN 1: Teacher list ────────────────────────────────────────────────
  const searchQuery = searchParams.search?.trim() || "";

  const teachers = await prisma.teacher.findMany({
    where: searchQuery
      ? {
          OR: [
            { name: { contains: searchQuery, mode: "insensitive" } },
            { surname: { contains: searchQuery, mode: "insensitive" } },
          ],
        }
      : {},
    select: {
      id: true,
      name: true,
      surname: true,
      img: true,
      monthlySalary: true,
      subjects: { select: { name: true } },
      salaryCollections: {
        select: { status: true, amount: true },
      },
    },
    orderBy: [{ name: "asc" }],
  });

  return (
    <div className="p-6 bg-[#f8fafe] flex-1 flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Payroll Portal</h1>
        <p className="text-sm text-gray-500 mt-0.5">Select a teacher to view or process their salary.</p>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <form className="flex gap-2">
          <input
            type="text"
            name="search"
            placeholder="Search teachers by name..."
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
              href="/salaries/payroll"
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold py-2.5 px-4 rounded-xl text-sm transition-colors"
            >
              Clear
            </Link>
          )}
        </form>
      </div>

      {/* Teacher list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-5 py-3 border-b border-gray-50">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            {teachers.length} Teacher{teachers.length !== 1 ? "s" : ""}
            {searchQuery ? ` matching "${searchQuery}"` : ""}
          </span>
        </div>

        {teachers.length === 0 ? (
          <div className="py-16 text-center flex flex-col items-center gap-3">
            <span className="text-3xl">🔍</span>
            <p className="text-sm font-bold text-gray-500">No teachers found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {teachers.map((t) => {
              const unpaidCount = t.salaryCollections.filter((s) => s.status === "UNPAID").length;
              const unpaidTotal = t.salaryCollections
                .filter((s) => s.status === "UNPAID")
                .reduce((sum, s) => sum + s.amount, 0);
              return (
                <Link
                  key={t.id}
                  href={`/salaries/payroll?teacherId=${t.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors group"
                >
                  <Image
                    src={t.img || "/noAvatar.png"}
                    alt=""
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800">
                      {t.name} {t.surname}
                    </p>
                    <p className="text-xs text-gray-400">
                      {t.monthlySalary
                        ? `৳${t.monthlySalary.toLocaleString()}/mo`
                        : "No salary set"}{" "}
                      · {t.subjects.map((s) => s.name).join(", ") || "No subjects"}
                    </p>
                  </div>
                  {unpaidCount > 0 && (
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <span className="text-xs font-extrabold text-amber-600">
                        ৳{unpaidTotal.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-amber-500 font-semibold">
                        {unpaidCount} unpaid
                      </span>
                    </div>
                  )}
                  <svg
                    className="w-4 h-4 text-gray-300 group-hover:text-lamaSky transition-colors flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
