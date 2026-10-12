"use client";

import { createExpense } from "@/lib/feeActions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";

export default function ExpenseForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    amount: "",
    category: "Utility",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.amount) {
      toast.error("Please fill in title and amount");
      return;
    }

    setLoading(true);
    try {
      const res = await createExpense(null, {
        title: formData.title,
        amount: parseFloat(formData.amount),
        category: formData.category,
      });

      if (res.success) {
        toast.success(`Expense "${formData.title}" logged successfully!`);
        setFormData({ title: "", amount: "", category: "Utility" });
        router.refresh();
      } else {
        toast.error("Failed to log expense.");
      }
    } catch (err) {
      console.error(err);
      toast.error("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4"
    >
      <div>
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
          Log Operational Expense
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Record utility bills, campus maintenance, supplies, or facility repairs.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
          Expense Title / Description
        </label>
        <input
          type="text"
          placeholder="e.g., Electricity Bill (May 2026)"
          className="ring-1 ring-slate-200 p-2.5 rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-slate-400 bg-white"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Amount (৳)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
              ৳
            </span>
            <input
              type="number"
              min="0"
              placeholder="5000"
              className="pl-7 ring-1 ring-slate-200 p-2.5 rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-blue-600 transition-all placeholder:text-slate-400 bg-white"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            Category
          </label>
          <select
            className="ring-1 ring-slate-200 p-2.5 rounded-xl text-xs w-full outline-none focus:ring-2 focus:ring-blue-600 transition-all bg-white text-slate-700 cursor-pointer"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
          >
            <option value="Utility">Utilities & Bills</option>
            <option value="Maintenance">Maintenance & Repairs</option>
            <option value="Supplies">Supplies & Stationery</option>
            <option value="Events">School Events</option>
            <option value="Other">Other Expenses</option>
          </select>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-xl transition-colors text-xs shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 mt-1"
      >
        {loading ? "Logging..." : "+ Record Expense Entry"}
      </button>
    </form>
  );
}
