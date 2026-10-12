import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import BulkAdmissionForm from "./BulkAdmissionForm";
import EditFeeAmount from "./EditFeeAmount";

export default async function AdmissionFeesPage() {
  const { role } = await auth();
  if (role !== "admin") redirect("/");

  const classes = await prisma.class.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const currentYear = new Date().getFullYear();

  const recentFees = await prisma.feeCollection.findMany({
    where: { name: { startsWith: "Admission Fee" } },
    include: { student: { select: { name: true, surname: true, class: { select: { name: true } } } } },
    orderBy: { id: "desc" },
    take: 20,
  });

  const summary = await prisma.feeCollection.groupBy({
    by: ["name", "status"],
    where: { name: { startsWith: "Admission Fee" } },
    _count: { id: true },
    _sum: { amount: true },
  });

  return (
    <div className="p-6 bg-[#f8fafe] flex-1 flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
          <Link href="/fees/collect" className="hover:text-blue-600">Fees</Link>
          <span>/</span>
          <span className="text-gray-600 font-medium">Admission Fees</span>
        </div>
        <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Admission Fees</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Apply a new-year admission fee to all students at once, or track existing admission fee records.
        </p>
      </div>

      {/* Bulk Apply Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-sm font-bold text-slate-700 mb-1">Bulk Apply — New Year Admission Fee</h2>
        <p className="text-xs text-slate-400 mb-4">
          Select a class (or all classes), the academic year, and a per-student amount. Each student gets one unpaid admission fee record.
        </p>
        <BulkAdmissionForm classes={classes} />
      </div>

      {/* Summary by year */}
      {summary.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-700 mb-4">Summary by Year</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Fee Name</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Status</th>
                  <th className="text-right text-xs font-semibold text-slate-500 pb-2">Students</th>
                  <th className="text-right text-xs font-semibold text-slate-500 pb-2">Total Amount (৳)</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50">
                    <td className="py-2 font-medium text-slate-700">{row.name}</td>
                    <td className="py-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        row.status === "PAID" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-2 text-right text-slate-600">{row._count.id}</td>
                    <td className="py-2 text-right text-slate-600">৳{(row._sum.amount ?? 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent records */}
      {recentFees.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-sm font-bold text-slate-700 mb-4">Recent Admission Fee Records</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Student</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Class</th>
                  <th className="text-left text-xs font-semibold text-slate-500 pb-2">Fee</th>
                  <th className="text-right text-xs font-semibold text-slate-500 pb-2">Amount (৳)</th>
                  <th className="text-center text-xs font-semibold text-slate-500 pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentFees.map((fee) => (
                  <tr key={fee.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 font-medium text-slate-700">
                      {fee.student.name} {fee.student.surname}
                    </td>
                    <td className="py-2 text-slate-500">Class {fee.student.class?.name}</td>
                    <td className="py-2 text-slate-500">{fee.name}</td>
                    <td className="py-2 text-right">
                      <EditFeeAmount id={fee.id} amount={fee.amount} paid={fee.status === "PAID"} />
                    </td>
                    <td className="py-2 text-center">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        fee.status === "PAID" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {fee.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {summary.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">
          No admission fee records yet. Use the form above to apply fees for {currentYear}.
        </div>
      )}
    </div>
  );
}
