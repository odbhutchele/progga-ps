"use client";

import { useState } from "react";
import { FileDown, Printer, FileText, Users, X, Loader2, CheckCircle2 } from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PrintableClass } from "./ClassesPrintView";

export default function ClassesPdfGenerator({
  classes,
}: {
  classes: PrintableClass[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const totalClasses = classes.length;
  const totalStudents = classes.reduce((sum, c) => sum + (c._count?.students || 0), 0);
  const totalCapacity = classes.reduce((sum, c) => sum + (c.capacity || 0), 0);
  const totalVacancies = Math.max(0, totalCapacity - totalStudents);
  const overallOccupancy =
    totalCapacity > 0 ? ((totalStudents / totalCapacity) * 100).toFixed(1) : "0";
  const totalSubjects = classes.reduce((sum, c) => sum + (c._count?.subjects || 0), 0);

  const now = new Date();
  const dateFormatted = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const fileDate = now.toISOString().split("T")[0];

  const buildSummaryDoc = () => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const primaryColor: [number, number, number] = [30, 64, 175]; // Blue-800
    const slateDark: [number, number, number] = [15, 23, 42]; // Slate-900
    const slateMuted: [number, number, number] = [100, 116, 139]; // Slate-500

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14.5);
    doc.setTextColor(...primaryColor);
    doc.text("PROGGA PREPARATORY AND HIGH SCHOOL", 105, 14, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...slateDark);
    doc.text("ACADEMIC CLASSES & ENROLLMENT REPORT", 105, 20, { align: "center" });

    doc.setFontSize(8);
    doc.setTextColor(...slateMuted);
    doc.text(
      `Academic Year: ${now.getFullYear()} | Generated on: ${dateFormatted} at ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
      105,
      25,
      { align: "center" }
    );

    // Decorative line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 28, 196, 28);

    // Summary KPI Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 32, 182, 18, 2, 2, "F");
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, 32, 182, 18, 2, 2, "D");

    const metrics = [
      { label: "TOTAL CLASSES", val: String(totalClasses) },
      { label: "ENROLLED STUDENTS", val: String(totalStudents) },
      { label: "TOTAL CAPACITY", val: String(totalCapacity) },
      { label: "AVAILABLE SEATS", val: String(totalVacancies) },
      { label: "OCCUPANCY RATE", val: `${overallOccupancy}%` },
    ];

    const colWidth = 182 / metrics.length;
    metrics.forEach((m, idx) => {
      const x = 14 + idx * colWidth + colWidth / 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...primaryColor);
      doc.text(m.val, x, 40, { align: "center" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      doc.setTextColor(...slateMuted);
      doc.text(m.label, x, 46, { align: "center" });
    });

    // Classes Table
    const tableData = classes.map((c, index) => {
      const enrolled = c._count?.students || 0;
      const capacity = c.capacity || 0;
      const vacancy = Math.max(0, capacity - enrolled);
      const occ = capacity > 0 ? `${((enrolled / capacity) * 100).toFixed(0)}%` : "0%";
      const supervisor = c.supervisor
        ? `${c.supervisor.name} ${c.supervisor.surname}${c.supervisor.phone ? ` (${c.supervisor.phone})` : ""}`
        : "—";

      return [
        String(index + 1),
        `Class ${c.name}`,
        supervisor,
        String(capacity),
        String(enrolled),
        String(vacancy),
        occ,
        String(c._count?.subjects || 0),
      ];
    });

    autoTable(doc, {
      startY: 54,
      head: [
        [
          "#",
          "Class Name",
          "Supervisor / Teacher In-Charge",
          "Capacity",
          "Enrolled Students",
          "Available Seats",
          "Occupancy",
          "Subjects",
        ],
      ],
      body: tableData,
      foot: [
        [
          "",
          "Grand Totals",
          `${classes.length} Classes`,
          String(totalCapacity),
          `${totalStudents} Students`,
          `${totalVacancies} Seats`,
          `${overallOccupancy}%`,
          String(totalSubjects),
        ],
      ],
      theme: "grid",
      headStyles: {
        fillColor: [30, 64, 175],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "center",
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: "bold",
        fontSize: 8.5,
        halign: "center",
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
        halign: "center",
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 10 },
        1: { halign: "left", fontStyle: "bold", cellWidth: 26 },
        2: { halign: "left" },
        3: { halign: "center", cellWidth: 18 },
        4: { halign: "center", cellWidth: 26, fontStyle: "bold" },
        5: { halign: "center", cellWidth: 24 },
        6: { halign: "center", cellWidth: 20 },
        7: { halign: "center", cellWidth: 18 },
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      didDrawPage: (data) => {
        const pageCount = (doc as any).internal.getNumberOfPages();
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(
          `Progga Preparatory and High School Management System • Page ${data.pageNumber} of ${pageCount}`,
          105,
          290,
          { align: "center" }
        );
      },
    });

    return doc;
  };

  const handleDownloadSummaryPdf = () => {
    setIsGenerating(true);
    setLastAction("summary");
    try {
      const doc = buildSummaryDoc();

      // Signatures
      let signY = (doc as any).lastAutoTable?.finalY + 28;
      if (signY > 255) {
        doc.addPage();
        signY = 40;
      }

      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.4);

      doc.line(20, signY, 65, signY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      doc.text("Prepared By", 42.5, signY + 5, { align: "center" });

      doc.line(85, signY, 130, signY);
      doc.text("Academic In-Charge", 107.5, signY + 5, { align: "center" });

      doc.line(150, signY, 195, signY);
      doc.text("Principal / Headmaster", 172.5, signY + 5, { align: "center" });

      doc.save(`Progga_Preparatory_High_School_Classes_Summary_${fileDate}.pdf`);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadDetailedPdf = () => {
    setIsGenerating(true);
    setLastAction("detailed");
    try {
      const doc = buildSummaryDoc();

      // Detailed student roster for each class
      classes.forEach((cls) => {
        doc.addPage();

        // Class Header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(30, 64, 175);
        doc.text(`Class ${cls.name} — Student Roster`, 14, 16);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(100, 116, 139);
        const supervisor = cls.supervisor
          ? `${cls.supervisor.name} ${cls.supervisor.surname}${cls.supervisor.phone ? ` (${cls.supervisor.phone})` : ""}`
          : "None assigned";
        doc.text(
          `Supervisor: ${supervisor} | Enrolled: ${cls._count?.students || 0} / ${cls.capacity} | Available Seats: ${Math.max(0, cls.capacity - (cls._count?.students || 0))}`,
          14,
          22
        );

        const students = cls.students || [];

        if (students.length === 0) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(9);
          doc.setTextColor(148, 163, 184);
          doc.text("No students currently enrolled in this class.", 14, 32);
        } else {
          const studentRows = students.map((s, sIdx) => [
            s.rollNo != null ? String(s.rollNo).padStart(2, "0") : String(sIdx + 1).padStart(2, "0"),
            String(s.studentId),
            `${s.name} ${s.surname}`,
            s.sex || "—",
            s.phone || "—",
          ]);

          autoTable(doc, {
            startY: 26,
            head: [["Roll", "Student ID", "Student Name", "Gender", "Contact Phone"]],
            body: studentRows,
            theme: "striped",
            headStyles: {
              fillColor: [51, 65, 85], // Slate-700
              textColor: [255, 255, 255],
              fontStyle: "bold",
              fontSize: 8.5,
              halign: "center",
            },
            bodyStyles: {
              fontSize: 8,
              textColor: [51, 65, 85],
              halign: "center",
            },
            columnStyles: {
              0: { halign: "center", cellWidth: 16, fontStyle: "bold" },
              1: { halign: "center", cellWidth: 28 },
              2: { halign: "left" },
              3: { halign: "center", cellWidth: 24 },
              4: { halign: "center", cellWidth: 32 },
            },
            didDrawPage: (data) => {
              const pageCount = (doc as any).internal.getNumberOfPages();
              doc.setFontSize(7.5);
              doc.setTextColor(148, 163, 184);
              doc.text(
                `Class ${cls.name} Roster • Progga Preparatory and High School • Page ${data.pageNumber} of ${pageCount}`,
                105,
                290,
                { align: "center" }
              );
            },
          });
        }
      });

      doc.save(`Progga_Preparatory_High_School_Classes_Detailed_Rosters_${fileDate}.pdf`);
    } catch (err) {
      console.error("Failed to generate detailed PDF:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBrowserPrint = () => {
    setIsOpen(false);
    // Give state a moment to settle, then open browser print
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl shadow-sm transition-all"
        title="Generate PDF report of all classes and student numbers"
      >
        <FileDown className="w-4 h-4" />
        <span>Generate PDF</span>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Generate Classes PDF</h3>
                  <p className="text-xs text-slate-500">
                    Export classes information, capacities, and student numbers
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Metrics Badge Banner */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Classes</span>
                <span className="font-bold text-slate-800 text-sm">{totalClasses}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-blue-200">
                <span className="block text-[10px] text-blue-600 font-semibold uppercase">Students</span>
                <span className="font-bold text-blue-700 text-sm">{totalStudents}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Capacity</span>
                <span className="font-bold text-slate-800 text-sm">{totalCapacity}</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-200">
                <span className="block text-[10px] text-emerald-600 font-semibold uppercase">Occupancy</span>
                <span className="font-bold text-emerald-700 text-sm">{overallOccupancy}%</span>
              </div>
            </div>

            {/* Options */}
            <div className="p-5 flex flex-col gap-3">
              {/* Option 1: Summary PDF */}
              <button
                onClick={handleDownloadSummaryPdf}
                disabled={isGenerating}
                className="group relative flex items-start gap-4 p-4 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50 hover:border-blue-300 text-left transition-all disabled:opacity-60"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  {isGenerating && lastAction === "summary" ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <FileText className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-sm">
                      Classes Summary PDF
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Official 1-page summary table with class names, student numbers, supervisor contacts, capacities, available vacancies, and occupancy rates.
                  </p>
                </div>
              </button>

              {/* Option 2: Detailed PDF with Rosters */}
              <button
                onClick={handleDownloadDetailedPdf}
                disabled={isGenerating}
                className="group flex items-start gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-left transition-all disabled:opacity-60"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  {isGenerating && lastAction === "detailed" ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Users className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1">
                  <span className="font-bold text-slate-800 text-sm">
                    Comprehensive Report (With Student Rosters)
                  </span>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Includes the master classes summary plus full student rosters for each class with roll numbers, student IDs, names, and contacts.
                  </p>
                </div>
              </button>

              {/* Option 3: Browser Print / Save to PDF */}
              <button
                onClick={handleBrowserPrint}
                disabled={isGenerating}
                className="group flex items-start gap-4 p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 text-left transition-all"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                  <Printer className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <span className="font-bold text-slate-800 text-sm">
                    Print / Save via Browser
                  </span>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Open the browser&apos;s native print preview with school letterhead formatting to save as PDF or print to paper.
                  </p>
                </div>
              </button>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Ready to export {totalClasses} classes
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
