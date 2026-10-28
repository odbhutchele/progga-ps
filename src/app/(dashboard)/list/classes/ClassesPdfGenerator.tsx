"use client";

import { useState, useMemo } from "react";
import {
  FileDown,
  Printer,
  FileText,
  Users,
  X,
  Loader2,
  CheckCircle2,
  Filter,
  RotateCcw,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ClassesPrintView, { PrintableClass } from "./ClassesPrintView";

export default function ClassesPdfGenerator({
  classes,
  defaultClassId,
}: {
  classes: PrintableClass[];
  defaultClassId?: number | "all";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | "all">(
    defaultClassId ?? "all"
  );

  // Filter target classes based on selection
  const targetClasses = useMemo(() => {
    if (selectedClassId === "all") return classes;
    const found = classes.filter((c) => c.id === selectedClassId);
    return found.length > 0 ? found : classes;
  }, [classes, selectedClassId]);

  const isSingle = targetClasses.length === 1 && selectedClassId !== "all";
  const singleClass = isSingle ? targetClasses[0] : null;

  // Compute metrics for the current selection
  const totalClassesCount = targetClasses.length;
  const totalStudentsCount = targetClasses.reduce(
    (sum, c) => sum + (c._count?.students || 0),
    0
  );
  const totalCapacityCount = targetClasses.reduce(
    (sum, c) => sum + (c.capacity || 0),
    0
  );
  const totalVacanciesCount = Math.max(0, totalCapacityCount - totalStudentsCount);
  const overallOccupancyPercent =
    totalCapacityCount > 0
      ? ((totalStudentsCount / totalCapacityCount) * 100).toFixed(1)
      : "0";

  // Global counts for selector labels
  const allStudentsCount = classes.reduce(
    (sum, c) => sum + (c._count?.students || 0),
    0
  );

  const now = new Date();
  const dateFormatted = now.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const fileDate = now.toISOString().split("T")[0];

  const sanitizeName = (str: string) =>
    str.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_+/g, "_");

  // Build Master Summary PDF (All Classes)
  const buildAllClassesSummaryDoc = () => {
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
    doc.text("MASTER CLASSES & STUDENT ENROLLMENT REPORT", 105, 20, {
      align: "center",
    });

    doc.setFontSize(8);
    doc.setTextColor(...slateMuted);
    doc.text(
      `Academic Year: ${now.getFullYear()} | Generated on: ${dateFormatted} at ${now.toLocaleTimeString(
        [],
        { hour: "2-digit", minute: "2-digit" }
      )}`,
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
      { label: "TOTAL CLASSES", val: String(totalClassesCount) },
      { label: "ENROLLED STUDENTS", val: String(totalStudentsCount) },
      { label: "TOTAL CAPACITY", val: String(totalCapacityCount) },
      { label: "AVAILABLE SEATS", val: String(totalVacanciesCount) },
      { label: "OCCUPANCY RATE", val: `${overallOccupancyPercent}%` },
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
    const totalSections = targetClasses.reduce(
      (sum, c) => sum + (c.sections?.length || c._count?.sections || 0),
      0
    );
    const totalSubjects = targetClasses.reduce(
      (sum, c) => sum + (c._count?.subjects || 0),
      0
    );

    const tableData = targetClasses.map((c, index) => {
      const enrolled = c._count?.students || 0;
      const capacity = c.capacity || 0;
      const vacancy = Math.max(0, capacity - enrolled);
      const occ =
        capacity > 0 ? `${((enrolled / capacity) * 100).toFixed(0)}%` : "0%";
      const supervisor = c.supervisor
        ? `${c.supervisor.name} ${c.supervisor.surname}${
            c.supervisor.phone ? ` (${c.supervisor.phone})` : ""
          }`
        : "—";
      const sectionsStr =
        c.sections && c.sections.length > 0
          ? c.sections.map((s) => s.name).join(", ")
          : "—";

      return [
        String(index + 1),
        `Class ${c.name}`,
        supervisor,
        sectionsStr,
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
          "Sections",
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
          `${targetClasses.length} Classes`,
          `${totalSections} Sec`,
          String(totalCapacityCount),
          `${totalStudentsCount} Students`,
          `${totalVacanciesCount} Seats`,
          `${overallOccupancyPercent}%`,
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
        0: { halign: "center", cellWidth: 8 },
        1: { halign: "left", fontStyle: "bold", cellWidth: 22 },
        2: { halign: "left" },
        3: { halign: "center", cellWidth: 20 },
        4: { halign: "center", cellWidth: 16 },
        5: { halign: "center", cellWidth: 24, fontStyle: "bold" },
        6: { halign: "center", cellWidth: 22 },
        7: { halign: "center", cellWidth: 18 },
        8: { halign: "center", cellWidth: 16 },
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

  // Build Single Class Document (Summary or Detailed with Student Roster)
  const buildSingleClassDoc = (cls: PrintableClass, includeRoster: boolean) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const primaryColor: [number, number, number] = [30, 64, 175]; // Blue-800
    const slateDark: [number, number, number] = [15, 23, 42]; // Slate-900
    const slateMuted: [number, number, number] = [100, 116, 139]; // Slate-500

    const enrolled = cls._count?.students || 0;
    const capacity = cls.capacity || 0;
    const vacancy = Math.max(0, capacity - enrolled);
    const occ =
      capacity > 0 ? ((enrolled / capacity) * 100).toFixed(1) : "0";

    const supervisorText = cls.supervisor
      ? `${cls.supervisor.name} ${cls.supervisor.surname}${
          cls.supervisor.phone ? ` (${cls.supervisor.phone})` : ""
        }`
      : "Not Assigned";

    // Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14.5);
    doc.setTextColor(...primaryColor);
    doc.text("PROGGA PREPARATORY AND HIGH SCHOOL", 105, 14, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...slateDark);
    doc.text(
      `OFFICIAL CLASS ${cls.name.toUpperCase()} ${
        includeRoster ? "STUDENT ROSTER & ENROLLMENT REPORT" : "ACADEMIC ENROLLMENT REPORT"
      }`,
      105,
      20,
      { align: "center" }
    );

    doc.setFontSize(8);
    doc.setTextColor(...slateMuted);
    doc.text(
      `Academic Year: ${now.getFullYear()} | Supervisor: ${supervisorText} | Generated: ${dateFormatted}`,
      105,
      25,
      { align: "center" }
    );

    // Decorative line
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 28, 196, 28);

    // KPI Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 32, 182, 18, 2, 2, "F");
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(14, 32, 182, 18, 2, 2, "D");

    const singleMetrics = [
      { label: "TARGET CLASS", val: `Class ${cls.name}` },
      { label: "ENROLLED STUDENTS", val: String(enrolled) },
      { label: "TOTAL CAPACITY", val: String(capacity) },
      { label: "AVAILABLE SEATS", val: String(vacancy) },
      { label: "OCCUPANCY RATE", val: `${occ}%` },
    ];

    const colWidth = 182 / singleMetrics.length;
    singleMetrics.forEach((m, idx) => {
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

    const sectionsStr =
      cls.sections && cls.sections.length > 0
        ? cls.sections.map((s) => s.name).join(", ")
        : "—";

    // Overview Table
    autoTable(doc, {
      startY: 54,
      head: [
        [
          "Class",
          "Supervisor / Teacher In-Charge",
          "Sections",
          "Capacity",
          "Enrolled Students",
          "Available Seats",
          "Occupancy",
          "Subjects",
        ],
      ],
      body: [
        [
          `Class ${cls.name}`,
          supervisorText,
          sectionsStr,
          String(capacity),
          String(enrolled),
          String(vacancy),
          `${occ}%`,
          String(cls._count?.subjects || 0),
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
      bodyStyles: {
        fontSize: 8,
        textColor: [51, 65, 85],
        halign: "center",
      },
      columnStyles: {
        0: { halign: "left", fontStyle: "bold", cellWidth: 22 },
        1: { halign: "left" },
        2: { halign: "center", cellWidth: 22 },
        3: { halign: "center", cellWidth: 18 },
        4: { halign: "center", cellWidth: 24, fontStyle: "bold" },
        5: { halign: "center", cellWidth: 22 },
        6: { halign: "center", cellWidth: 20 },
        7: { halign: "center", cellWidth: 16 },
      },
    });

    const currentY = (doc as any).lastAutoTable?.finalY + 8;

    // Student Roster (if requested or summary with students)
    if (includeRoster) {
      const students = cls.students || [];

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...slateDark);
      doc.text(
        `Class ${cls.name} — Complete Student Roster (${students.length} Students)`,
        14,
        currentY
      );

      if (students.length === 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(9);
        doc.setTextColor(...slateMuted);
        doc.text("No students currently enrolled in this class.", 14, currentY + 7);
      } else {
        const studentRows = students.map((s, sIdx) => [
          s.rollNo != null
            ? String(s.rollNo).padStart(2, "0")
            : String(sIdx + 1).padStart(2, "0"),
          String(s.studentId),
          `${s.name} ${s.surname}`,
          s.section ? `Sec ${s.section}` : "—",
          s.sex || "—",
          s.phone || "—",
        ]);

        autoTable(doc, {
          startY: currentY + 3,
          head: [["Roll", "Student ID", "Student Name", "Section", "Gender", "Contact Phone"]],
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
            0: { halign: "center", cellWidth: 14, fontStyle: "bold" },
            1: { halign: "center", cellWidth: 26 },
            2: { halign: "left" },
            3: { halign: "center", cellWidth: 20 },
            4: { halign: "center", cellWidth: 20 },
            5: { halign: "center", cellWidth: 30 },
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
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
    }

    return doc;
  };

  // Helper to append official signatures
  const appendSignatures = (doc: jsPDF) => {
    let signY = (doc as any).lastAutoTable?.finalY + 26;
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
  };

  // Handler: Summary PDF
  const handleDownloadSummaryPdf = () => {
    setIsGenerating(true);
    setLastAction("summary");
    try {
      if (isSingle && singleClass) {
        const doc = buildSingleClassDoc(singleClass, false);
        appendSignatures(doc);
        doc.save(
          `Progga_Preparatory_Class_${sanitizeName(singleClass.name)}_Summary_${fileDate}.pdf`
        );
      } else {
        const doc = buildAllClassesSummaryDoc();
        appendSignatures(doc);
        doc.save(
          `Progga_Preparatory_High_School_Classes_Summary_${fileDate}.pdf`
        );
      }
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handler: Detailed PDF (with rosters)
  const handleDownloadDetailedPdf = () => {
    setIsGenerating(true);
    setLastAction("detailed");
    try {
      if (isSingle && singleClass) {
        const doc = buildSingleClassDoc(singleClass, true);
        appendSignatures(doc);
        doc.save(
          `Progga_Preparatory_Class_${sanitizeName(singleClass.name)}_Roster_${fileDate}.pdf`
        );
      } else {
        const doc = buildAllClassesSummaryDoc();

        // Detailed student roster for each class
        targetClasses.forEach((cls) => {
          doc.addPage();

          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          doc.setTextColor(30, 64, 175);
          doc.text(`Class ${cls.name} — Student Roster`, 14, 16);

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8.5);
          doc.setTextColor(100, 116, 139);
          const supervisor = cls.supervisor
            ? `${cls.supervisor.name} ${cls.supervisor.surname}${
                cls.supervisor.phone ? ` (${cls.supervisor.phone})` : ""
              }`
            : "None assigned";
          doc.text(
            `Supervisor: ${supervisor} | Enrolled: ${
              cls._count?.students || 0
            } / ${cls.capacity} | Available Seats: ${Math.max(
              0,
              cls.capacity - (cls._count?.students || 0)
            )}`,
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
              s.rollNo != null
                ? String(s.rollNo).padStart(2, "0")
                : String(sIdx + 1).padStart(2, "0"),
              String(s.studentId),
              `${s.name} ${s.surname}`,
              s.section ? `Sec ${s.section}` : "—",
              s.sex || "—",
              s.phone || "—",
            ]);

            autoTable(doc, {
              startY: 26,
              head: [
                ["Roll", "Student ID", "Student Name", "Section", "Gender", "Contact Phone"],
              ],
              body: studentRows,
              theme: "striped",
              headStyles: {
                fillColor: [51, 65, 85],
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
                0: { halign: "center", cellWidth: 14, fontStyle: "bold" },
                1: { halign: "center", cellWidth: 26 },
                2: { halign: "left" },
                3: { halign: "center", cellWidth: 18 },
                4: { halign: "center", cellWidth: 20 },
                5: { halign: "center", cellWidth: 28 },
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

        doc.save(
          `Progga_Preparatory_High_School_Classes_Detailed_Rosters_${fileDate}.pdf`
        );
      }
    } catch (err) {
      console.error("Failed to generate detailed PDF:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handler: Native Browser Print
  const handleBrowserPrint = () => {
    setIsOpen(false);
    setTimeout(() => {
      window.print();
    }, 180);
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold px-3.5 py-2.5 rounded-xl shadow-sm transition-all"
        title="Generate PDF report or print class information"
      >
        <FileDown className="w-4 h-4" />
        <span>Generate PDF</span>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    {isSingle
                      ? `Export Class ${singleClass?.name} PDF`
                      : "Generate Classes PDF"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isSingle
                      ? `Class ${singleClass?.name} enrollment, sections & student roster`
                      : "Export classes information, capacities, and student numbers"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Class Selection Dropdown */}
            <div className="p-4 bg-slate-50/50 border-b border-slate-100">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-blue-600" />
                  <span>Select Class to Print:</span>
                </label>
                {selectedClassId !== "all" && (
                  <button
                    onClick={() => setSelectedClassId("all")}
                    className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 hover:underline"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset to All Classes
                  </button>
                )}
              </div>
              <select
                value={selectedClassId}
                onChange={(e) =>
                  setSelectedClassId(
                    e.target.value === "all" ? "all" : Number(e.target.value)
                  )
                }
                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all cursor-pointer shadow-sm"
              >
                <option value="all">
                  ⭐ All Classes ({classes.length} Classes • {allStudentsCount} Students)
                </option>
                <optgroup label="Individual Classes">
                  {classes.map((cls) => {
                    const studentCount = cls._count?.students || 0;
                    const sectionCount = cls.sections?.length || cls._count?.sections || 0;
                    return (
                      <option key={cls.id} value={cls.id}>
                        Class {cls.name} — {studentCount} Students
                        {sectionCount > 0 ? ` (${sectionCount} Sections)` : ""}
                      </option>
                    );
                  })}
                </optgroup>
              </select>
            </div>

            {/* Quick Metrics Badge Banner */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">
                  {isSingle ? "Target" : "Classes"}
                </span>
                <span className="font-bold text-slate-800 text-sm truncate block">
                  {isSingle ? `Class ${singleClass?.name}` : totalClassesCount}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-blue-200">
                <span className="block text-[10px] text-blue-600 font-semibold uppercase">
                  Students
                </span>
                <span className="font-bold text-blue-700 text-sm">
                  {totalStudentsCount}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200">
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">
                  Capacity
                </span>
                <span className="font-bold text-slate-800 text-sm">
                  {totalCapacityCount}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-200">
                <span className="block text-[10px] text-emerald-600 font-semibold uppercase">
                  Occupancy
                </span>
                <span className="font-bold text-emerald-700 text-sm">
                  {overallOccupancyPercent}%
                </span>
              </div>
            </div>

            {/* Options List */}
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
                      {isSingle
                        ? `Class ${singleClass?.name} Summary PDF`
                        : "Classes Summary PDF"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {isSingle
                      ? `Official 1-page administrative summary for Class ${singleClass?.name} with supervisor contact, section distribution, capacity, and seat occupancy.`
                      : "Official 1-page summary table with class names, student numbers, supervisor contacts, capacities, available vacancies, and occupancy rates."}
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
                    {isSingle
                      ? `Class ${singleClass?.name} Student Roster PDF`
                      : "Comprehensive Report (With Student Rosters)"}
                  </span>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {isSingle
                      ? `Complete student roster of Class ${singleClass?.name} (${
                          singleClass?.students?.length || singleClass?._count?.students || 0
                        } students) with roll numbers, student IDs, section allocation, and guardian phones.`
                      : "Includes the master classes summary plus full student rosters for each class with roll numbers, student IDs, names, and contacts."}
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
                    {isSingle
                      ? `Print / Save Class ${singleClass?.name} via Browser`
                      : "Print / Save via Browser"}
                  </span>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Open browser&apos;s native print preview with official letterhead formatting to save as PDF or print to paper.
                  </p>
                </div>
              </button>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {isSingle
                  ? `Ready to export Class ${singleClass?.name}`
                  : `Ready to export all ${classes.length} classes`}
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

      {/* Hidden Official Printable View rendered dynamically based on selected class(es) */}
      <ClassesPrintView classes={targetClasses} />
    </>
  );
}
