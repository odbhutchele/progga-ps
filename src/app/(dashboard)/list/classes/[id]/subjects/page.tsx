import FormContainer from "@/components/FormContainer";
import TableSearch from "@/components/TableSearch";
import prisma from "@/lib/prisma";
import { Prisma, Subject, Teacher } from "@prisma/client";
import Link from "next/link";
import { auth } from "@/lib/auth-server";
import { notFound } from "next/navigation";
import { BookOpen, Users, ArrowLeft } from "lucide-react";

type SubjectList = Subject & { teachers: Teacher[] };

const ClassSubjectsPage = async ({
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
      _count: {
        select: {
          students: true,
          subjects: true,
        },
      },
    },
  });

  if (!classRecord) notFound();

  const query: Prisma.SubjectWhereInput = { classId };
  if (searchParams.search) {
    query.name = { contains: searchParams.search, mode: "insensitive" };
  }

  const [data, count] = await prisma.$transaction([
    prisma.subject.findMany({
      where: query,
      include: { teachers: true },
      orderBy: { name: "asc" },
    }),
    prisma.subject.count({ where: query }),
  ]);

  const enrolledCount = classRecord._count.students;
  const occupancyPercent = classRecord.capacity > 0 
    ? Math.round((enrolledCount / classRecord.capacity) * 100) 
    : 0;
  const availableSeats = Math.max(0, classRecord.capacity - enrolledCount);

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
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              occupancyPercent >= 100 
                ? "bg-rose-50 text-rose-700 border border-rose-200" 
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}>
              {availableSeats} Seats Available ({occupancyPercent}%)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Supervisor:{" "}
            {classRecord.supervisor ? (
              <span className="font-semibold text-slate-700">
                {classRecord.supervisor.name} {classRecord.supervisor.surname}
                {classRecord.supervisor.phone ? ` (${classRecord.supervisor.phone})` : ""}
              </span>
            ) : (
              <span className="italic text-slate-400">No supervisor assigned</span>
            )}
          </p>
        </div>
        {role === "admin" && (
          <FormContainer table="subject" type="create" data={{ classId }} />
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 mt-6 mb-6">
        <Link
          href={`/list/classes/${classId}/subjects`}
          className="pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors border-blue-600 text-blue-600"
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
      </div>

      {/* Search */}
      <div className="max-w-sm mb-4">
        <TableSearch />
      </div>

      {/* List */}
      <div className="divide-y divide-slate-100 mt-4 rounded-xl border border-slate-100 overflow-hidden">
        {data.length === 0 && (
          <p className="text-center text-slate-400 py-12 text-sm bg-white">
            No subjects yet. Add one to get started.
          </p>
        )}
        {data.map((item: SubjectList) => (
          <div
            key={item.id}
            className="flex items-center justify-between py-3.5 px-4 bg-white hover:bg-slate-50 transition-colors"
          >
            {/* Subject name */}
            <span className="font-semibold text-slate-800 w-48 shrink-0">
              {item.name}
            </span>

            {/* Teacher badges */}
            <div className="flex flex-wrap gap-1.5 flex-1 px-4">
              {item.teachers.length > 0 ? (
                item.teachers.map((t) => (
                  <span
                    key={t.id}
                    className="bg-sky-50 text-sky-700 text-xs px-2.5 py-1 rounded-full border border-sky-100 font-medium"
                  >
                    {t.name} {t.surname}
                  </span>
                ))
              ) : (
                <span className="text-slate-300 text-sm">—</span>
              )}
            </div>

            {/* Actions */}
            {role === "admin" && (
              <div className="flex items-center gap-2 shrink-0">
                <FormContainer
                  table="subject"
                  type="update"
                  data={{ ...item, classId }}
                />
                <FormContainer table="subject" type="delete" id={item.id} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClassSubjectsPage;
