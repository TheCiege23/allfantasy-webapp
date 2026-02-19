'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAI } from '@/hooks/useAI';
import { toast } from 'sonner';

type Suggestion = {
  playerName: string;
  position: string;
  team: string;
  reason: string;
  priority: number;
};

export default function WaiverAISuggestions() {
  const { callAI, loading } = useAI<{ suggestions: Suggestion[] }>();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [leagueId, setLeagueId] = useState('');

  const generateSuggestions = async () => {
    if (!leagueId) return toast.error('Select a league first');

    const { data, error } = await callAI(
      '/api/waiver-ai-suggest',
      { leagueId },
      { successMessage: 'Waiver suggestions generated!' }
    );

    if (data?.suggestions) {
      setSuggestions(data.suggestions);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Your League ID"
          value={leagueId}
          onChange={(e) => setLeagueId(e.target.value)}
          className="flex-1 bg-gray-950 border border-cyan-800 rounded px-4 py-2 text-white placeholder:text-gray-500 focus:outline-none focus:border-cyan-500"
        />
        <Button onClick={generateSuggestions} disabled={loading} className="bg-gradient-to-r from-cyan-500 to-purple-600 hover:from-cyan-600 hover:to-purple-700">
          {loading ? 'Analyzing...' : 'Get AI Waiver Suggestions'}
        </Button>
      </div>

      {suggestions.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((s, i) => (
            <Card key={i} className="border-purple-900/40 bg-black/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl">
                  {s.playerName} ({s.position} - {s.team})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300 mb-4">{s.reason}</p>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Priority:</span>
                  <span className="font-bold text-cyan-400">{s.priority}/10</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center text-gray-500 py-12">
          Click the button to get personalized waiver wire targets based on your roster, league scoring, and recent trends.
        </div>
      )}
    </div>
  );
}
