import FormContainer from "@/components/FormContainer";
import Pagination from "@/components/Pagination";
import Table from "@/components/Table";
import TableSearch from "@/components/TableSearch";
import prisma from "@/lib/prisma";
import { ITEM_PER_PAGE } from "@/lib/settings";
import { Class, Prisma, Teacher } from "@prisma/client";
import Link from "next/link";
import { auth } from "@/lib/auth-server";
import { Users, School, BookOpen, Layers, Percent } from "lucide-react";
import ClassesPdfGenerator from "./ClassesPdfGenerator";
import ClassesPrintView, { PrintableClass } from "./ClassesPrintView";

type ClassList = Class & {
  supervisor: Teacher | null;
  serialNumber?: number;
  _count: {
    students: number;
    subjects: number;
  };
};

const ClassListPage = async ({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) => {
  const { role } = await auth();

  const columns = [
    {
      header: "Class Name",
      accessor: "name",
    },
    {
      header: "Students",
      accessor: "students",
    },
    {
      header: "Capacity",
      accessor: "capacity",
      className: "hidden md:table-cell",
    },
    {
      header: "Supervisor",
      accessor: "supervisor",
      className: "hidden md:table-cell",
    },
    {
      header: "Subjects",
      accessor: "subjects",
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

  const renderRow = (item: ClassList, index?: number) => {
    const studentCount = item._count?.students || 0;
    const capacity = item.capacity || 0;
    const occupancyPercent = capacity > 0 ? Math.round((studentCount / capacity) * 100) : 0;
    const serialNumber = item.serialNumber ?? ((p - 1) * ITEM_PER_PAGE + (index ?? 0) + 1);

    return (
      <tr
        key={item.id}
        className="relative text-sm hover:bg-blue-50/50 transition-colors group"
      >
        {/* Class Name */}
        <td className="p-4 font-semibold text-slate-800">
          <Link href={`/list/classes/${item.id}/students`} className="absolute inset-0" />
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 border border-blue-200/60 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
              {String(serialNumber).padStart(2, "0")}
            </span>
            <div className="flex flex-col">
              <span className="font-semibold text-slate-800">Class {item.name}</span>
              <span className="text-xs text-slate-400 md:hidden">
                {studentCount} / {capacity} students
              </span>
            </div>
          </div>
        </td>

        {/* Student Numbers */}
        <td className="p-4">
          <div className="relative z-10 flex items-center gap-2">
            <Link
              href={`/list/classes/${item.id}/students`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
              title={`View ${studentCount} students in Class ${item.name}`}
            >
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span>{studentCount} Students</span>
            </Link>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-md hidden sm:inline ${
                occupancyPercent >= 100
                  ? "bg-rose-50 text-rose-700"
                  : occupancyPercent >= 80
                  ? "bg-amber-50 text-amber-700"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {occupancyPercent}% full
            </span>
          </div>
        </td>

        {/* Capacity */}
        <td className="hidden md:table-cell p-4 text-slate-600">
          <span className="font-semibold text-slate-800">{capacity}</span>
          <span className="text-xs text-slate-400 ml-1">seats</span>
        </td>

        {/* Supervisor */}
        <td className="hidden md:table-cell p-4 text-slate-600">
          {item.supervisor ? (
            <div className="flex flex-col">
              <span className="font-medium text-slate-800">
                {item.supervisor.name} {item.supervisor.surname}
              </span>
              {item.supervisor.phone && (
                <span className="text-xs text-slate-400">{item.supervisor.phone}</span>
              )}
            </div>
          ) : (
            <span className="text-slate-300 italic">—</span>
          )}
        </td>

        {/* Subjects */}
        <td className="hidden lg:table-cell p-4 text-slate-600">
          <Link
            href={`/list/classes/${item.id}/subjects`}
            className="relative z-10 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-slate-400" />
            <span>{item._count?.subjects || 0} Subjects</span>
          </Link>
        </td>

        {/* Actions */}
        <td>
          <div className="relative z-10 flex items-center justify-end gap-2 pr-4">
            {role === "admin" && (
              <>
                <FormContainer
                  table="class"
                  type="update"
                  data={{
                    id: item.id,
                    name: item.name,
                    capacity: item.capacity,
                    supervisorId: item.supervisorId ?? "",
                  }}
                />
                <FormContainer table="class" type="delete" id={item.id} />
              </>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const { page, ...queryParams } = searchParams;
  const p = page ? parseInt(page) : 1;

  // URL PARAMS CONDITION
  const query: Prisma.ClassWhereInput = {};

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        switch (key) {
          case "supervisorId":
            query.supervisorId = value;
            break;
          case "search":
            query.name = { contains: value, mode: "insensitive" };
            break;
          default:
            break;
        }
      }
    }
  }

  // Fetch paginated classes and all classes for summary / PDF
  const [data, count, rawAllClasses] = await prisma.$transaction([
    prisma.class.findMany({
      where: query,
      include: {
        supervisor: true,
        _count: {
          select: {
            students: true,
            subjects: true,
          },
        },
      },
      take: ITEM_PER_PAGE,
      skip: ITEM_PER_PAGE * (p - 1),
    }),
    prisma.class.count({ where: query }),
    prisma.class.findMany({
      include: {
        supervisor: {
          select: {
            id: true,
            name: true,
            surname: true,
            email: true,
            phone: true,
          },
        },
        students: {
          select: {
            id: true,
            studentId: true,
            rollNo: true,
            name: true,
            surname: true,
            sex: true,
            phone: true,
          },
          orderBy: [{ rollNo: "asc" }, { name: "asc" }],
        },
        subjects: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            students: true,
            subjects: true,
          },
        },
      },
    }),
  ]);

  // Natural sort classes by academic level (1, 2, ... 10)
  const sortClassNames = <T extends { name: string }>(list: T[]): T[] => {
    return [...list].sort((a, b) => {
      const numA = parseInt(a.name);
      const numB = parseInt(b.name);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.name.localeCompare(b.name);
    });
  };

  const sortedData = sortClassNames(data).map((item, index) => ({
    ...item,
    serialNumber: (p - 1) * ITEM_PER_PAGE + index + 1,
  }));
  const allClassesForPdf: PrintableClass[] = sortClassNames(rawAllClasses);

  // Summary KPI values
  const totalClasses = allClassesForPdf.length;
  const totalStudents = allClassesForPdf.reduce(
    (sum, c) => sum + (c._count?.students || 0),
    0
  );
  const totalCapacity = allClassesForPdf.reduce(
    (sum, c) => sum + (c.capacity || 0),
    0
  );
  const overallOccupancy =
    totalCapacity > 0 ? Math.round((totalStudents / totalCapacity) * 100) : 0;

  return (
    <>
      {/* SCREEN VIEW */}
      <div className="print:hidden space-y-4 m-4 mt-0">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <School className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Classes</p>
              <h3 className="text-xl font-bold text-slate-800">{totalClasses}</h3>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Enrolled Students</p>
              <h3 className="text-xl font-bold text-indigo-700">{totalStudents}</h3>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Total Capacity</p>
              <h3 className="text-xl font-bold text-slate-800">{totalCapacity}</h3>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-medium">Occupancy Rate</p>
              <h3 className="text-xl font-bold text-emerald-700">{overallOccupancy}%</h3>
            </div>
          </div>
        </div>

        {/* Classes Table Container */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-100">
          {/* TOP BAR */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5 border-b border-slate-100">
            <div>
              <h1 className="text-lg font-bold text-slate-800">All Classes</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Overview of academic classes, enrollment capacity, and student numbers
              </p>
            </div>
            <div className="flex items-center flex-wrap gap-3">
              <TableSearch />
              <ClassesPdfGenerator classes={allClassesForPdf} />
              {role === "admin" && <FormContainer table="class" type="create" />}
            </div>
          </div>

          {/* LIST */}
          <Table columns={columns} renderRow={renderRow} data={sortedData} />

          {/* PAGINATION */}
          <Pagination page={p} count={count} />
        </div>
      </div>

      {/* PRINT-ONLY OFFICIAL VIEW */}
      <ClassesPrintView classes={allClassesForPdf} />
    </>
  );
};

export default ClassListPage;
