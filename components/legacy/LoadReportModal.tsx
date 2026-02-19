'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { History } from 'lucide-react';
import { format } from 'date-fns';

interface LoadReportModalProps {
  reports: any[];
  onLoad: (report: any) => void;
}

export default function LoadReportModal({ reports, onLoad }: LoadReportModalProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-amber-500/50 text-amber-300 hover:bg-amber-950/40">
          <History className="mr-2 h-4 w-4" />
          Load Previous Report
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0f0a24] border-cyan-900/50 max-w-2xl text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl text-amber-300">Previous Strategy Reports</DialogTitle>
        </DialogHeader>
        <div className="mt-6 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {reports.length === 0 ? (
            <p className="text-gray-400 text-center py-8">No saved reports yet. Generate your first one!</p>
          ) : (
            reports.map((r) => (
              <button
                key={r.id}
                onClick={() => onLoad(r)}
                className="w-full text-left p-5 rounded-xl bg-[#1a1238]/70 hover:bg-[#1a1238]/90 border border-cyan-900/40 transition-all group"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-lg text-cyan-200 group-hover:text-cyan-100">
                      {r.title || `Strategy Session - ${format(new Date(r.createdAt), 'MMM d, yyyy')}`}
                    </h4>
                    <p className="text-sm text-gray-400 mt-1">
                      {r.archetype} • Score: {r.score}/100
                    </p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {format(new Date(r.createdAt), 'h:mm a')}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
