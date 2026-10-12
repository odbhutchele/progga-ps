import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FeeStatus, SalaryStatus } from "@prisma/client";
import ClickableRow from "@/components/ClickableRow";

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: { search?: string; status?: string; type?: string };
}) {
  const { role, userId } = await auth();
  if (!role || !userId) redirect("/");
  if (!["admin", "student", "teacher"].includes(role)) redirect("/");

  const statusFilter = searchParams.status; // "PAID" | "UNPAID"
  const typeFilter = searchParams.type;     // "fee" | "salary"
  const searchQuery = searchParams.search?.trim() || "";

  // ── Fetch fee collections ─────────────────────────────────────────────────
  const showFees = role === "admin" || role === "student";
  const showSalaries = role === "admin" || role === "teacher";

  const feeCollections = showFees
    ? await prisma.feeCollection.findMany({
        where: {
          ...(role === "student" ? { studentId: userId } : {}),
          ...(statusFilter ? { status: statusFilter as FeeStatus } : {}),
          ...(searchQuery
            ? {
                OR: [
                  { name: { contains: searchQuery, mode: "insensitive" } },
                  { receiptNo: { contains: searchQuery, mode: "insensitive" } },
                  {
                    student: {
                      OR: [
                        { name: { contains: searchQuery, mode: "insensitive" } },
                        { surname: { contains: searchQuery, mode: "insensitive" } },
                      ],
                    },
                  },
                ],
              }
            : {}),
        },
        include: {
          student: {
            select: { id: true, name: true, surname: true, class: { select: { name: true } } },
          },
        },
      })
    : [];

  const salaryCollections = showSalaries
    ? await prisma.salaryCollection.findMany({
        where: {
          ...(role === "teacher" ? { teacherId: userId } : {}),
          ...(statusFilter ? { status: statusFilter as SalaryStatus } : {}),
          ...(searchQuery
            ? {
                OR: [
                  { name: { contains: searchQuery, mode: "insensitive" } },
                  { receiptNo: { contains: searchQuery, mode: "insensitive" } },
                  {
                    teacher: {
                      OR: [
                        { name: { contains: searchQuery, mode: "insensitive" } },
                        { surname: { contains: searchQuery, mode: "insensitive" } },
                      ],
                    },
                  },
                ],
              }
            : {}),
        },
        include: {
          teacher: { select: { id: true, name: true, surname: true } },
        },
      })
    : [];

  // ── Normalise into a unified list ─────────────────────────────────────────
  type LedgerRow = {
    key: string;
    type: "fee" | "salary";
    receiptNo: string | null;
    personName: string;
    personSub: string;   // class name or "Teacher"
    description: string;
    month: string | null;
    amount: number;
    paidAt: Date | null;
    status: "PAID" | "UNPAID";
    actionHref: string;
    receiptHref: string | null;
  };

  const feeRows: LedgerRow[] = feeCollections.map((c) => ({
    key: `fee-${c.id}`,
    type: "fee",
    receiptNo: c.receiptNo,
    personName: `${c.student.name} ${c.student.surname}`,
    personSub: `Class ${c.student.class?.name || "—"}`,
    description: c.name,
    month: c.month,
    amount: c.amount,
    paidAt: c.paidAt,
    status: c.status === FeeStatus.PAID ? "PAID" : "UNPAID",
    actionHref: `/fees/collect?studentId=${c.student.id}`,
    receiptHref: c.status === FeeStatus.PAID && c.receiptNo ? `/fees/receipt/${c.receiptNo}` : null,
  }));

  const salaryRows: LedgerRow[] = salaryCollections.map((c) => ({
    key: `sal-${c.id}`,
    type: "salary",
    receiptNo: c.receiptNo,
    personName: `${c.teacher.name} ${c.teacher.surname}`,
    personSub: "Teacher",
    description: c.name,
    month: c.month,
    amount: c.amount,
    paidAt: c.paidAt,
    status: c.status === SalaryStatus.PAID ? "PAID" : "UNPAID",
    actionHref: `/salaries/payroll?teacherId=${c.teacher.id}`,
    receiptHref: null,
  }));

  // Apply type filter and sort newest first
  let allRows = [...feeRows, ...salaryRows];
  if (typeFilter === "fee") allRows = feeRows;
  else if (typeFilter === "salary") allRows = salaryRows;

  allRows.sort((a, b) => {
    if (a.paidAt && b.paidAt) return b.paidAt.getTime() - a.paidAt.getTime();
    if (a.paidAt) return -1;
    if (b.paidAt) return 1;
    return b.key.localeCompare(a.key);
  });

  // ── Metrics ───────────────────────────────────────────────────────────────
  const paidRows = allRows.filter((r) => r.status === "PAID");
  const unpaidRows = allRows.filter((r) => r.status === "UNPAID");
  const totalPaidSum = paidRows.reduce((s, r) => s + r.amount, 0);
  const totalUnpaidSum = unpaidRows.reduce((s, r) => s + r.amount, 0);

  // ── Helpers for building filter links ─────────────────────────────────────
  const filterHref = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { status: statusFilter, type: typeFilter, search: searchQuery || undefined, ...overrides };
    Object.entries(merged).forEach(([k, v]) => { if (v) params.set(k, v); });
    const qs = params.toString();
    return `/fees/ledger${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="p-6 bg-[#f8fafe] flex-1 flex flex-col gap-6">
      {/* HEADER */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Ledger</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {role === "admin"
            ? "Consolidated audit log of all student fee payments and teacher salary disbursements."
            : role === "teacher"
            ? "Your salary records and payment history."
            : "Your fee invoices, payment history, and receipts."}
        </p>
      </div>

      {/* METRICS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-green-500" />
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-500 text-lg">৳</div>
          <div>
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Settled</span>
            <h3 className="text-xl font-black text-gray-800 mt-0.5">৳{totalPaidSum.toLocaleString()}</h3>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">{paidRows.length} cleared records</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-amber-500" />
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 text-lg">৳</div>
          <div>
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Outstanding</span>
            <h3 className="text-xl font-black text-gray-800 mt-0.5">৳{totalUnpaidSum.toLocaleString()}</h3>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">{unpaidRows.length} pending</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 relative overflow-hidden sm:col-span-2 lg:col-span-1">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-lamaSky" />
          <div className="w-10 h-10 rounded-full bg-lamaSkyLight flex items-center justify-center text-lamaSky text-lg">🧾</div>
          <div>
            <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Records</span>
            <h3 className="text-xl font-black text-gray-800 mt-0.5">{allRows.length}</h3>
            <p className="text-[10px] text-gray-400 font-medium mt-0.5">
              {feeRows.length} fee{feeRows.length !== 1 ? "s" : ""} · {salaryRows.length} salary record{salaryRows.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {/* Status filters */}
          <Link href={filterHref({ status: undefined })}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${!statusFilter ? "bg-gray-800 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
            All
          </Link>
          <Link href={filterHref({ status: "PAID" })}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${statusFilter === "PAID" ? "bg-green-600 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
            Paid
          </Link>
          <Link href={filterHref({ status: "UNPAID" })}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${statusFilter === "UNPAID" ? "bg-amber-600 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
            Unpaid
          </Link>

          {/* Type filters — only admins see both types */}
          {role === "admin" && (
            <>
              <span className="text-gray-200 self-center">|</span>
              <Link href={filterHref({ type: undefined })}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${!typeFilter ? "bg-gray-800 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
                All Types
              </Link>
              <Link href={filterHref({ type: "fee" })}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${typeFilter === "fee" ? "bg-lamaSky text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
                Fees
              </Link>
              <Link href={filterHref({ type: "salary" })}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${typeFilter === "salary" ? "bg-lamaSky text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
                Salaries
              </Link>
            </>
          )}
        </div>

        <form className="flex gap-2 max-w-sm w-full">
          <input
            type="text"
            name="search"
            placeholder="Search by name, description or receipt..."
            defaultValue={searchQuery}
            className="ring-1 ring-gray-200 p-2 rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-lamaSky transition-all placeholder:text-gray-300"
          />
          {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
          {typeFilter && <input type="hidden" name="type" value={typeFilter} />}
          <button type="submit"
            className="bg-lamaSky hover:bg-[#1e40af] text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors shadow-sm">
            Search
          </button>
        </form>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        {allRows.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <span className="text-2xl">📋</span>
            <p className="text-gray-500 font-bold text-sm">No records found</p>
            <p className="text-xs text-gray-400">No entries match your current filter settings.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 font-bold uppercase text-[9px] tracking-wider">
                  <th className="p-4">Type</th>
                  <th className="p-4">Receipt / Ref</th>
                  <th className="p-4">Name</th>
                  <th className="p-4">Description</th>
                  <th className="p-4">Month</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Payment Date</th>
                  <th className="p-4">Status</th>
                  {role === "admin" && <th className="p-4 text-right">Action</th>}
                </tr>
              </thead>
              <tbody>
                {allRows.map((row) => (
                  <ClickableRow
                    key={row.key}
                    href={row.receiptHref || row.actionHref}
                    className="border-b border-gray-50 text-gray-700 hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="p-4">
                      <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-full ${
                        row.type === "fee"
                          ? "bg-lamaSkyLight text-lamaSky"
                          : "bg-lamaPurpleLight text-lamaPurple"
                      }`}>
                        {row.type === "fee" ? "Fee" : "Salary"}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-semibold text-gray-500">
                      {row.receiptNo || "N/A"}
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-gray-800">{row.personName}</p>
                      <p className="text-[10px] text-gray-400">{row.personSub}</p>
                    </td>
                    <td className="p-4 font-bold text-gray-800">{row.description}</td>
                    <td className="p-4 font-semibold text-gray-400">{row.month || "One-time"}</td>
                    <td className="p-4 font-extrabold text-gray-900">৳{row.amount.toLocaleString()}</td>
                    <td className="p-4 font-medium text-gray-400">
                      {row.paidAt
                        ? new Date(row.paidAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                        : "Outstanding"}
                    </td>
                    <td className="p-4">
                      <span className={`text-[9px] uppercase font-black px-2 py-0.5 rounded-full ${
                        row.status === "PAID" ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    {role === "admin" && (
                      <td className="p-4 text-right">
                        {row.receiptHref ? (
                          <Link href={row.receiptHref}
                            className="bg-lamaSkyLight hover:bg-lamaSky/20 text-lamaSky text-[10px] font-bold py-1.5 px-3 rounded-full transition-colors">
                            View Receipt ⎙
                          </Link>
                        ) : row.status === "UNPAID" ? (
                          <Link href={row.actionHref}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-600 text-[10px] font-bold py-1.5 px-3 rounded-full transition-colors">
                            Pay Now
                          </Link>
                        ) : null}
                      </td>
                    )}
                  </ClickableRow>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
