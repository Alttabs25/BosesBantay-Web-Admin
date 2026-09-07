import { useState, useEffect } from 'react'

const LETTERS = [
  { char: 'B', accent: false },
  { char: 'o', accent: false },
  { char: 's', accent: false },
  { char: 'e', accent: false },
  { char: 's', accent: false },
  { char: 'B', accent: true },
  { char: 'a', accent: true },
  { char: 'n', accent: true },
  { char: 't', accent: true },
  { char: 'a', accent: true },
  { char: 'y', accent: true },
]

export default function LoginLoadingScreen({ onComplete }) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    // Start exit transition after letters fold up and settle
    const exitTimer = setTimeout(() => {
      setIsExiting(true)
    }, 1250)

    // Complete navigation callback
    const doneTimer = setTimeout(() => {
      if (onComplete) onComplete()
    }, 1500)

    return () => {
      clearTimeout(exitTimer)
      clearTimeout(doneTimer)
    }
  }, [onComplete])

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#071d33] px-4 transition-all duration-300 ease-out select-none ${
        isExiting ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Soft ambient background glow */}
      <div className="pointer-events-none absolute h-80 w-80 rounded-full bg-cyan-500/15 blur-[100px] animate-pulse-glow" />

      {/* Main minimal fold text container */}
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Logo */}
        <div className="mb-4 flex h-16 w-16 items-center justify-center animate-float-gentle">
          <img
            src="/logo-icon.png"
            alt="BosesBantay"
            className="h-full w-full object-contain drop-shadow-[0_4px_16px_rgba(15,107,179,0.5)]"
          />
        </div>

        {/* 3D Folding Text: BosesBantay */}
        <div className="flex items-center justify-center overflow-hidden py-2" style={{ perspective: '800px' }}>
          {LETTERS.map((item, index) => (
            <span
              key={index}
              style={{
                animationDelay: `${index * 55}ms`,
              }}
              className={`animate-fold-up text-4xl sm:text-5xl md:text-6xl font-black tracking-tight ${
                item.accent
                  ? 'text-cyan-400 drop-shadow-[0_0_14px_rgba(34,211,238,0.4)]'
                  : 'text-white drop-shadow-[0_2px_10px_rgba(255,255,255,0.25)]'
              }`}
            >
              {item.char}
            </span>
          ))}
        </div>

        {/* Minimal Subtitle & Pulsing Dots */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-white/60">
            Administrative Command Center
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse [animation-delay:300ms]" />
          </span>
        </div>
      </div>
    </div>
  )
}
