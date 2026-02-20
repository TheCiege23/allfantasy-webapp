'use client'

import React, { useState, useEffect } from 'react'

export default function CrestImpactAnimation() {
  const [phase, setPhase] = useState<'flying' | 'impact' | 'cracks' | 'fade' | 'done'>('flying')

  useEffect(() => {
    const hasPlayed = sessionStorage.getItem('af-crest-played')
    if (hasPlayed) {
      setPhase('done')
      return
    }

    const timers = [
      setTimeout(() => setPhase('impact'), 800),
      setTimeout(() => setPhase('cracks'), 900),
      setTimeout(() => setPhase('fade'), 2200),
      setTimeout(() => {
        setPhase('done')
        sessionStorage.setItem('af-crest-played', '1')
      }, 2900),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  if (phase === 'done') return null

  return (
    <div
      className={`fixed inset-0 z-[9999] pointer-events-none transition-opacity duration-700 ${
        phase === 'fade' ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <svg
        className="absolute inset-0 w-full h-full"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <filter id="crack-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {(phase === 'cracks' || phase === 'fade') && (
          <g filter="url(#crack-glow)" className="animate-crack-appear">
            <line x1="960" y1="540" x2="720" y2="200" stroke="rgba(139,92,246,0.9)" strokeWidth="3" className="animate-crack-line-1" />
            <line x1="960" y1="540" x2="1200" y2="180" stroke="rgba(139,92,246,0.8)" strokeWidth="2.5" className="animate-crack-line-2" />
            <line x1="960" y1="540" x2="600" y2="600" stroke="rgba(6,182,212,0.85)" strokeWidth="2.5" className="animate-crack-line-3" />
            <line x1="960" y1="540" x2="1350" y2="650" stroke="rgba(6,182,212,0.8)" strokeWidth="2" className="animate-crack-line-4" />
            <line x1="960" y1="540" x2="800" y2="900" stroke="rgba(139,92,246,0.7)" strokeWidth="2" className="animate-crack-line-5" />
            <line x1="960" y1="540" x2="1150" y2="880" stroke="rgba(6,182,212,0.7)" strokeWidth="2.5" className="animate-crack-line-6" />
            <line x1="960" y1="540" x2="500" y2="400" stroke="rgba(139,92,246,0.6)" strokeWidth="1.5" className="animate-crack-line-7" />
            <line x1="960" y1="540" x2="1400" y2="350" stroke="rgba(6,182,212,0.6)" strokeWidth="1.5" className="animate-crack-line-8" />

            <line x1="720" y1="200" x2="650" y2="50" stroke="rgba(139,92,246,0.5)" strokeWidth="1.5" className="animate-crack-branch-1" />
            <line x1="720" y1="200" x2="580" y2="150" stroke="rgba(139,92,246,0.4)" strokeWidth="1" className="animate-crack-branch-2" />
            <line x1="1200" y1="180" x2="1350" y2="50" stroke="rgba(6,182,212,0.5)" strokeWidth="1.5" className="animate-crack-branch-3" />
            <line x1="1200" y1="180" x2="1300" y2="100" stroke="rgba(6,182,212,0.4)" strokeWidth="1" className="animate-crack-branch-4" />
            <line x1="600" y1="600" x2="400" y2="700" stroke="rgba(139,92,246,0.4)" strokeWidth="1" className="animate-crack-branch-5" />
            <line x1="1350" y1="650" x2="1500" y2="750" stroke="rgba(6,182,212,0.4)" strokeWidth="1" className="animate-crack-branch-6" />
            <line x1="800" y1="900" x2="700" y2="1050" stroke="rgba(139,92,246,0.4)" strokeWidth="1" className="animate-crack-branch-7" />
            <line x1="1150" y1="880" x2="1250" y2="1050" stroke="rgba(6,182,212,0.4)" strokeWidth="1" className="animate-crack-branch-8" />
          </g>
        )}
      </svg>

      {(phase === 'impact' || phase === 'cracks' || phase === 'fade') && (
        <div className="absolute inset-0 animate-impact-flash" />
      )}

      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${
          phase === 'flying'
            ? 'animate-crest-fly-in'
            : phase === 'impact'
            ? 'animate-crest-impact'
            : phase === 'cracks' || phase === 'fade'
            ? 'animate-crest-shatter'
            : ''
        }`}
      >
        <div className="relative">
          <img
            src="/af-crest.jpg"
            alt="AF Crest"
            className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl shadow-2xl shadow-purple-500/50"
          />
          <div className="absolute inset-0 rounded-2xl ring-2 ring-cyan-400/50" />
        </div>
      </div>

      {(phase === 'impact' || phase === 'cracks') && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {[
            { x: 100, y: 0 }, { x: 87, y: 50 }, { x: 50, y: 87 }, { x: 0, y: 100 },
            { x: -50, y: 87 }, { x: -87, y: 50 }, { x: -100, y: 0 }, { x: -87, y: -50 },
            { x: -50, y: -87 }, { x: 0, y: -100 }, { x: 50, y: -87 }, { x: 87, y: -50 },
          ].map((dir, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 rounded-full animate-spark"
              style={{
                background: i % 2 === 0 ? '#8b5cf6' : '#06b6d4',
                animationDelay: `${i * 40}ms`,
                '--spark-x': `${dir.x}px`,
                '--spark-y': `${dir.y}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes crest-fly-in {
          0% {
            transform: translate(-50%, -50%) scale(3) rotate(-15deg);
            opacity: 0;
            filter: blur(8px);
          }
          60% {
            opacity: 1;
            filter: blur(2px);
          }
          100% {
            transform: translate(-50%, -50%) scale(1) rotate(0deg);
            opacity: 1;
            filter: blur(0px);
          }
        }
        .animate-crest-fly-in {
          animation: crest-fly-in 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        @keyframes crest-impact {
          0% { transform: translate(-50%, -50%) scale(1); }
          30% { transform: translate(-50%, -50%) scale(1.15); }
          100% { transform: translate(-50%, -50%) scale(1); }
        }
        .animate-crest-impact {
          animation: crest-impact 0.15s ease-out forwards;
        }

        @keyframes crest-shatter {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          40% {
            transform: translate(-50%, -50%) scale(1.05);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(0.3);
            opacity: 0;
            filter: blur(6px);
          }
        }
        .animate-crest-shatter {
          animation: crest-shatter 1s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }

        @keyframes impact-flash {
          0% { background: rgba(139, 92, 246, 0.3); }
          50% { background: rgba(6, 182, 212, 0.15); }
          100% { background: transparent; }
        }
        .animate-impact-flash {
          animation: impact-flash 0.4s ease-out forwards;
        }

        @keyframes crack-line-grow {
          0% {
            stroke-dashoffset: 800;
            opacity: 0;
          }
          10% { opacity: 1; }
          100% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }

        @keyframes crack-branch-grow {
          0% {
            stroke-dashoffset: 400;
            opacity: 0;
          }
          30% { opacity: 0; }
          40% { opacity: 0.7; }
          100% {
            stroke-dashoffset: 0;
            opacity: 0.7;
          }
        }

        .animate-crack-appear line {
          stroke-dasharray: 800;
          stroke-dashoffset: 800;
          stroke-linecap: round;
        }

        .animate-crack-line-1 { animation: crack-line-grow 0.6s 0s ease-out forwards; }
        .animate-crack-line-2 { animation: crack-line-grow 0.6s 0.03s ease-out forwards; }
        .animate-crack-line-3 { animation: crack-line-grow 0.55s 0.06s ease-out forwards; }
        .animate-crack-line-4 { animation: crack-line-grow 0.55s 0.09s ease-out forwards; }
        .animate-crack-line-5 { animation: crack-line-grow 0.5s 0.12s ease-out forwards; }
        .animate-crack-line-6 { animation: crack-line-grow 0.5s 0.15s ease-out forwards; }
        .animate-crack-line-7 { animation: crack-line-grow 0.45s 0.18s ease-out forwards; }
        .animate-crack-line-8 { animation: crack-line-grow 0.45s 0.21s ease-out forwards; }

        .animate-crack-branch-1 { stroke-dasharray: 400; animation: crack-branch-grow 0.4s 0.3s ease-out forwards; }
        .animate-crack-branch-2 { stroke-dasharray: 400; animation: crack-branch-grow 0.35s 0.35s ease-out forwards; }
        .animate-crack-branch-3 { stroke-dasharray: 400; animation: crack-branch-grow 0.4s 0.32s ease-out forwards; }
        .animate-crack-branch-4 { stroke-dasharray: 400; animation: crack-branch-grow 0.35s 0.37s ease-out forwards; }
        .animate-crack-branch-5 { stroke-dasharray: 400; animation: crack-branch-grow 0.35s 0.38s ease-out forwards; }
        .animate-crack-branch-6 { stroke-dasharray: 400; animation: crack-branch-grow 0.35s 0.4s ease-out forwards; }
        .animate-crack-branch-7 { stroke-dasharray: 400; animation: crack-branch-grow 0.35s 0.42s ease-out forwards; }
        .animate-crack-branch-8 { stroke-dasharray: 400; animation: crack-branch-grow 0.35s 0.44s ease-out forwards; }

        @keyframes spark {
          0% {
            transform: translate(0, 0) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(var(--spark-x), var(--spark-y)) scale(0);
            opacity: 0;
          }
        }
        .animate-spark {
          animation: spark 0.6s ease-out forwards;
        }
      `}</style>
    </div>
  )
}
