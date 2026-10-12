import FormContainer from "@/components/FormContainer";
import Pagination from "@/components/Pagination";
import TableSearch from "@/components/TableSearch";
import StudentFilters from "@/components/StudentFilters";
import Table from "@/components/Table";
import ClickableRow from "@/components/ClickableRow";
import StudentActionCell from "@/components/StudentActionCell";
import Link from "next/link";
import { Suspense } from "react";
import { Pencil } from "lucide-react";

import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Class, Prisma, Student } from "@prisma/client";
import Image from "next/image";

import { auth } from "@/lib/auth-server";

type StudentList = Student & { class: Class };

const StudentListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { role } = await auth();

  const columns = [
    {
      header: "Roll",
      accessor: "rollNo",
      className: "w-20",
    },
    {
      header: "Student",
      accessor: "info",
    },
    {
      header: "Student ID",
      accessor: "studentId",
      className: "hidden md:table-cell",
    },
    {
      header: "Class",
      accessor: "class",
      className: "hidden sm:table-cell",
    },
    {
      header: "Phone",
      accessor: "phone",
      className: "hidden lg:table-cell",
    },
    ...(role === "admin"
      ? [
          {
            header: "Actions",
            accessor: "action",
            className: "text-right pr-6",
          },
        ]
      : []),
  ];

  const renderRow = (item: StudentList) => (
    <ClickableRow
      key={item.id}
      href={`/list/students/${item.id}`}
      className="text-sm hover:bg-blue-50 transition-colors"
    >
      <td className="px-5 py-4 font-semibold text-slate-700">
        {item.rollNo != null ? (
          <span className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-slate-100 text-slate-800 text-xs font-bold font-mono">
            {item.rollNo}
          </span>
        ) : (
          <span className="text-slate-300 text-xs font-mono">—</span>
        )}
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex-shrink-0 relative border border-slate-200">
            <Image
              src={item.img || "/noAvatar.png"}
              alt=""
              fill
              className="object-cover"
            />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-800">
              {item.name} {item.surname}
            </span>
            {item.nameBn && (
              <span className="text-xs text-slate-400">{item.nameBn}</span>
            )}
          </div>
        </div>
      </td>
      <td className="hidden md:table-cell px-5 py-4 text-xs font-mono text-slate-600">
        {item.studentId}
      </td>
      <td className="hidden sm:table-cell px-5 py-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="bg-blue-50 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-blue-100">
            Class {item.class.name}
          </span>
          {item.section && (
            <span className="bg-slate-100 text-slate-600 text-xs font-medium px-2 py-0.5 rounded-full">
              Sec: {item.section}
            </span>
          )}
        </div>
      </td>
      <td className="hidden lg:table-cell px-5 py-4 text-sm text-slate-600">
        {item.phone || item.guardianPhone || item.fatherPhone || "—"}
      </td>
      {role === "admin" && (
        <StudentActionCell className="text-right pr-6">
          <Link
            href={`/list/students/${item.id}/edit`}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Edit"
          >
            <Pencil size={13} />
          </Link>
          <FormContainer table="student" type="delete" id={item.id} />
        </StudentActionCell>
      )}
    </ClickableRow>
  );

  const { page, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;

  const query: Prisma.StudentWhereInput = {};

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "teacherId":
            query.class = {
              lessons: { some: { teacherId: value } },
            };
            break;
          case "classId":
            query.classId = parseInt(value);
            break;
          case "search":
            const numericSearch = parseInt(value);
            query.OR = [
              { name: { contains: value, mode: "insensitive" } },
              { surname: { contains: value, mode: "insensitive" } },
              ...(!isNaN(numericSearch) ? [{ studentId: numericSearch }] : []),
            ];
            break;
          default:
            break;
        }
      }
    }
  }

  const isClassFiltered = query.classId !== undefined;

  const orderByClause: Prisma.StudentOrderByWithRelationInput[] = isClassFiltered
    ? [
        { rollNo: { sort: "asc", nulls: "last" } },
        { name: "asc" },
      ]
    : [
        { class: { name: "asc" } },
        { rollNo: { sort: "asc", nulls: "last" } },
        { name: "asc" },
      ];

  const findManyArgs: Prisma.StudentFindManyArgs = {
    where: query,
    include: { class: true },
    orderBy: orderByClause,
    ...(isClassFiltered ? {} : { take: ITEM_PER_PAGE, skip: ITEM_PER_PAGE * (p - 1) }),
  };

  const [data, count, allClasses] = await prisma.$transaction([
    prisma.student.findMany(findManyArgs),
    prisma.student.count({ where: query }),
    prisma.class.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const selectedClass = query.classId ? allClasses.find((c) => c.id === query.classId) : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-100 m-4 mt-0">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-5 border-b border-slate-100">
        <div>
          <h1 className="text-lg font-semibold text-slate-800">
            {selectedClass ? `Class ${selectedClass.name} Students` : "All Students"}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {count} student{count !== 1 ? "s" : ""}{isClassFiltered ? " (sorted by roll)" : " total"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <TableSearch />
          <Suspense fallback={null}>
            <StudentFilters classes={allClasses} />
          </Suspense>
          {role === "admin" && (
            <Link href="/list/students/admission-form">
              <button className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
                + New Admission
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* Table */}
      {data.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Image src="/noAvatar.png" alt="" width={48} height={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No students found</p>
        </div>
      ) : (
        <div className="p-5">
          <Table columns={columns} renderRow={renderRow} data={data} />
        </div>
      )}

      {/* Pagination / Footer */}
      {isClassFiltered ? (
        count > 0 && (
          <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing all {count} student{count !== 1 ? "s" : ""} in Class {selectedClass?.name} (sorted by roll)
            </span>
          </div>
        )
      ) : (
        <Pagination page={p} count={count} />
      )}
    </div>
  );
};

export default StudentListPage;
