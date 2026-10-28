"use client";

import { useState, useTransition } from "react";
import { GitMerge, AlertCircle, CheckCircle2, ArrowRight, X, Loader2 } from "lucide-react";
import { mergeClassIntoSection } from "@/lib/actions";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";

export default function MergeClassModal({
  targetClass,
  availableClasses,
}: {
  targetClass: { id: number; name: string };
  availableClasses: {
    id: number;
    name: string;
    capacity: number;
    _count: { students: number; subjects: number };
  }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [sourceClassId, setSourceClassId] = useState<number | "">("");
  const [sectionName, setSectionName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  // Filter out the target class itself
  const otherClasses = availableClasses.filter((c) => c.id !== targetClass.id);

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value ? parseInt(e.target.value) : "";
    setSourceClassId(val);

    if (val !== "") {
      const selected = otherClasses.find((c) => c.id === val);
      if (selected) {
        // If class is named e.g. "1b" or "1-B" or "B", auto-suggest "B"
        const match = selected.name.match(/[a-zA-Z]+/);
        if (match) {
          setSectionName(match[0].toUpperCase());
        } else {
          setSectionName("B");
        }
      }
    }
  };

  const handleMerge = () => {
    if (sourceClassId === "") {
      setErrorMsg("Please select a source class to merge.");
      return;
    }
    if (!sectionName.trim()) {
      setErrorMsg("Please enter a section name for the merged students.");
      return;
    }
    if (!confirmed) {
      setErrorMsg("Please confirm that you want to merge these classes.");
      return;
    }

    setErrorMsg(null);
    startTransition(async () => {
      const result = await mergeClassIntoSection(
        { success: false, error: false },
        {
          sourceClassId: Number(sourceClassId),
          targetClassId: targetClass.id,
          sectionName: sectionName.trim(),
        }
      );

      if (result.success) {
        toast.success(result.message || "Classes merged successfully!");
        setIsOpen(false);
        router.refresh();
      } else {
        setErrorMsg(result.message || "Failed to merge classes.");
      }
    });
  };

  if (otherClasses.length === 0) {
    return null; // No other classes to merge
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors shadow-sm"
        title="Merge legacy classes (e.g. 1a, 1b) into this class as a section"
      >
        <GitMerge className="w-3.5 h-3.5 text-amber-700" />
        <span>Merge Legacy Class into Section</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-amber-50/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                  <GitMerge className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">
                    Merge Legacy Class into Section
                  </h3>
                  <p className="text-xs text-slate-500">
                    Consolidate classes without losing any student records or history
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

            {/* Explanation Alert */}
            <div className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 flex items-start gap-2.5 leading-relaxed">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  If you have legacy classes like <strong>1a</strong>, <strong>1b</strong>, or <strong>2b</strong>, this tool merges the source class into <strong>Class {targetClass.name}</strong> as a dedicated section.
                  <ul className="list-disc list-inside mt-1.5 space-y-0.5 text-blue-800">
                    <li>All students are moved into the new section</li>
                    <li>Attendance, fees, exam results, and routines are safely re-linked</li>
                    <li><strong>No data is deleted or lost</strong></li>
                  </ul>
                </div>
              </div>

              {/* Source Class Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Select Source Legacy Class to Merge:
                </label>
                <select
                  value={sourceClassId}
                  onChange={handleSourceChange}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="">-- Choose Class to Merge --</option>
                  {otherClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      Class {cls.name} ({cls._count.students} students, {cls._count.subjects} subjects)
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Target Section Name in Class {targetClass.name}:
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-2.5 rounded-xl border border-slate-200">
                    Class {targetClass.name}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={sectionName}
                    onChange={(e) => setSectionName(e.target.value)}
                    placeholder="e.g. B, Padma, Rose"
                    className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              {/* Confirmation Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                />
                <span>
                  I understand that all students and academic history from the selected class will be safely transferred into <strong>Class {targetClass.name} (Section {sectionName || "?"})</strong>.
                </span>
              </label>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {errorMsg}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 p-4 border-t border-slate-100 bg-slate-50">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isPending}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMerge}
                disabled={isPending || !sourceClassId || !sectionName || !confirmed}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-sm transition-all"
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Merging Safely...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm &amp; Merge</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
