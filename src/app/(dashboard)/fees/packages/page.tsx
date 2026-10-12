import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import PackageForm from "./PackageForm";
import DeletePackageBtn from "./DeletePackageBtn";
import BillPackageBtn from "./BillPackageBtn";
import EditPackageBtn from "./EditPackageBtn";

export default async function FeePackagesPage() {
  const { role } = await auth();
  if (role !== "admin") redirect("/");

  const currentYear = new Date().getFullYear();

  const packages = await prisma.feePackage.findMany({
    include: { class: { select: { name: true } } },
    orderBy: { id: "desc" },
  });

  const classes = await prisma.class.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const tuitionPackages = packages.filter((p) => p.type === "TUITION");
  const otherPackages = packages.filter((p) => p.type === "OTHER_FEE");

  // Fetch billed months for all tuition packages in one query
  const billedRecords = await prisma.feeCollection.findMany({
    where: {
      feePackageId: { in: tuitionPackages.map((p) => p.id) },
      month: { not: null },
    },
    select: { feePackageId: true, month: true },
    distinct: ["feePackageId", "month"],
  });

  // Map: packageId -> Set of billed months
  const billedMonthsMap: Record<number, Set<string>> = {};
  for (const rec of billedRecords) {
    if (!billedMonthsMap[rec.feePackageId!]) billedMonthsMap[rec.feePackageId!] = new Set();
    if (rec.month) billedMonthsMap[rec.feePackageId!].add(rec.month);
  }

  return (
    <div className="p-6 flex flex-col lg:flex-row gap-6 flex-1 bg-[#f8fafe]">
      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col gap-8">

        {/* ── SECTION 1: MONTHLY TUITION ── */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-gray-800 tracking-tight">Monthly Tuition</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Base tuition rates per class. Bill each month individually — custom student rates are applied automatically.
            </p>
          </div>

          {tuitionPackages.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-dashed border-gray-200 text-center flex flex-col items-center gap-2">
              <p className="text-sm font-semibold text-gray-400">No tuition packages yet</p>
              <p className="text-xs text-gray-400">Use the form on the right to create one per class.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {tuitionPackages.map((pkg) => {
                const billedMonths = billedMonthsMap[pkg.id] || new Set<string>();
                return (
                  <div key={pkg.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-4 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-lamaSky" />

                    {/* Card header */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold bg-lamaSkyLight text-lamaSky px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {pkg.class ? `Class ${pkg.class.name}` : "School-Wide"}
                        </span>
                        <h3 className="text-sm font-bold text-gray-800 mt-2">{pkg.name}</h3>
                        {pkg.description && (
                          <p className="text-[11px] text-gray-400 mt-0.5">{pkg.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <EditPackageBtn
                          id={pkg.id}
                          currentName={pkg.name}
                          currentAmount={pkg.amount}
                          currentDescription={pkg.description}
                        />
                        <DeletePackageBtn id={pkg.id} name={pkg.name} />
                      </div>
                    </div>

                    {/* Base rate */}
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                      <span className="text-xs text-gray-500">Base monthly rate</span>
                      <span className="text-base font-extrabold text-gray-900">
                        <span className="text-sm text-lamaSky font-bold">৳</span>
                        {pkg.amount.toLocaleString()}
                      </span>
                    </div>

                    {/* Calendar + billing (integrated) */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{currentYear} Billing</span>
                      <BillPackageBtn
                        id={pkg.id}
                        name={pkg.name}
                        amount={pkg.amount}
                        classId={pkg.classId}
                        className={pkg.class?.name || null}
                        isTuition={true}
                        billedMonths={Array.from(billedMonths)}
                        currentYear={currentYear}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SECTION 2: OTHER FEE TEMPLATES ── */}
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-gray-800 tracking-tight">Other Fee Templates</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Reusable templates for one-time charges like sports, picnic, or exam fees.
            </p>
          </div>

          {otherPackages.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-dashed border-gray-200 text-center flex flex-col items-center gap-2">
              <p className="text-sm font-semibold text-gray-400">No fee templates yet</p>
              <p className="text-xs text-gray-400">Create one using the form on the right.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {otherPackages.map((pkg) => (
                <div key={pkg.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col gap-3 relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-1 bg-lamaPurple" />

                  {/* Card header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold bg-lamaPurpleLight text-lamaPurple px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {pkg.class ? `Class ${pkg.class.name}` : "School-Wide"}
                      </span>
                      <h3 className="text-sm font-bold text-gray-800 mt-2">{pkg.name}</h3>
                      {pkg.description && (
                        <p className="text-[11px] text-gray-400 mt-0.5">{pkg.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <EditPackageBtn
                        id={pkg.id}
                        currentName={pkg.name}
                        currentAmount={pkg.amount}
                        currentDescription={pkg.description}
                      />
                      <DeletePackageBtn id={pkg.id} name={pkg.name} />
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2">
                    <span className="text-xs text-gray-500">Charge per student</span>
                    <span className="text-base font-extrabold text-gray-900">
                      <span className="text-sm text-lamaPurple font-bold">৳</span>
                      {pkg.amount.toLocaleString()}
                    </span>
                  </div>

                  {/* Bill button */}
                  <BillPackageBtn
                    id={pkg.id}
                    name={pkg.name}
                    amount={pkg.amount}
                    classId={pkg.classId}
                    className={pkg.class?.name || null}
                    isTuition={false}
                    billedMonths={[]}
                    currentYear={currentYear}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── SIDEBAR: Create Form ── */}
      <div className="w-full lg:w-80 flex-shrink-0">
        <div className="sticky top-6">
          <PackageForm classes={classes} />
        </div>
      </div>
    </div>
  );
}
