import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import RoutineGrid from "../RoutineGrid";

export default async function RoutineEditPage({
  searchParams,
}: {
  searchParams: { classId?: string };
}) {
  const { role, userId } = await auth();
  if (!role || !userId) redirect("/");
  if (role !== "admin") redirect("/routine");

  const classes = await prisma.class.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const targetClassId = searchParams.classId
    ? parseInt(searchParams.classId)
    : (classes[0]?.id ?? null);

  const rawLessons = targetClassId
    ? await prisma.lesson.findMany({
        where: { classId: targetClassId },
        include: {
          subject: { select: { id: true, name: true } },
          teacher: { select: { id: true, name: true, surname: true } },
        },
        orderBy: { startTime: "asc" },
      })
    : [];

  const subjects = targetClassId
    ? await prisma.subject.findMany({
        where: { classId: targetClassId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  const teachers = await prisma.teacher.findMany({
    select: { id: true, name: true, surname: true },
    orderBy: { name: "asc" },
  });

  const activeClass = classes.find((c) => c.id === targetClassId);

  return (
    <div className="p-6 bg-[#f8fafe] flex-1 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
            <Link href="/routine" className="hover:text-lamaSky transition-colors">
              Routine
            </Link>
            <span>/</span>
            <span className="text-gray-600 font-medium">
              Edit — Class {activeClass?.name ?? "—"}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Edit Routine</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Add, update, or remove periods for each day.
          </p>
        </div>
        <Link
          href={`/routine${targetClassId ? `?classId=${targetClassId}` : ""}`}
          className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
        >
          <Image src="/view.png" alt="" width={16} height={16} className="opacity-60" />
          View Routine
        </Link>
      </div>

      {/* Class picker */}
      <form
        method="GET"
        action="/routine/edit"
        className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-wrap items-end gap-3 max-w-sm"
      >
        <div className="flex flex-col gap-1 flex-1">
          <label className="text-xs font-semibold text-gray-500">Class</label>
          <select
            name="classId"
            defaultValue={targetClassId?.toString() ?? ""}
            className="ring-1 ring-gray-200 p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-lamaSky bg-white"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                Class {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="bg-lamaSky text-white font-semibold py-2.5 px-5 rounded-xl text-sm hover:bg-[#1e40af] transition-colors"
        >
          Switch
        </button>
      </form>

      {/* Hint */}
      <p className="text-xs text-gray-400 -mt-3">
        Hover over a period card to edit or delete it. Click &quot;+ Add Period&quot; to add a new one.
      </p>

      {/* Grid */}
      {targetClassId ? (
        <RoutineGrid
          lessons={JSON.parse(JSON.stringify(rawLessons))}
          subjects={subjects}
          teachers={teachers}
          classId={targetClassId}
          role="admin"
        />
      ) : (
        <div className="text-center py-20 text-gray-400 text-sm">No class selected.</div>
      )}
    </div>
  );
}
