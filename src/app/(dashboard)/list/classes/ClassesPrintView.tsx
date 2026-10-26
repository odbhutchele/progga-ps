import Image from "next/image";

export type PrintableClass = {
  id: number;
  name: string;
  capacity: number;
  supervisor: {
    id: string;
    name: string;
    surname: string;
    email: string | null;
    phone: string | null;
  } | null;
  students?: {
    id: string;
    studentId: number;
    rollNo: number | null;
    name: string;
    surname: string;
    sex: string;
    phone: string | null;
  }[];
  subjects?: {
    id: number;
    name: string;
  }[];
  _count: {
    students: number;
    subjects: number;
  };
};

export default function ClassesPrintView({
  classes,
}: {
  classes: PrintableClass[];
}) {
  const totalClasses = classes.length;
  const totalStudents = classes.reduce((sum, c) => sum + (c._count?.students || 0), 0);
  const totalCapacity = classes.reduce((sum, c) => sum + (c.capacity || 0), 0);
  const totalVacancies = Math.max(0, totalCapacity - totalStudents);
  const overallOccupancy =
    totalCapacity > 0 ? Math.round((totalStudents / totalCapacity) * 100) : 0;
  const totalSubjects = classes.reduce((sum, c) => sum + (c._count?.subjects || 0), 0);

  const now = new Date();
  const dateFormatted = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div id="classes-printable-report" className="hidden print:block w-full text-slate-900 bg-white p-2">
      {/* Print Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

      {/* Official Letterhead Header */}
      <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative w-14 h-14 rounded-full overflow-hidden border border-slate-300">
            <Image
              src="/school-logo.jpg"
              alt="Logo"
              fill
              className="object-cover"
            />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider text-slate-900">
              Progga Preparatory and High School
            </h1>
            <p className="text-xs text-slate-600 font-medium">
              Official Classes &amp; Student Enrollment Report
            </p>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-600 space-y-0.5">
          <p><strong>Academic Year:</strong> {now.getFullYear()}</p>
          <p><strong>Date Generated:</strong> {dateFormatted}</p>
          <p><strong>Report Type:</strong> Master Academic Classes Summary</p>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-5 gap-2.5 mb-5 text-center">
        <div className="border border-slate-300 bg-slate-50 rounded-lg p-2">
          <span className="block text-[10px] uppercase font-bold text-slate-500">Total Classes</span>
          <span className="text-base font-extrabold text-slate-900">{totalClasses}</span>
        </div>
        <div className="border border-blue-300 bg-blue-50 rounded-lg p-2">
          <span className="block text-[10px] uppercase font-bold text-blue-700">Enrolled Students</span>
          <span className="text-base font-extrabold text-blue-900">{totalStudents}</span>
        </div>
        <div className="border border-slate-300 bg-slate-50 rounded-lg p-2">
          <span className="block text-[10px] uppercase font-bold text-slate-500">Total Capacity</span>
          <span className="text-base font-extrabold text-slate-900">{totalCapacity}</span>
        </div>
        <div className="border border-emerald-300 bg-emerald-50 rounded-lg p-2">
          <span className="block text-[10px] uppercase font-bold text-emerald-700">Available Seats</span>
          <span className="text-base font-extrabold text-emerald-900">{totalVacancies}</span>
        </div>
        <div className="border border-indigo-300 bg-indigo-50 rounded-lg p-2">
          <span className="block text-[10px] uppercase font-bold text-indigo-700">Occupancy Rate</span>
          <span className="text-base font-extrabold text-indigo-900">{overallOccupancy}%</span>
        </div>
      </div>

      {/* Classes Table */}
      <div className="mb-6">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-l-2 border-blue-600 pl-2">
          Classes &amp; Student Enrollment Breakdown
        </h2>
        <table className="w-full border-collapse border border-slate-300 text-xs">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 text-slate-800">
              <th className="border border-slate-300 px-3 py-2 text-left font-bold w-12">#</th>
              <th className="border border-slate-300 px-3 py-2 text-left font-bold">Class Name</th>
              <th className="border border-slate-300 px-3 py-2 text-left font-bold">Class Supervisor</th>
              <th className="border border-slate-300 px-3 py-2 text-center font-bold w-20">Capacity</th>
              <th className="border border-slate-300 px-3 py-2 text-center font-bold w-24">Enrolled Students</th>
              <th className="border border-slate-300 px-3 py-2 text-center font-bold w-24">Available Seats</th>
              <th className="border border-slate-300 px-3 py-2 text-center font-bold w-24">Occupancy</th>
              <th className="border border-slate-300 px-3 py-2 text-center font-bold w-20">Subjects</th>
            </tr>
          </thead>
          <tbody>
            {classes.map((cls, idx) => {
              const enrolled = cls._count?.students || 0;
              const vacancy = Math.max(0, cls.capacity - enrolled);
              const occ = cls.capacity > 0 ? Math.round((enrolled / cls.capacity) * 100) : 0;
              const supervisorName = cls.supervisor
                ? `${cls.supervisor.name} ${cls.supervisor.surname}`
                : "—";

              return (
                <tr key={cls.id} className={idx % 2 === 1 ? "bg-slate-50" : "bg-white"}>
                  <td className="border border-slate-300 px-3 py-1.5 text-slate-600">{idx + 1}</td>
                  <td className="border border-slate-300 px-3 py-1.5 font-bold text-slate-800">
                    Class {cls.name}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-slate-700">
                    <div>{supervisorName}</div>
                    {cls.supervisor?.phone && (
                      <div className="text-[10px] text-slate-500">{cls.supervisor.phone}</div>
                    )}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-center font-semibold text-slate-700">
                    {cls.capacity}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-center font-bold text-blue-700">
                    {enrolled}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-center font-semibold text-emerald-700">
                    {vacancy}
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-center font-semibold text-slate-700">
                    {occ}%
                  </td>
                  <td className="border border-slate-300 px-3 py-1.5 text-center text-slate-600">
                    {cls._count?.subjects || 0}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-bold border-t-2 border-slate-400 text-slate-900">
              <td colSpan={3} className="border border-slate-300 px-3 py-2 text-right">
                Grand Totals / Overall:
              </td>
              <td className="border border-slate-300 px-3 py-2 text-center">{totalCapacity}</td>
              <td className="border border-slate-300 px-3 py-2 text-center text-blue-800">{totalStudents}</td>
              <td className="border border-slate-300 px-3 py-2 text-center text-emerald-800">{totalVacancies}</td>
              <td className="border border-slate-300 px-3 py-2 text-center">{overallOccupancy}%</td>
              <td className="border border-slate-300 px-3 py-2 text-center">{totalSubjects}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Official Signature Lines */}
      <div className="grid grid-cols-3 gap-6 pt-12 text-center text-xs">
        <div>
          <div className="border-t border-slate-400 w-36 mx-auto pt-1 font-semibold text-slate-800">
            Prepared By
          </div>
          <span className="text-[10px] text-slate-500">Administrative Officer</span>
        </div>
        <div>
          <div className="border-t border-slate-400 w-36 mx-auto pt-1 font-semibold text-slate-800">
            Academic Supervisor
          </div>
          <span className="text-[10px] text-slate-500">Academic In-Charge</span>
        </div>
        <div>
          <div className="border-t border-slate-400 w-36 mx-auto pt-1 font-semibold text-slate-800">
            Headmaster / Principal
          </div>
          <span className="text-[10px] text-slate-500">Progga Preparatory and High School</span>
        </div>
      </div>

      {/* System Footer */}
      <div className="mt-8 pt-2 border-t border-slate-200 flex justify-between text-[9px] text-slate-400">
        <span>Generated by Progga Preparatory and High School Academic Management System</span>
        <span>Page 1 of 1</span>
      </div>
    </div>
  );
}
