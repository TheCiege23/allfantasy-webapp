'use client';
import { Card, CardContent } from '@/components/ui/card';
import { format } from 'date-fns';

export default function TradeHistoryFeed({ trades }: { trades: any[] }) {
  return (
    <div className="grid gap-6">
      {trades.map(trade => (
        <Card key={trade.id} className="border-purple-900/30 bg-black/40 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="flex justify-between text-sm text-gray-400 mb-3">
              <span>{format(new Date(trade.createdAt), 'MMM d, yyyy')}</span>
              <a href={`/trade/${trade.id}`} className="text-cyan-400 hover:underline">View Analysis →</a>
            </div>
            <div className="flex gap-8">
              <div className="flex-1">
                <p className="font-medium">Team A received</p>
                <p className="text-sm text-gray-300">{trade.sideA}</p>
              </div>
              <div className="flex-1">
                <p className="font-medium">Team B received</p>
                <p className="text-sm text-gray-300">{trade.sideB}</p>
              </div>
            </div>
            <p className="mt-4 text-xs text-green-400">Winner: {trade.analysis.winner}</p>
          </CardContent>
        </Card>
      ))}
      {trades.length === 0 && <p className="text-center text-gray-500 py-12">No trades yet. Make one in the analyzer!</p>}
    </div>
  );
}
