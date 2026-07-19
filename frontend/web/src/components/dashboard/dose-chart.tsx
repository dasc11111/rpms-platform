"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const DATA = [
  { month: "Ago 25", radiotherapy: 1.2, nuclearMedicine: 2.1, imaging: 0.8, interventional: 1.5 },
  { month: "Sep 25", radiotherapy: 1.4, nuclearMedicine: 2.3, imaging: 0.9, interventional: 1.6 },
  { month: "Jun 26", radiotherapy: 1.5, nuclearMedicine: 2.6, imaging: 0.9, interventional: 1.8 },
  { month: "Jul 26", radiotherapy: 1.2, nuclearMedicine: 2.3, imaging: 0.8, interventional: 1.5 },
];

export function DoseChart() {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={DATA}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v} mSv`} />
          <Tooltip />
          <Bar dataKey="radiotherapy" fill="hsl(217 91% 60%)" stackId="d" />
          <Bar dataKey="nuclearMedicine" fill="hsl(158 76% 46%)" stackId="d" />
          <Bar dataKey="imaging" fill="hsl(38 92% 60%)" stackId="d" />
          <Bar dataKey="interventional" fill="hsl(280 65% 60%)" stackId="d" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
