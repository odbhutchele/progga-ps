import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import ExpenseForm from "../reports/ExpenseForm";
import DeleteExpenseBtn from "../reports/DeleteExpenseBtn";
import {
  getSchoolYear,
  getSchoolMonthIndex,
  getSchoolYearStartUtc,
} from "@/lib/schoolDate";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams?: { category?: string; search?: string };
}) {
  const { role } = await auth();

  // Only Admin can view and manage school expenses
  if (role !== "admin") {
    redirect("/");
  }

  const currentYear = getSchoolYear();
  const startOfYear = getSchoolYearStartUtc(currentYear);
  const startOfNextYear = getSchoolYearStartUtc(currentYear + 1);
  const currentMonthIdx = getSchoolMonthIndex(new Date());

  const categoryFilter = searchParams?.category;
  const searchQuery = searchParams?.search?.trim();

  // Fetch all expenses for this year
  const expenses = await prisma.expense.findMany({
    where: {
      date: {
        gte: startOfYear,
        lt: startOfNextYear,
      },
      ...(categoryFilter ? { category: categoryFilter } : {}),
      ...(searchQuery
        ? {
            title: {
              contains: searchQuery,
              mode: "insensitive",
            },
          }
        : {}),
    },
    orderBy: {
      date: "desc",
    },
  });

  // KPI Calculations
  const allYearExpenses = await prisma.expense.findMany({
    where: {
      date: {
        gte: startOfYear,
        lt: startOfNextYear,
      },
    },
    select: {
      amount: true,
      date: true,
      category: true,
    },
  });

  const totalYearExpense = allYearExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalMonthExpense = allYearExpenses
    .filter((e) => getSchoolMonthIndex(e.date) === currentMonthIdx)
    .reduce((sum, e) => sum + e.amount, 0);

  const categories = [
    "Utility",
    "Maintenance",
    "Supplies",
    "Salary",
    "Events",
    "Other",
  ];

  return (
    <div className="p-6 bg-[#f8fafe] min-h-screen flex flex-col gap-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/fees/reports"
              className="text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors"
            >
              ← Back to Finance Reports
            </Link>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
            Operational Expenses
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Log and manage campus utilities, facility maintenance, supplies, and general payouts.
          </p>
        </div>

        <Link
          href="/fees/reports"
          className="inline-flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors w-fit"
        >
          📊 View Cashflow Reports
        </Link>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-purple-500" />
          <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 text-lg font-bold">
            ৳
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Total Expenses ({currentYear})
            </span>
            <h3 className="text-xl font-black text-slate-800 mt-0.5">
              ৳{totalYearExpense.toLocaleString()}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">All logged operational costs</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-blue-500" />
          <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-lg font-bold">
            ৳
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              This Month&apos;s Expenses
            </span>
            <h3 className="text-xl font-black text-slate-800 mt-0.5">
              ৳{totalMonthExpense.toLocaleString()}
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">Month to date expenditures</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-emerald-500" />
          <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 text-lg font-bold">
            #
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              Total Entries Logged
            </span>
            <h3 className="text-xl font-black text-slate-800 mt-0.5">
              {allYearExpenses.length} entries
            </h3>
            <p className="text-[10px] text-slate-400 font-medium">For academic year {currentYear}</p>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT: LOG FORM + EXPENSE LEDGER */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* LEFT COLUMN: LOG EXPENSE FORM */}
        <div className="lg:col-span-1">
          <ExpenseForm />
        </div>

        {/* RIGHT COLUMN: EXPENSE HISTORY LEDGER */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-800">Expense History</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Showing {expenses.length} record{expenses.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Quick Category Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
              <Link
                href="/fees/expenses"
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  !categoryFilter
                    ? "bg-blue-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat}
                  href={`/fees/expenses?category=${cat}`}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    categoryFilter === cat
                      ? "bg-blue-700 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {cat}
                </Link>
              ))}
            </div>
          </div>

          {expenses.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-sm">No expenses found for the selected filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="p-3">Date</th>
                    <th className="p-3">Title / Description</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {expenses.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 font-medium text-slate-500 whitespace-nowrap">
                        {new Date(exp.date).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="p-3 font-bold text-slate-800">{exp.title}</td>
                      <td className="p-3">
                        <span className="bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 rounded-full text-[9px] uppercase font-bold">
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-3 font-extrabold text-slate-900 whitespace-nowrap">
                        ৳{exp.amount.toLocaleString()}
                      </td>
                      <td className="p-3 text-right">
                        <DeleteExpenseBtn id={exp.id} title={exp.title} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
