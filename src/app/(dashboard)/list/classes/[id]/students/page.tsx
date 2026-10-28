import FormContainer from "@/components/FormContainer";
import TableSearch from "@/components/TableSearch";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import Link from "next/link";
import Image from "next/image";
import { auth } from "@/lib/auth-server";
import { notFound } from "next/navigation";
import {
  BookOpen,
  Users,
  Eye,
  Pencil,
  ArrowLeft,
  Plus,
  Layers,
  Filter,
} from "lucide-react";
import ClassesPdfGenerator from "../../ClassesPdfGenerator";
import { PrintableClass } from "../../ClassesPrintView";

const ClassStudentsPage = async ({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { [key: string]: string | undefined };
}) => {
  const { role } = await auth();
  const classId = parseInt(params.id);

  const classRecord = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      supervisor: true,
      sections: {
        select: { id: true, name: true },
        orderBy: { name: "asc" },
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

  const query: Prisma.StudentWhereInput = { classId };

  if (searchParams.section) {
    if (searchParams.section === "unassigned") {
      query.AND = [
        { sectionId: null },
        { OR: [{ section: null }, { section: "" }] },
      ];
    } else {
      query.OR = [
        { section: { equals: searchParams.section, mode: "insensitive" } },
        {
          sectionRelation: {
            name: { equals: searchParams.section, mode: "insensitive" },
          },
        },
      ];
    }
  }

  if (searchParams.search) {
    const val = searchParams.search;
    const num = parseInt(val);
    const searchConditions: Prisma.StudentWhereInput[] = [
      { name: { contains: val, mode: "insensitive" } },
      { surname: { contains: val, mode: "insensitive" } },
      { nameBn: { contains: val, mode: "insensitive" } },
    ];
    if (!isNaN(num)) {
      searchConditions.push({ studentId: num }, { rollNo: num });
    }

    if (query.OR) {
      query.AND = [
        { OR: query.OR },
        { OR: searchConditions },
      ];
      delete query.OR;
    } else {
      query.OR = searchConditions;
    }
  }

  const students = await prisma.student.findMany({
    where: query,
    include: {
      sectionRelation: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ rollNo: "asc" }, { name: "asc" }],
  });

  const enrolledCount = classRecord._count.students;
  const occupancyPercent =
    classRecord.capacity > 0
      ? Math.round((enrolledCount / classRecord.capacity) * 100)
      : 0;
  const availableSeats = Math.max(0, classRecord.capacity - enrolledCount);

  const printableClass: PrintableClass = {
    id: classRecord.id,
    name: classRecord.name,
    capacity: classRecord.capacity,
    supervisor: classRecord.supervisor
      ? {
          id: classRecord.supervisor.id,
          name: classRecord.supervisor.name,
          surname: classRecord.supervisor.surname,
          email: classRecord.supervisor.email,
          phone: classRecord.supervisor.phone,
        }
      : null,
    sections: classRecord.sections,
    students: students.map((s) => ({
      id: s.id,
      studentId: s.studentId,
      rollNo: s.rollNo,
      name: s.name,
      surname: s.surname,
      sex: s.sex,
      phone: s.phone,
      section: s.sectionRelation?.name || s.section,
    })),
    _count: classRecord._count,
  };

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
          <ClassesPdfGenerator
            classes={[printableClass]}
            defaultClassId={classRecord.id}
          />
          <Link
            href={`/list/students?classId=${classId}`}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
          >
            <Users className="w-3.5 h-3.5 text-slate-600" />
            Open in Student Directory
          </Link>
          {role === "admin" && (
            <Link
              href="/list/students/admission-form"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Admission
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
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
          className="pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors border-blue-600 text-blue-600"
        >
          <Users className="w-4 h-4" />
          Students ({classRecord._count.students})
        </Link>
        <Link
          href={`/list/classes/${classId}/sections`}
          className="pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors border-transparent text-slate-500 hover:text-slate-700"
        >
          <Layers className="w-4 h-4" />
          Sections ({classRecord._count.sections})
        </Link>
      </div>

      {/* Section Filter Pills */}
      {classRecord.sections.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-3 text-xs">
          <span className="text-slate-500 font-semibold flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            Filter Section:
          </span>
          <Link
            href={`/list/classes/${classId}/students`}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors shrink-0 ${
              !searchParams.section
                ? "bg-blue-700 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All Sections
          </Link>
          {classRecord.sections.map((sec) => (
            <Link
              key={sec.id}
              href={`/list/classes/${classId}/students?section=${encodeURIComponent(
                sec.name
              )}`}
              className={`px-3 py-1.5 rounded-xl font-semibold transition-colors shrink-0 ${
                searchParams.section === sec.name
                  ? "bg-blue-700 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Section {sec.name}
            </Link>
          ))}
          <Link
            href={`/list/classes/${classId}/students?section=unassigned`}
            className={`px-3 py-1.5 rounded-xl font-semibold transition-colors shrink-0 ${
              searchParams.section === "unassigned"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Unassigned
          </Link>
        </div>
      )}

      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="w-full max-w-sm">
          <TableSearch />
        </div>
        <p className="text-xs text-slate-500">
          Showing{" "}
          <span className="font-semibold text-slate-700">
            {students.length}
          </span>{" "}
          students
        </p>
      </div>

      {/* Students List */}
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider w-20">
                Roll
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Student
              </th>
              <th className="hidden md:table-cell px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Student ID
              </th>
              <th className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Section
              </th>
              <th className="hidden sm:table-cell px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Gender
              </th>
              <th className="hidden lg:table-cell px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Contact Phone
              </th>
              <th className="hidden xl:table-cell px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Blood Group
              </th>
              <th className="px-5 py-3.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider pr-6">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {students.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="text-center py-12 text-slate-400 text-sm"
                >
                  {searchParams.search || searchParams.section
                    ? "No students match the current filters."
                    : `No students enrolled in Class ${classRecord.name} yet.`}
                </td>
              </tr>
            ) : (
              students.map((student) => {
                const sectionDisplay =
                  student.sectionRelation?.name || student.section;

                return (
                  <tr
                    key={student.id}
                    className="hover:bg-blue-50/50 transition-colors text-sm"
                  >
                    {/* Roll No */}
                    <td className="px-5 py-4 font-semibold text-slate-700">
                      {student.rollNo != null ? (
                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold font-mono">
                          {String(student.rollNo).padStart(2, "0")}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-xs font-mono">
                          —
                        </span>
                      )}
                    </td>

                    {/* Student Info */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex-shrink-0 relative border border-slate-200">
                          <Image
                            src={student.img || "/noAvatar.png"}
                            alt=""
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex flex-col">
                          <Link
                            href={`/list/students/${student.id}`}
                            className="font-semibold text-slate-800 hover:text-blue-600 transition-colors"
                          >
                            {student.name} {student.surname}
                          </Link>
                          {student.nameBn && (
                            <span className="text-xs text-slate-400">
                              {student.nameBn}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Student ID */}
                    <td className="hidden md:table-cell px-5 py-4 text-xs font-mono text-slate-600">
                      {student.studentId}
                    </td>

                    {/* Section Badge */}
                    <td className="px-5 py-4">
                      {sectionDisplay ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          Sec {sectionDisplay}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 italic">
                          Unassigned
                        </span>
                      )}
                    </td>

                    {/* Gender */}
                    <td className="hidden sm:table-cell px-5 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          student.sex === "MALE"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {student.sex}
                      </span>
                    </td>

                    {/* Contact Phone */}
                    <td className="hidden lg:table-cell px-5 py-4 text-sm text-slate-600">
                      {student.phone ||
                        student.guardianPhone ||
                        student.fatherPhone ||
                        "—"}
                    </td>

                    {/* Blood Group */}
                    <td className="hidden xl:table-cell px-5 py-4 text-xs font-medium text-slate-600">
                      {student.bloodType ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {student.bloodType}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/list/students/${student.id}`}
                          className="w-7 h-7 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                          title="View Profile"
                        >
                          <Eye size={14} />
                        </Link>
                        {role === "admin" && (
                          <>
                            <Link
                              href={`/list/students/${student.id}/edit`}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                              title="Edit"
                            >
                              <Pencil size={13} />
                            </Link>
                            <FormContainer
                              table="student"
                              type="delete"
                              id={student.id}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ClassStudentsPage;
