'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRightLeft, Plus, Minus, Copy, ExternalLink } from 'lucide-react';

type CounterSuggestion = {
  description: string;
  giveAdd: string[];
  getRemove: string[];
  estimatedDelta: string;
};

interface CounterSuggestionCardProps {
  suggestion: CounterSuggestion;
  leagueId: string;
  originalGive: any[];
  originalGet: any[];
}

export default function CounterSuggestionCard({
  suggestion,
  leagueId,
  originalGive,
  originalGet,
}: CounterSuggestionCardProps) {
  const [copied, setCopied] = useState(false);

  const copySummary = () => {
    const newGive = [...originalGive.map(p => p.name), ...suggestion.giveAdd].join(', ');
    const newGet = originalGet
      .filter(p => !suggestion.getRemove.includes(p.name))
      .map(p => p.name)
      .join(', ');

    const text =
      `AllFantasy Counter Proposal:\n\n` +
      `Original: Give ${originalGive.map(p => p.name).join(', ')} → Get ${originalGet.map(p => p.name).join(', ')}\n\n` +
      `Counter: ${suggestion.description}\n` +
      `New Give: ${newGive}\n` +
      `New Get: ${newGet}\n\n` +
      `Est. delta: ${suggestion.estimatedDelta}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openInSleeper = () => {
    window.open(`https://sleeper.app/leagues/${leagueId}`, '_blank');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
    >
      <Card className="bg-[#1a1238]/80 border-cyan-900/40 backdrop-blur-sm hover:border-cyan-500/50 transition-colors h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-cyan-300 flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Counter Suggestion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-200 text-sm leading-relaxed">
            {suggestion.description}
          </p>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-red-400 font-medium flex items-center gap-1 mb-1">
                <Plus className="h-4 w-4" /> Add to Give
              </div>
              {suggestion.giveAdd.length > 0 ? (
                <ul className="list-disc pl-5 text-gray-300">
                  {suggestion.giveAdd.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-gray-500 italic">None</span>
              )}
            </div>

            <div>
              <div className="text-emerald-400 font-medium flex items-center gap-1 mb-1">
                <Minus className="h-4 w-4" /> Remove from Get
              </div>
              {suggestion.getRemove.length > 0 ? (
                <ul className="list-disc pl-5 text-gray-300">
                  {suggestion.getRemove.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-gray-500 italic">None</span>
              )}
            </div>
          </div>

          <div className="inline-block px-3 py-1 bg-purple-900/40 text-purple-300 rounded-full text-xs font-medium">
            Est. new delta: {suggestion.estimatedDelta}
          </div>
        </CardContent>

        <CardFooter className="flex gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 border-cyan-600 text-cyan-300 hover:bg-cyan-950/50 hover:text-cyan-200"
            onClick={openInSleeper}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Open in Sleeper
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            onClick={copySummary}
          >
            <Copy className="mr-2 h-4 w-4" />
            {copied ? 'Copied!' : 'Copy Summary'}
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
