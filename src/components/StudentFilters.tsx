"use client";

import { useRouter, useSearchParams } from "next/navigation";

type ClassOption = { id: number; name: string };

export default function StudentFilters({ classes }: { classes: ClassOption[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = new URLSearchParams(params.toString());
    if (e.target.value) {
      next.set("classId", e.target.value);
    } else {
      next.delete("classId");
    }
    next.delete("page");
    router.push(`${window.location.pathname}?${next}`);
  };

  return (
    <select
      onChange={handleClassChange}
      defaultValue={params.get("classId") ?? ""}
      className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-600 cursor-pointer"
    >
      <option value="">All Classes</option>
      {classes.map((cls) => (
        <option key={cls.id} value={cls.id}>
          {cls.name.toLowerCase().startsWith("class") ? cls.name : `Class ${cls.name}`}
        </option>
      ))}
    </select>
  );
}
