'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type BalanceData = {
  category: string;
  Give: number;
  Get: number;
};

export default function TradeBalanceViz({ visualData }: { visualData: any }) {
  if (!visualData) return null;

  const data: BalanceData[] = [
    { category: 'Value', Give: visualData.giveValue, Get: visualData.getValue },
    { category: 'Avg Age', Give: visualData.giveAge, Get: visualData.getAge },
    { category: 'Pos Fit', Give: visualData.givePositionalFit, Get: visualData.getPositionalFit },
  ];

  return (
    <div className="h-64 w-full mt-6">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <XAxis dataKey="category" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{ background: '#1a1238', border: '1px solid #00f5d4', color: 'white' }}
          />
          <Legend />
          <Bar dataKey="Give" fill="#ef4444" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Get" fill="#22c55e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
