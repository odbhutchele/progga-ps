import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import NoticeBoardPortal from "./NoticeBoardPortal";
import { getSchoolDateString, parseDateOnlyUtc } from "@/lib/schoolDate";

export default async function NoticesPage() {
  const { role, userId } = await auth();

  if (!role || !userId) redirect("/");

  const classes = await prisma.class.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const config = await prisma.smsConfig.findFirst({
    select: { apiUrl: true, apiKey: true, senderId: true },
  });

  const students = await prisma.student.findMany({
    select: { id: true, name: true, surname: true, classId: true },
    orderBy: [{ classId: "asc" }, { surname: "asc" }],
  });

  // Today's absent students count for the quick-action card
  const todayStr = getSchoolDateString();
  const startOfDay = parseDateOnlyUtc(todayStr)!;
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  const absentTodayCount = await prisma.student.count({
    where: {
      attendances: {
        some: {
          date: { gte: startOfDay, lt: endOfDay },
          present: false,
        },
      },
    },
  });

  let noticeFilter: any = {};
  if (role === "student") {
    const student = await prisma.student.findUnique({
      where: { id: userId },
      select: { classId: true },
    });
    noticeFilter = {
      OR: [
        { classId: null },
        { classId: student?.classId ?? 0 },
        { recipientId: userId },
      ],
    };
  }

  const notices = await prisma.notice.findMany({
    where: noticeFilter,
    include: { class: { select: { name: true } } },
    orderBy: { date: "desc" },
  });

  return (
    <div className="p-6 bg-[#f8fafe] flex-1 flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">Guardian SMS Portal</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Send SMS announcements to student guardians via Greenweb bulk gateway.
        </p>
      </div>
      <NoticeBoardPortal
        role={role}
        classes={classes}
        students={students}
        currentConfig={config}
        notices={notices}
        absentTodayCount={absentTodayCount}
        todayStr={todayStr}
      />
    </div>
  );
}
