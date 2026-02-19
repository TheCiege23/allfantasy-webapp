'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Volume2, VolumeX, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';

const HEART_EMOJI = '\u{1F496}';
const LOVE_EMOJI = '\u{1F495}';

function renderContentWithLinks(content: string) {
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(<span key={`text-${lastIndex}`}>{content.slice(lastIndex, match.index)}</span>);
    }
    nodes.push(
      <a
        key={`link-${match.index}`}
        href={match[2]}
        className="underline text-cyan-300 hover:text-cyan-200"
      >
        {match[1]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    nodes.push(<span key={`text-end`}>{content.slice(lastIndex)}</span>);
  }

  return <div className="whitespace-pre-wrap">{nodes.length ? nodes : content}</div>;
}

export default function ChimmyChat() {
  const [messages, setMessages] = useState<any[]>([
    { role: 'assistant', content: `Hi! I'm Chimmy ${HEART_EMOJI} Your personal fantasy AI assistant. Upload a trade screenshot or ask me anything!` }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const speak = (text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.12;
    utterance.volume = 0.92;

    const pausedText = text.replace(/\. /g, '. ... ');
    utterance.text = pausedText;

    speechSynthesis.speak(utterance);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const sendMessage = async () => {
    if (!input.trim() && !imageFile) return;

    const userMessage = {
      role: 'user' as const,
      content: input || 'Analyze this trade screenshot',
      image: imagePreview || null,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    try {
      const formData = new FormData();
      formData.append('message', input || '');
      if (imageFile) formData.append('image', imageFile);

      const res = await fetch('/api/chat/chimmy', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      const reply = data.response || `Sorry, I couldn't read that clearly. Can you try again? ${LOVE_EMOJI}`;

      setMessages(prev => [...prev, { role: 'assistant' as const, content: reply }]);

      if (voiceEnabled) {
        speak(reply);
      }
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setIsTyping(false);
      setImagePreview(null);
      setImageFile(null);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden">
      <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900">
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 bg-gradient-to-br from-pink-500 to-purple-500 rounded-2xl flex items-center justify-center text-2xl">
            {HEART_EMOJI}
          </div>
          <div>
            <div className="font-semibold">Chimmy</div>
            <div className="text-xs text-emerald-400">{`Always here for you ${LOVE_EMOJI}`}</div>
          </div>
        </div>

        <button
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          className="p-3 rounded-full hover:bg-white/10 transition"
        >
          {voiceEnabled ? <Volume2 className="w-5 h-5 text-cyan-400" /> : <VolumeX className="w-5 h-5 text-slate-400" />}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-5 rounded-3xl ${msg.role === 'user' ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-200'}`}>
              {renderContentWithLinks(msg.content)}
              {msg.image && (
                <img src={msg.image} alt="Trade screenshot" className="mt-4 rounded-2xl max-w-full shadow-lg" />
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex items-center gap-2 text-slate-400 pl-4">
            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" />
            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-5 border-t border-slate-800 bg-slate-900">
        <div className="flex gap-3">
          <label className="p-4 bg-slate-800 rounded-2xl cursor-pointer hover:bg-slate-700 transition flex items-center justify-center">
            <ImageIcon className="w-6 h-6 text-cyan-400" />
            <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
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
            className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-purple-500 rounded-2xl flex items-center justify-center hover:scale-105 transition"
          >
            <Send className="w-6 h-6" />
          </button>
        </div>

        {imagePreview && (
          <div className="mt-4 flex items-center gap-3 bg-slate-800 p-3 rounded-2xl">
            <img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-xl" />
            <button
              onClick={() => {
                setImagePreview(null);
                setImageFile(null);
              }}
              className="text-red-400 text-sm hover:text-red-300"
            >
              Remove image
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
