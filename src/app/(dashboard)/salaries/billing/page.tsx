import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import SalaryBillingCalendar from "./SalaryBillingCalendar";
import BonusPackageForm from "./BonusPackageForm";
import BonusPackageCard from "./BonusPackageCard";

export default async function SalaryBillingPage() {
  const { role } = await auth();
  if (role !== "admin") redirect("/");

  const currentYear = new Date().getFullYear();

  const [totalTeachers, billedRecords, bonusPackages] = await Promise.all([
    prisma.teacher.count({ where: { monthlySalary: { not: null } } }),
    prisma.salaryCollection.findMany({
      where: { month: { startsWith: String(currentYear) }, type: "SALARY" },
      select: { month: true, teacherId: true },
      distinct: ["month", "teacherId"],
    }),
    prisma.bonusPackage.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        collections: {
          where: { month: { startsWith: String(currentYear) } },
          select: { month: true, teacherId: true },
          distinct: ["month", "teacherId"],
        },
      },
    }),
  ]);

  const billedCountByMonth: Record<string, number> = {};
  for (const rec of billedRecords) {
    billedCountByMonth[rec.month] = (billedCountByMonth[rec.month] ?? 0) + 1;
  }
  const billedMonths = Object.keys(billedCountByMonth);

  // For each bonus package, compute which months it was applied to (at least one teacher received it)
  const bonusAppliedMonthsMap: Record<number, string[]> = {};
  for (const pkg of bonusPackages) {
    const months = new Set<string>();
    for (const c of pkg.collections) months.add(c.month);
    bonusAppliedMonthsMap[pkg.id] = Array.from(months);
  }

  return (
    <div className="p-6 bg-[#f8fafe] flex-1 flex flex-col gap-8">
      {/* ── MONTHLY SALARY BILLING ── */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Monthly Salary Billing</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Generate salary records for all teachers in one click. Only teachers with a monthly salary set will be billed.
          </p>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-700">{currentYear} Billing</h2>
            <span className="text-xs text-gray-400">
              {totalTeachers} teacher{totalTeachers !== 1 ? "s" : ""} with salary set
            </span>
          </div>

          <SalaryBillingCalendar
            currentYear={currentYear}
            billedMonths={billedMonths}
            totalTeachers={totalTeachers}
            billedCountByMonth={billedCountByMonth}
          />
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
          <h2 className="text-xs font-bold text-gray-600 mb-2">How it works</h2>
          <ul className="text-xs text-gray-500 flex flex-col gap-1.5 list-disc list-inside">
            <li>Click a month to select, then confirm — one UNPAID record is created per teacher.</li>
            <li>Teachers without a monthly salary set are skipped automatically.</li>
            <li>Partially-billed months (amber) can be re-run to fill in missing teachers.</li>
            <li>Head to <strong>Payroll Portal</strong> to add bonuses/deductions and mark salaries as paid.</li>
          </ul>
        </div>
      </div>

      {/* ── BONUS PACKAGES ── */}
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-gray-800 tracking-tight">One-Time Bonus Packages</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Create named bonus packages and apply them to all teachers for a specific month.
            </p>
          </div>

          {bonusPackages.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-dashed border-gray-200 text-center flex flex-col items-center gap-2">
              <p className="text-sm font-semibold text-gray-400">No bonus packages yet</p>
              <p className="text-xs text-gray-400">Create one using the form on the right.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {bonusPackages.map((pkg) => (
                <BonusPackageCard
                  key={pkg.id}
                  id={pkg.id}
                  name={pkg.name}
                  amount={pkg.amount}
                  description={pkg.description}
                  currentYear={currentYear}
                  appliedMonths={bonusAppliedMonthsMap[pkg.id] ?? []}
                />
              ))}
            </div>
          )}
        </div>

        <div className="w-full lg:w-72 flex-shrink-0">
          <BonusPackageForm />
        </div>
      </div>
    </div>
  );
}
