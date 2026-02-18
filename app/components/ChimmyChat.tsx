'use client';

import { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

type ToolOutput = {
  tool: string;
  output: any;
  timestamp: Date;
};

export default function ChimmyChat() {
  const [messages, setMessages] = useState<any[]>([
    { role: 'assistant', content: "Hi! I'm Chimmy \u{1F496} Your personal fantasy AI assistant. What can I help you with today?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [toolHistory, setToolHistory] = useState<ToolOutput[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (window as any).addToolOutput = (tool: string, output: any) => {
      setToolHistory(prev => [...prev, { tool, output, timestamp: new Date() }]);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      let response = "I'm not sure I understand. Can you tell me more? \u{1F495}";

      const lastTool = toolHistory[toolHistory.length - 1];

      if (currentInput.toLowerCase().includes('trade') && lastTool?.tool === 'Trade Analyzer') {
        response = `Oh! About that trade you analyzed earlier... ${lastTool.output.verdict || ''}. The AI suggested it was ${lastTool.output.lean || 'even'}. Do you want me to explain why or suggest a better counter?`;
      } else if (currentInput.toLowerCase().includes('waiver') && lastTool?.tool === 'Waiver AI') {
        response = `Looking at the waiver suggestions I gave you... The top pick was ${lastTool.output.suggestions?.[0]?.playerName || 'that player'}. Their projected points were solid. Want me to compare FAAB bids or check injury news?`;
      } else if (currentInput.toLowerCase().includes('roster') || currentInput.toLowerCase().includes('legacy')) {
        response = "Your legacy score is currently 66/100 \u2014 that's Captain tier! Your strongest lane is Dynasty at 55.4%. Would you like me to break down your age curve or future picks in more detail?";
      } else if (currentInput.toLowerCase().includes('help') || currentInput.toLowerCase().includes('what can you do')) {
        response = "I can help you with trades, waivers, roster analysis, and more! Try asking me about your trade history, waiver targets, or roster strength. \u{1F4AA}";
      } else if (currentInput.toLowerCase().includes('hello') || currentInput.toLowerCase().includes('hi') || currentInput.toLowerCase().includes('hey')) {
        response = "Hey there! \u{1F44B} Ready to dominate your fantasy leagues? Ask me anything about trades, waivers, or your roster!";
      }

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
      setIsTyping(false);
    }, 1200);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden">
      <div className="p-5 border-b border-slate-800 flex items-center gap-4 bg-slate-900">
        <div className="w-11 h-11 bg-gradient-to-br from-pink-500 to-purple-500 rounded-2xl flex items-center justify-center text-2xl">
          {'\u{1F496}'}
        </div>
        <div>
          <div className="font-semibold">Chimmy</div>
          <div className="text-xs text-emerald-400 flex items-center gap-1">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Always here for you
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-3xl ${msg.role === 'user' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center gap-2 text-slate-400">
            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-5 border-t border-slate-800 bg-slate-900">
        <div className="flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask Chimmy anything about your trades, waivers, roster..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl px-6 py-4 text-white placeholder-slate-500 focus:border-cyan-400 outline-none"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim()}
            className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-2xl flex items-center justify-center hover:scale-105 transition disabled:opacity-50 disabled:hover:scale-100"
          >
            <Send className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
