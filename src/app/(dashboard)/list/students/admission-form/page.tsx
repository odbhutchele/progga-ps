import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import Link from "next/link";
import AdmissionForm from "./AdmissionForm";

export default async function AdmissionFormPage() {
  const { role } = await auth();
  if (role !== "admin") redirect("/list/students");

  const classes = await prisma.class.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
        <Link
          href="/list/students"
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-800 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Students
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-xs font-bold text-gray-800">New Admission</span>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">Student Admission Form</h1>
          <p className="text-sm text-slate-500 mt-1">
            প্রজ্ঞা প্রিপারেটরী এন্ড হাই স্কুল — fill in all available details from the physical admission form.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <AdmissionForm classes={classes} />
        </div>
      </div>
    </div>
  );
}
