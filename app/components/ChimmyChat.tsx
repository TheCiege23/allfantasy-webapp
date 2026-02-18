'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Volume2, VolumeX, Image as ImageIcon, X } from 'lucide-react';

type ToolOutput = {
  tool: string;
  output: any;
  timestamp: Date;
};

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
  image?: string | null;
};

export default function ChimmyChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hi! I'm Chimmy \u{1F496} Your personal fantasy AI assistant. What can I help you with today?" }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [toolHistory, setToolHistory] = useState<ToolOutput[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    (window as any).addToolOutput = (tool: string, output: any) => {
      setToolHistory(prev => [...prev, { tool, output, timestamp: new Date() }]);
    };
  }, []);

  const speak = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const clean = text.replace(/[\u{1F300}-\u{1FAFF}]/gu, '').trim();
    if (!clean) return;

    const utterance = new SpeechSynthesisUtterance(clean);
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.toLowerCase().includes('female') ||
      v.name.toLowerCase().includes('samantha') ||
      v.name.toLowerCase().includes('victoria')
    );
    utterance.voice = preferred || voices[0] || null;
    utterance.rate = 1.05;
    utterance.pitch = 1.1;
    utterance.volume = 0.9;

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) return;

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImagePreview(null);
    setImageFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const sendMessage = async () => {
    if (!input.trim() && !imageFile) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input,
      image: imagePreview || null,
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    const currentImageFile = imageFile;
    clearImage();
    setIsTyping(true);

    try {
      const formData = new FormData();
      formData.append('message', currentInput);
      if (currentImageFile) formData.append('image', currentImageFile);

      const recentTools = toolHistory.slice(-3).map(t => ({
        tool: t.tool,
        output: typeof t.output === 'string' ? t.output : JSON.stringify(t.output).slice(0, 500),
      }));
      formData.append('toolContext', JSON.stringify(recentTools));

      const res = await fetch('/api/chat/chimmy', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      const assistantReply = data.response || "Hmm... something went wrong. Try again? \u{1F495}";
      setMessages(prev => [...prev, { role: 'assistant', content: assistantReply }]);
      speak(assistantReply);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Sorry, I couldn't process that. Try again? \u{1F495}" }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden">
      <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900">
        <div className="flex items-center gap-4">
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

        <button
          onClick={() => {
            if (voiceEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
              speechSynthesis.cancel();
            }
            setVoiceEnabled(!voiceEnabled);
          }}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          title={voiceEnabled ? 'Mute voice' : 'Enable voice'}
        >
          {voiceEnabled ? (
            <Volume2 className="w-5 h-5 text-cyan-400" />
          ) : (
            <VolumeX className="w-5 h-5 text-slate-400" />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-3xl ${msg.role === 'user' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
              {msg.content}
              {msg.image && (
                <img src={msg.image} alt="Uploaded screenshot" className="mt-3 rounded-xl max-w-full max-h-64 object-contain" />
              )}
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
        {imagePreview && (
          <div className="mb-3 flex items-center gap-3">
            <img src={imagePreview} alt="Preview" className="w-16 h-16 object-cover rounded-lg border border-slate-700" />
            <button onClick={clearImage} className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
              <X className="w-4 h-4" />
              Remove
            </button>
          </div>
        )}
        <div className="flex gap-3">
          <label className="w-14 h-14 bg-slate-800 rounded-2xl cursor-pointer hover:bg-slate-700 transition flex items-center justify-center shrink-0">
            <ImageIcon className="w-6 h-6 text-cyan-400" />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask Chimmy anything... or upload a trade screenshot"
            className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl px-6 py-4 text-white placeholder-slate-500 focus:border-cyan-400 outline-none"
          />

          <button
            onClick={sendMessage}
            disabled={!input.trim() && !imageFile}
            className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-2xl flex items-center justify-center hover:scale-105 transition disabled:opacity-50 disabled:hover:scale-100 shrink-0"
          >
            <Send className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
