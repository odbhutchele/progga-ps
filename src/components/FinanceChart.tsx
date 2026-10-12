"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface FinanceChartProps {
  data?: {
    name: string;
    income: number;
    expense: number;
  }[];
}

const defaultData = [
  { name: "Jan", income: 0, expense: 0 },
  { name: "Feb", income: 0, expense: 0 },
  { name: "Mar", income: 0, expense: 0 },
  { name: "Apr", income: 0, expense: 0 },
  { name: "May", income: 0, expense: 0 },
  { name: "Jun", income: 0, expense: 0 },
  { name: "Jul", income: 0, expense: 0 },
  { name: "Aug", income: 0, expense: 0 },
  { name: "Sep", income: 0, expense: 0 },
  { name: "Oct", income: 0, expense: 0 },
  { name: "Nov", income: 0, expense: 0 },
  { name: "Dec", income: 0, expense: 0 },
];

const FinanceChart = ({ data: dynamicData }: FinanceChartProps) => {
  const chartData = dynamicData && dynamicData.length > 0 ? dynamicData : defaultData;

  return (
    <div className="w-full h-full flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h2 className="text-sm sm:text-base font-extrabold text-slate-800">
            Cashflow Trends
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Monthly comparison of cash inflows vs complete expenditures
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block shadow-sm" />
            <span className="text-slate-700">Cash Inflow</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500 inline-block shadow-sm" />
            <span className="text-slate-700">Cash Outflow</span>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full flex-1 min-h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{
              top: 10,
              right: 15,
              left: 5,
              bottom: 0,
            }}
          >
            <defs>
              <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 12, fontWeight: 500 }}
              tickMargin={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64748b", fontSize: 11, fontWeight: 500 }}
              tickFormatter={(val) =>
                val >= 1000 ? `৳${(val / 1000).toFixed(0)}k` : `৳${val}`
              }
              tickMargin={8}
            />
            <Tooltip
              formatter={(value: any, name: string) => [
                `৳${Number(value || 0).toLocaleString()}`,
                name === "income" ? "Cash Inflow" : "Cash Outflow",
              ]}
              labelFormatter={(label) => `Month: ${label}`}
              contentStyle={{
                backgroundColor: "#ffffff",
                borderRadius: "12px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                fontSize: "12px",
                padding: "8px 12px",
              }}
            />
            <Area
              type="monotone"
              dataKey="income"
              name="income"
              stroke="#10b981"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#incomeGradient)"
              activeDot={{
                r: 6,
                fill: "#10b981",
                stroke: "#ffffff",
                strokeWidth: 2,
              }}
            />
            <Area
              type="monotone"
              dataKey="expense"
              name="expense"
              stroke="#f43f5e"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#expenseGradient)"
              activeDot={{
                r: 6,
                fill: "#f43f5e",
                stroke: "#ffffff",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default FinanceChart;
