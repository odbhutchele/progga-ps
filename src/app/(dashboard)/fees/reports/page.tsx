import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import FinanceChart from "@/components/FinanceChart";
import DeleteExpenseBtn from "./DeleteExpenseBtn";
import PrintButton from "@/components/PrintButton";
import {
  getSchoolYear,
  getSchoolMonthIndex,
  getSchoolYearStartUtc,
} from "@/lib/schoolDate";

export default async function FinanceReportsPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | undefined };
}) {
  const { role } = await auth();

  // Route protection - only Admin can view financial aggregates and expense forms
  if (role !== "admin") {
    redirect("/");
  }

  // Use the school's Dhaka calendar year (or requested year if passed)
  const requestedYear = searchParams?.year ? parseInt(searchParams.year) : NaN;
  const currentYear = !isNaN(requestedYear) ? requestedYear : getSchoolYear();
  const startOfYear = getSchoolYearStartUtc(currentYear);
  const startOfNextYear = getSchoolYearStartUtc(currentYear + 1);

  // Check if a specific month is selected (1–12)
  const requestedMonth = searchParams?.month ? parseInt(searchParams.month) : NaN;
  const isMonthFiltered = !isNaN(requestedMonth) && requestedMonth >= 1 && requestedMonth <= 12;
  const selectedMonthIndex = isMonthFiltered ? requestedMonth - 1 : null;

  // Fetch all financial movements for the academic year in parallel
  const [
    paidCollections,
    inventorySales,
    expenses,
    paidSalaries,
    inventoryPurchases,
    unpaidCollections,
  ] = await Promise.all([
    // 1. Fee Inflows (PAID collections)
    prisma.feeCollection.findMany({
      where: {
        status: "PAID",
        paidAt: {
          gte: startOfYear,
          lt: startOfNextYear,
        },
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            surname: true,
            studentId: true,
            class: { select: { name: true } },
          },
        },
      },
      orderBy: { paidAt: "desc" },
    }),

    // 2. Inventory Sales Inflow
    prisma.inventoryMovement.findMany({
      where: {
        type: "SALE",
        createdAt: {
          gte: startOfYear,
          lt: startOfNextYear,
        },
      },
      include: {
        item: { select: { name: true, category: true } },
      },
      orderBy: { createdAt: "desc" },
    }),

    // 3. Operational Expenses Outflow
    prisma.expense.findMany({
      where: {
        date: {
          gte: startOfYear,
          lt: startOfNextYear,
        },
      },
      orderBy: { date: "desc" },
    }),

    // 4. Paid Salary Outflow
    prisma.salaryCollection.findMany({
      where: {
        status: "PAID",
        paidAt: {
          gte: startOfYear,
          lt: startOfNextYear,
        },
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            surname: true,
            teacherId: true,
          },
        },
      },
      orderBy: { paidAt: "desc" },
    }),

    // 5. Inventory Stock Purchases Outflow
    prisma.inventoryMovement.findMany({
      where: {
        type: "PURCHASE",
        createdAt: {
          gte: startOfYear,
          lt: startOfNextYear,
        },
      },
      include: {
        item: { select: { name: true, category: true } },
      },
      orderBy: { createdAt: "desc" },
    }),

    // 6. Outstanding unpaid fee collections (Receivables)
    prisma.feeCollection.findMany({
      where: { status: "UNPAID" },
      select: { amount: true },
    }),
  ]);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const monthShortNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];

  // 12-Month Aggregation Structure
  const monthlyData = monthNames.map((name, idx) => ({
    index: idx,
    monthNumber: idx + 1,
    name,
    shortName: monthShortNames[idx],
    feeIncome: 0,
    inventoryIncome: 0,
    totalInflow: 0,
    operationalExpense: 0,
    salaryExpense: 0,
    inventoryPurchase: 0,
    totalOutflow: 0,
    netCashflow: 0,
  }));

  paidCollections.forEach((c) => {
    if (c.paidAt) {
      const m = getSchoolMonthIndex(c.paidAt);
      if (m >= 0 && m < 12) {
        monthlyData[m].feeIncome += c.paidAmount;
      }
    }
  });

  inventorySales.forEach((s) => {
    const m = getSchoolMonthIndex(s.createdAt);
    if (m >= 0 && m < 12) {
      monthlyData[m].inventoryIncome += s.totalAmount;
    }
  });

  expenses.forEach((e) => {
    const m = getSchoolMonthIndex(e.date);
    if (m >= 0 && m < 12) {
      monthlyData[m].operationalExpense += e.amount;
    }
  });

  paidSalaries.forEach((s) => {
    if (s.paidAt) {
      const m = getSchoolMonthIndex(s.paidAt);
      if (m >= 0 && m < 12) {
        monthlyData[m].salaryExpense += s.paidAmount;
      }
    }
  });

  inventoryPurchases.forEach((p) => {
    const m = getSchoolMonthIndex(p.createdAt);
    if (m >= 0 && m < 12) {
      monthlyData[m].inventoryPurchase += p.totalAmount;
    }
  });

  // Calculate totals per month
  monthlyData.forEach((m) => {
    m.totalInflow = m.feeIncome + m.inventoryIncome;
    m.totalOutflow = m.operationalExpense + m.salaryExpense + m.inventoryPurchase;
    m.netCashflow = m.totalInflow - m.totalOutflow;
  });

  const chartData = monthlyData.map((m) => ({
    name: m.shortName,
    income: m.totalInflow,
    expense: m.totalOutflow,
  }));

  // Full-year aggregates
  const totalInflow = monthlyData.reduce((sum, m) => sum + m.totalInflow, 0);
  const totalOutflow = monthlyData.reduce((sum, m) => sum + m.totalOutflow, 0);
  const currentBalance = totalInflow - totalOutflow;
  const totalDues = unpaidCollections.reduce((sum, item) => sum + item.amount, 0);

  // Selected Month details (for Drill-Down statement)
  const selectedMonthData = selectedMonthIndex !== null ? monthlyData[selectedMonthIndex] : null;

  const monthItemInflows = selectedMonthIndex !== null
    ? [
        ...paidCollections
          .filter((c) => c.paidAt && getSchoolMonthIndex(c.paidAt) === selectedMonthIndex)
          .map((c) => ({
            id: `fee-${c.id}`,
            date: c.paidAt!,
            ref: c.receiptNo || `#${c.id}`,
            source: c.student ? `${c.student.name} ${c.student.surname}` : "Student",
            sourceMeta: c.student ? `Class ${c.student.class.name} · ID ${c.student.studentId}` : "",
            description: c.name,
            category: "Student Fee",
            amount: c.paidAmount,
          })),
        ...inventorySales
          .filter((s) => getSchoolMonthIndex(s.createdAt) === selectedMonthIndex)
          .map((s) => ({
            id: `sale-${s.id}`,
            date: s.createdAt,
            ref: `SALE-${s.id}`,
            source: s.item?.name || "Inventory Item",
            sourceMeta: s.item?.category ? `Category: ${s.item.category}` : "Stock Sale",
            description: `Sold ${s.quantity} pcs`,
            category: "Inventory Sale",
            amount: s.totalAmount,
          })),
      ].sort((a, b) => b.date.getTime() - a.date.getTime())
    : [];

  const monthItemOutflows = selectedMonthIndex !== null
    ? [
        ...expenses
          .filter((e) => getSchoolMonthIndex(e.date) === selectedMonthIndex)
          .map((e) => ({
            id: `exp-${e.id}`,
            date: e.date,
            ref: `EXP-${e.id}`,
            payee: e.title,
            payeeMeta: "Operational Expense",
            description: e.category,
            category: "Expense",
            amount: e.amount,
            deleteId: e.id,
            title: e.title,
          })),
        ...paidSalaries
          .filter((s) => s.paidAt && getSchoolMonthIndex(s.paidAt) === selectedMonthIndex)
          .map((s) => ({
            id: `sal-${s.id}`,
            date: s.paidAt!,
            ref: s.receiptNo || `SAL-${s.id}`,
            payee: s.teacher ? `${s.teacher.name} ${s.teacher.surname}` : "Teacher",
            payeeMeta: s.teacher ? `Teacher ID: ${s.teacher.teacherId}` : "Faculty Payroll",
            description: `${s.name} (${s.month})`,
            category: "Salary",
            amount: s.paidAmount,
            deleteId: null,
            title: s.name,
          })),
        ...inventoryPurchases
          .filter((p) => getSchoolMonthIndex(p.createdAt) === selectedMonthIndex)
          .map((p) => ({
            id: `pur-${p.id}`,
            date: p.createdAt,
            ref: `PUR-${p.id}`,
            payee: p.item?.name || "Inventory Item",
            payeeMeta: p.item?.category ? `Category: ${p.item.category}` : "Stock Purchase",
            description: `Purchased ${p.quantity} pcs`,
            category: "Stock Buy",
            amount: p.totalAmount,
            deleteId: null,
            title: p.item?.name || "Item",
          })),
      ].sort((a, b) => b.date.getTime() - a.date.getTime())
    : [];

  return (
    <div className="p-6 bg-[#f8fafe] min-h-screen flex flex-col gap-6">
      {/* PRINT-ONLY OFFICIAL HEADER */}
      {selectedMonthData && (
        <div className="hidden print:block text-center border-b-2 border-slate-900 pb-4 mb-4">
          <h1 className="text-2xl font-black text-slate-900 uppercase tracking-wide">Progga Pathshala</h1>
          <p className="text-xs text-slate-600 mt-0.5">Comprehensive Monthly Cashflow Statement</p>
          <div className="flex justify-between items-center text-xs text-slate-600 mt-4 pt-2 border-t border-slate-300">
            <span><strong>Statement Month:</strong> {selectedMonthData.name} {currentYear}</span>
            <span><strong>Academic Year:</strong> {currentYear}</span>
            <span><strong>Date Generated:</strong> {new Date().toLocaleDateString("en-GB")}</span>
          </div>
        </div>
      )}

      {/* HEADER SECTION (SCREEN ONLY) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Finance & Cashflow Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Live monitoring of fee collections, inventory, expenditures, and payroll for {currentYear}.
          </p>
        </div>

        {/* Quick Month Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <Link
            href={`/fees/reports?year=${currentYear}`}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedMonthIndex === null
                ? "bg-blue-700 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            All Months
          </Link>
          {monthlyData.map((m) => (
            <Link
              key={m.monthNumber}
              href={`/fees/reports?year=${currentYear}&month=${m.monthNumber}`}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedMonthIndex === m.index
                  ? "bg-blue-700 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              {m.shortName}
            </Link>
          ))}
        </div>
      </div>

      {/* ANNUAL KPI METRICS ROW (SCREEN ONLY) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:hidden">
        {/* Total Inflow */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-green-500" />
          <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-500 text-lg font-bold">৳</div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Cash Inflow</span>
            <h3 className="text-lg font-black text-gray-800 mt-0.5">৳{totalInflow.toLocaleString()}</h3>
            <p className="text-[9px] text-gray-400 font-medium">Fees + inventory sales ({currentYear})</p>
          </div>
        </div>

        {/* Total Outflow */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-purple-500" />
          <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-500 text-lg font-bold">৳</div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Total Cash Outflow</span>
            <h3 className="text-lg font-black text-gray-800 mt-0.5">৳{totalOutflow.toLocaleString()}</h3>
            <p className="text-[9px] text-gray-400 font-medium">Expenses + salaries + stock purchases</p>
          </div>
        </div>

        {/* Net Balance */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className={`absolute top-0 left-0 bottom-0 w-1 ${currentBalance >= 0 ? "bg-blue-600" : "bg-red-500"}`} />
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
            currentBalance >= 0 ? "bg-blue-50 text-blue-600" : "bg-red-50 text-red-500"
          }`}>
            ৳
          </div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Net Cash Position</span>
            <h3 className={`text-lg font-black mt-0.5 ${currentBalance >= 0 ? "text-gray-800" : "text-red-600"}`}>
              ৳{currentBalance.toLocaleString()}
            </h3>
            <p className="text-[9px] text-gray-400 font-medium">
              {currentBalance >= 0 ? "Operating Surplus" : "Operating Deficit"}
            </p>
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-amber-500" />
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 text-lg font-bold">৳</div>
          <div>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Pending Dues</span>
            <h3 className="text-lg font-black text-gray-800 mt-0.5">৳{totalDues.toLocaleString()}</h3>
            <p className="text-[9px] text-gray-400 font-medium">Uncollected student fees</p>
          </div>
        </div>
      </div>

      {/* MONTHLY DRILL-DOWN STATEMENT SECTION (SHOWN WHEN A MONTH IS SELECTED) */}
      {selectedMonthData && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-6 print:p-0 print:border-none print:shadow-none">
          {/* Statement Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 print:hidden">
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/fees/reports?year=${currentYear}`}
                  className="text-xs font-semibold text-blue-700 hover:text-blue-900 transition-colors"
                >
                  ← Back to 12-Month Summary
                </Link>
                <span className="text-slate-300">|</span>
                <span className="text-xs text-slate-500 font-medium">
                  Viewing Month {selectedMonthData.monthNumber} of 12
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-slate-800 mt-1">
                {selectedMonthData.name} {currentYear} Cashflow Statement
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <PrintButton
                label="Print Statement"
                className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm transition-colors"
              />
            </div>
          </div>

          {/* Monthly KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:border-b print:border-slate-300 print:pb-4">
            <div className="p-4 rounded-xl bg-green-50/70 border border-green-100">
              <span className="text-xs font-bold text-green-700 uppercase tracking-wider">Total Cash Inflow</span>
              <p className="text-2xl font-black text-green-900 mt-1">
                +৳{selectedMonthData.totalInflow.toLocaleString()}
              </p>
              <p className="text-[11px] text-green-700/80 mt-1">
                Fees: ৳{selectedMonthData.feeIncome.toLocaleString()} · Sales: ৳{selectedMonthData.inventoryIncome.toLocaleString()}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-purple-50/70 border border-purple-100">
              <span className="text-xs font-bold text-purple-700 uppercase tracking-wider">Total Cash Outflow</span>
              <p className="text-2xl font-black text-purple-900 mt-1">
                -৳{selectedMonthData.totalOutflow.toLocaleString()}
              </p>
              <p className="text-[11px] text-purple-700/80 mt-1">
                Expenses: ৳{selectedMonthData.operationalExpense.toLocaleString()} · Salaries: ৳{selectedMonthData.salaryExpense.toLocaleString()} · Stock: ৳{selectedMonthData.inventoryPurchase.toLocaleString()}
              </p>
            </div>
            <div className={`p-4 rounded-xl border ${
              selectedMonthData.netCashflow >= 0
                ? "bg-blue-50/70 border-blue-100 text-blue-900"
                : "bg-red-50/70 border-red-100 text-red-900"
            }`}>
              <span className={`text-xs font-bold uppercase tracking-wider ${
                selectedMonthData.netCashflow >= 0 ? "text-blue-700" : "text-red-700"
              }`}>
                Net Monthly Cashflow
              </span>
              <p className="text-2xl font-black mt-1">
                {selectedMonthData.netCashflow >= 0 ? "+" : ""}৳{selectedMonthData.netCashflow.toLocaleString()}
              </p>
              <p className={`text-[11px] mt-1 ${selectedMonthData.netCashflow >= 0 ? "text-blue-700/80" : "text-red-700/80"}`}>
                {selectedMonthData.netCashflow >= 0 ? "Surplus Cash Flow" : "Cash Deficit for Month"}
              </p>
            </div>
          </div>

          {/* Side-by-Side Itemized Inflow & Outflow Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1">
            {/* CASH INFLOWS */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
                  Cash Inflows (Collections & Sales)
                </h3>
                <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  {monthItemInflows.length} item{monthItemInflows.length !== 1 ? "s" : ""}
                </span>
              </div>

              {monthItemInflows.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-8 text-center bg-slate-50 rounded-xl">
                  No cash receipts recorded in {selectedMonthData.name} {currentYear}.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Ref / Rec.</th>
                        <th className="p-2.5">Source</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {monthItemInflows.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5 font-medium text-slate-500 whitespace-nowrap">
                            {new Date(item.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-600">
                            {item.ref}
                          </td>
                          <td className="p-2.5">
                            <span className="font-semibold text-slate-800 block">{item.source}</span>
                            {item.sourceMeta && (
                              <span className="text-[10px] text-slate-400 block">{item.sourceMeta}</span>
                            )}
                          </td>
                          <td className="p-2.5">
                            <span className="bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full text-[9px] font-bold">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-bold text-green-700 whitespace-nowrap">
                            +৳{item.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
                      <tr>
                        <td colSpan={4} className="p-2.5 text-right">Total Inflow:</td>
                        <td className="p-2.5 text-right text-green-700 text-sm font-black whitespace-nowrap">
                          +৳{selectedMonthData.totalInflow.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* CASH OUTFLOWS */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block" />
                  Cash Outflows (Expenses, Payroll & Stock)
                </h3>
                <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
                  {monthItemOutflows.length} item{monthItemOutflows.length !== 1 ? "s" : ""}
                </span>
              </div>

              {monthItemOutflows.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-8 text-center bg-slate-50 rounded-xl">
                  No cash payouts recorded in {selectedMonthData.name} {currentYear}.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                        <th className="p-2.5">Date</th>
                        <th className="p-2.5">Ref</th>
                        <th className="p-2.5">Payee / Purpose</th>
                        <th className="p-2.5">Type</th>
                        <th className="p-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {monthItemOutflows.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-2.5 font-medium text-slate-500 whitespace-nowrap">
                            {new Date(item.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                          </td>
                          <td className="p-2.5 font-mono text-[11px] text-slate-600">
                            {item.ref}
                          </td>
                          <td className="p-2.5">
                            <span className="font-semibold text-slate-800 block">{item.payee}</span>
                            <span className="text-[10px] text-slate-400 block">{item.description}</span>
                          </td>
                          <td className="p-2.5">
                            <span className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full text-[9px] font-bold">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-bold text-purple-800 whitespace-nowrap">
                            -৳{item.amount.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
                      <tr>
                        <td colSpan={4} className="p-2.5 text-right">Total Outflow:</td>
                        <td className="p-2.5 text-right text-purple-800 text-sm font-black whitespace-nowrap">
                          -৳{selectedMonthData.totalOutflow.toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 12-MONTH CASHFLOW SUMMARY TABLE SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-extrabold text-slate-800">12-Month Cashflow Summary ({currentYear})</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Month-by-month comparative analysis of school cash inflows, outflows, and net surplus.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider border-b border-slate-200">
                <th className="p-3.5">Month</th>
                <th className="p-3.5">Cash Inflow (৳)</th>
                <th className="p-3.5">Cash Outflow (৳)</th>
                <th className="p-3.5">Net Cashflow (৳)</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-right">Statement Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {monthlyData.map((m) => {
                const isSelected = selectedMonthIndex === m.index;
                return (
                  <tr
                    key={m.monthNumber}
                    className={`transition-colors ${
                      isSelected ? "bg-blue-50/60 font-semibold" : "hover:bg-slate-50/70"
                    }`}
                  >
                    <td className="p-3.5 font-bold text-slate-800">
                      <div className="flex items-center gap-2">
                        <span>{m.name}</span>
                        {isSelected && (
                          <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-md uppercase font-bold">
                            Active
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-green-700">৳{m.totalInflow.toLocaleString()}</span>
                      <p className="text-[10px] text-slate-400">
                        Fees: ৳{m.feeIncome.toLocaleString()} · Sales: ৳{m.inventoryIncome.toLocaleString()}
                      </p>
                    </td>
                    <td className="p-3.5">
                      <span className="font-bold text-purple-700">৳{m.totalOutflow.toLocaleString()}</span>
                      <p className="text-[10px] text-slate-400">
                        Exp: ৳{m.operationalExpense.toLocaleString()} · Sal: ৳{m.salaryExpense.toLocaleString()} · Buy: ৳{m.inventoryPurchase.toLocaleString()}
                      </p>
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`font-black ${
                          m.netCashflow > 0
                            ? "text-green-700"
                            : m.netCashflow < 0
                            ? "text-red-600"
                            : "text-slate-400"
                        }`}
                      >
                        {m.netCashflow > 0 ? "+" : ""}৳{m.netCashflow.toLocaleString()}
                      </span>
                    </td>
                    <td className="p-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          m.netCashflow > 0
                            ? "bg-green-50 text-green-700 border border-green-200"
                            : m.netCashflow < 0
                            ? "bg-red-50 text-red-600 border border-red-200"
                            : "bg-slate-100 text-slate-500 border border-slate-200"
                        }`}
                      >
                        {m.netCashflow > 0 ? "Surplus" : m.netCashflow < 0 ? "Deficit" : "Neutral"}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      <Link
                        href={`/fees/reports?year=${currentYear}&month=${m.monthNumber}`}
                        className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${
                          isSelected
                            ? "bg-blue-700 text-white"
                            : "bg-slate-100 hover:bg-blue-50 text-blue-700"
                        }`}
                      >
                        {isSelected ? "Viewing Statement" : "View Statement →"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-extrabold text-slate-800">
              <tr>
                <td className="p-3.5">Yearly Total ({currentYear})</td>
                <td className="p-3.5 text-green-700 text-sm font-black">
                  ৳{totalInflow.toLocaleString()}
                </td>
                <td className="p-3.5 text-purple-700 text-sm font-black">
                  ৳{totalOutflow.toLocaleString()}
                </td>
                <td
                  className={`p-3.5 text-sm font-black ${
                    currentBalance >= 0 ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {currentBalance >= 0 ? "+" : ""}৳{currentBalance.toLocaleString()}
                </td>
                <td className="p-3.5 text-center">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      currentBalance >= 0
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {currentBalance >= 0 ? "Annual Surplus" : "Annual Deficit"}
                  </span>
                </td>
                <td className="p-3.5 text-right text-slate-400 font-normal">
                  12 Months
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* FULL WIDTH FINANCE CHART (SCREEN ONLY) */}
      <div className="w-full bg-white p-6 rounded-2xl border border-slate-200 shadow-sm min-h-[380px] print:hidden">
        <FinanceChart data={chartData} />
      </div>

      {/* FULL WIDTH OPERATIONAL EXPENDITURE LOGS (SCREEN ONLY) */}
      <div className="w-full bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-extrabold text-slate-800">Operational Expenditure Logs</h2>
            <p className="text-xs text-slate-500 mt-0.5">Direct school expenditures logged during {currentYear}.</p>
          </div>
          <Link
            href="/fees/expenses"
            className="inline-flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm w-fit"
          >
            + Log / Manage Expenses
          </Link>
        </div>

        {expenses.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-8 text-center bg-slate-50 rounded-xl">
            No school expenditures logged yet for {currentYear}.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
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
                    <td className="p-3 font-extrabold text-slate-900">৳{exp.amount.toLocaleString()}</td>
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
  );
}
