import FormContainer from "@/components/FormContainer";
import prisma from "@/lib/prisma";
import Link from "next/link";
import { auth } from "@/lib/auth-server";
import { notFound } from "next/navigation";
import {
  BookOpen,
  Users,
  Layers,
  ArrowLeft,
  UserCheck,
  Plus,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import MergeClassModal from "./MergeClassModal";

const ClassSectionsPage = async ({
  params,
}: {
  params: { id: string };
}) => {
  const { role } = await auth();
  const classId = parseInt(params.id);

  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      supervisor: true,
      sections: {
        include: {
          supervisor: true,
          students: {
            select: { id: true },
          },
          _count: {
            select: { students: true },
          },
        },
        orderBy: { name: "asc" },
      },
      students: {
        select: {
          id: true,
          section: true,
          sectionId: true,
        },
      },
      _count: {
        select: {
          students: true,
          subjects: true,
          sections: true,
        },
      },
    },
  });

  if (!classRecord) notFound();

  // Fetch all classes for the merge tool
  const otherClasses = await prisma.class.findMany({
    select: {
      id: true,
      name: true,
      capacity: true,
      _count: {
        select: {
          students: true,
          subjects: true,
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const enrolledCount = classRecord._count.students;
  const occupancyPercent =
    classRecord.capacity > 0
      ? Math.round((enrolledCount / classRecord.capacity) * 100)
      : 0;
  const availableSeats = Math.max(0, classRecord.capacity - enrolledCount);

  // Calculate unassigned students (those with no sectionId or section string not matching any section)
  const existingSectionNames = new Set(
    classRecord.sections.map((s) => s.name.toUpperCase())
  );
  const unassignedStudentsCount = classRecord.students.filter(
    (s) =>
      !s.sectionId &&
      (!s.section || !existingSectionNames.has(s.section.toUpperCase()))
  ).length;

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-100 m-4 mt-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <Link
            href="/list/classes"
            className="text-xs font-semibold text-slate-500 hover:text-blue-600 flex items-center gap-1.5 mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to All Classes
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-800">
              Class {classRecord.name}
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {enrolledCount} Enrolled
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200">
              {classRecord.capacity} Capacity
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                occupancyPercent >= 100
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              {availableSeats} Seats Available ({occupancyPercent}%)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Supervisor:{" "}
            {classRecord.supervisor ? (
              <span className="font-semibold text-slate-700">
                {classRecord.supervisor.name} {classRecord.supervisor.surname}
                {classRecord.supervisor.phone
                  ? ` (${classRecord.supervisor.phone})`
                  : ""}
              </span>
            ) : (
              <span className="italic text-slate-400">
                No supervisor assigned
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {role === "admin" && (
            <>
              <MergeClassModal
                targetClass={{ id: classRecord.id, name: classRecord.name }}
                availableClasses={otherClasses}
              />
              <FormContainer
                table="section"
                type="create"
                data={{ classId }}
              />
            </>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mt-6 mb-6">
        <Link
          href={`/list/classes/${classId}/subjects`}
          className="pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors border-transparent text-slate-500 hover:text-slate-700"
        >
          <BookOpen className="w-4 h-4" />
          Subjects ({classRecord._count.subjects})
        </Link>
        <Link
          href={`/list/classes/${classId}/students`}
          className="pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors border-transparent text-slate-500 hover:text-slate-700"
        >
          <Users className="w-4 h-4" />
          Students ({classRecord._count.students})
        </Link>
        <Link
          href={`/list/classes/${classId}/sections`}
          className="pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors border-blue-600 text-blue-600"
        >
          <Layers className="w-4 h-4" />
          Sections ({classRecord._count.sections})
        </Link>
      </div>

      {/* Notice if unassigned students exist */}
      {unassignedStudentsCount > 0 && classRecord.sections.length > 0 && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-900">
            <span className="font-bold bg-amber-200 text-amber-900 w-5 h-5 rounded-full flex items-center justify-center shrink-0">
              !
            </span>
            <span>
              <strong>{unassignedStudentsCount} students</strong> in Class{" "}
              {classRecord.name} are currently not assigned to any section.
            </span>
          </div>
          <Link
            href={`/list/classes/${classId}/students?section=unassigned`}
            className="inline-flex items-center gap-1 font-semibold text-amber-800 hover:text-amber-950 underline"
          >
            <span>View Unassigned Students</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Sections Grid */}
      {classRecord.sections.length === 0 ? (
        <div className="text-center py-16 px-4 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-base">
            No sections yet in Class {classRecord.name}
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            You can create sections (like Section A, Section B, Rose, or Padma)
            to organize students, assign section supervisors, and manage rosters.
          </p>
          {role === "admin" && (
            <div className="mt-5 flex items-center justify-center gap-3">
              <FormContainer table="section" type="create" data={{ classId }} />
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classRecord.sections.map((sec) => {
            const studentCount = sec._count.students;
            const secCapacity = sec.capacity || classRecord.capacity;
            const secPercent =
              secCapacity > 0
                ? Math.round((studentCount / secCapacity) * 100)
                : 0;

            return (
              <div
                key={sec.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top: Section Name & Actions */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                        {sec.name}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">
                          Section {sec.name}
                        </h4>
                        <span className="text-[11px] text-slate-400">
                          Class {classRecord.name}
                        </span>
                      </div>
                    </div>

                    {role === "admin" && (
                      <div className="flex items-center gap-1.5">
                        <FormContainer
                          table="section"
                          type="update"
                          data={{
                            id: sec.id,
                            name: sec.name,
                            capacity: sec.capacity,
                            supervisorId: sec.supervisorId ?? "",
                            classId,
                          }}
                        />
                        <FormContainer
                          table="section"
                          type="delete"
                          id={sec.id}
                        />
                      </div>
                    )}
                  </div>

                  {/* Body Info */}
                  <div className="py-4 space-y-3">
                    {/* Supervisor */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Supervisor:</span>
                      {sec.supervisor ? (
                        <span className="font-semibold text-slate-700">
                          {sec.supervisor.name} {sec.supervisor.surname}
                        </span>
                      ) : (
                        <span className="italic text-slate-400">—</span>
                      )}
                    </div>

                    {/* Students & Capacity */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">Students:</span>
                      <span className="font-bold text-blue-700">
                        {studentCount}{" "}
                        <span className="text-slate-400 font-normal">
                          / {secCapacity} seats
                        </span>
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            secPercent >= 100
                              ? "bg-rose-500"
                              : secPercent >= 80
                              ? "bg-amber-500"
                              : "bg-blue-600"
                          }`}
                          style={{ width: `${Math.min(100, secPercent)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>{secPercent}% Occupancy</span>
                        <span>{Math.max(0, secCapacity - studentCount)} available</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom link to view students in this section */}
                <div className="pt-3 border-t border-slate-100">
                  <Link
                    href={`/list/classes/${classId}/students?section=${encodeURIComponent(
                      sec.name
                    )}`}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-slate-700 hover:text-blue-700 bg-slate-50 hover:bg-blue-50 rounded-xl transition-colors"
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>View Students ({studentCount})</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ClassSectionsPage;
