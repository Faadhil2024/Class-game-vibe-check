import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import type { StudentSelfState } from '../shared/questions.ts';

interface StudentCompletionProps {
  student: StudentSelfState;
  onViewResults: () => void;
}

const EASE = [0.23, 1, 0.32, 1] as const;
const PIXEL_FONT = '"Silkscreen", ui-monospace, monospace';

const COMPLETION_PHRASES = [
  'Vibe status: Verified.',
  'Certified class energy.',
  'Peak dev instincts.',
  '10/10. Zero regrets.',
  'Main character energy.',
  'Locked in & legendary.',
  'Pure classroom lore.',
  'Built different.',
  'Quest complete, legend.',
  'Achievement unlocked!',
] as const;

const VOXEL_BURST = Array.from({ length: 28 }, (_, idx) => {
  const angle = (idx / 28) * Math.PI * 2;
  const dist = 150 + (idx % 4) * 58;
  return {
    id: idx,
    tx: Math.round(Math.cos(angle) * dist),
    ty: Math.round(Math.sin(angle) * dist * 0.72),
    size: idx % 3 === 0 ? 12 : idx % 3 === 1 ? 8 : 6,
    color: idx % 3 === 0 ? '#FF4D2E' : idx % 3 === 1 ? '#C6F432' : '#F7F5EF',
    delay: 0.14 + (idx % 5) * 0.025,
  };
});

const FLOATING_SPARKS = [
  { x: '-38%', y: '-34%', color: '#C6F432', size: 10, dur: 2.8, delay: 0.1 },
  { x: '36%', y: '-32%', color: '#FF4D2E', size: 12, dur: 3.2, delay: 0.4 },
  { x: '-44%', y: '14%', color: '#F7F5EF', size: 8, dur: 2.5, delay: 0.25 },
  { x: '43%', y: '18%', color: '#C6F432', size: 10, dur: 3.0, delay: 0.6 },
  { x: '-26%', y: '38%', color: '#FF4D2E', size: 8, dur: 3.4, delay: 0.35 },
  { x: '28%', y: '36%', color: '#F7F5EF', size: 10, dur: 2.7, delay: 0.5 },
] as const;

export function StudentCompletion({ student, onViewResults }: StudentCompletionProps) {
  const phrase = useMemo(() => {
    const idx = Math.floor(Math.random() * COMPLETION_PHRASES.length);
    return COMPLETION_PHRASES[idx] ?? COMPLETION_PHRASES[0];
  }, [student.id]);

  return (
    <div
      className="relative mx-auto flex min-h-[calc(100svh-57px)] max-w-5xl flex-col items-center justify-center overflow-hidden px-4 py-12 text-center sm:px-6"
      style={{ fontFamily: PIXEL_FONT }}
    >
      {/* Expanding pixel shockwave on impact */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 border-4 border-[#C6F432]"
        initial={{ scale: 0.3, opacity: 0.95 }}
        animate={{ scale: 4.2, opacity: 0 }}
        transition={{ duration: 0.9, ease: EASE, delay: 0.08 }}
      />
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-1/2 border-4 border-[#FF4D2E]"
        initial={{ scale: 0.2, opacity: 0.9 }}
        animate={{ scale: 3.4, opacity: 0 }}
        transition={{ duration: 0.85, ease: EASE, delay: 0.16 }}
      />

      {/* Square voxel loot explosion */}
      <div className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden="true">
        {VOXEL_BURST.map((p) => (
          <motion.span
            key={p.id}
            className="absolute block"
            style={{
              width: p.size,
              height: p.size,
              background: p.color,
              boxShadow: '2px 2px 0 #0B0B0F',
            }}
            initial={{ x: 0, y: 0, scale: 1.4, opacity: 1, rotate: 0 }}
            animate={{ x: p.tx, y: p.ty, scale: 0, opacity: 0, rotate: p.id % 2 === 0 ? 90 : -90 }}
            transition={{ duration: 1.05, ease: EASE, delay: p.delay }}
          />
        ))}
      </div>

      {/* Ambient bobbing pixel XP sparks */}
      {FLOATING_SPARKS.map((s, i) => (
        <motion.span
          key={i}
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 hidden sm:block"
          style={{
            width: s.size,
            height: s.size,
            marginLeft: s.x,
            marginTop: s.y,
            background: s.color,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0.35, 0.95, 0.35],
            y: [0, -14, 0],
            scale: [0.9, 1.15, 0.9],
          }}
          transition={{
            duration: s.dur,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: s.delay,
          }}
        />
      ))}

      {/* Main centered Minecraft-styled voxel achievement frame with camera-slam impact */}
      <motion.div
        initial={{ opacity: 0, scale: 0.86, y: 24 }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
          x: [0, -4, 4, -2, 2, 0],
        }}
        transition={{
          opacity: { duration: 0.35 },
          scale: { type: 'spring', stiffness: 280, damping: 18 },
          y: { type: 'spring', stiffness: 280, damping: 18 },
          x: { duration: 0.35, delay: 0.14 },
        }}
        className="relative z-10 w-full max-w-2xl border-4 border-[#323244] bg-[#15151d]/95 px-6 py-10 sm:px-12 sm:py-12"
        style={{
          boxShadow: '10px 10px 0 #050507, inset 0 0 0 2px #242432',
        }}
      >
        {/* Pixel corner brackets */}
        <span aria-hidden="true" className="absolute -left-1 -top-1 h-3 w-3 bg-[#C6F432]" />
        <span aria-hidden="true" className="absolute -right-1 -top-1 h-3 w-3 bg-[#C6F432]" />
        <span aria-hidden="true" className="absolute -bottom-1 -left-1 h-3 w-3 bg-[#FF4D2E]" />
        <span aria-hidden="true" className="absolute -bottom-1 -right-1 h-3 w-3 bg-[#FF4D2E]" />

        {/* Achievement badge */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="mx-auto inline-flex items-center gap-2.5 border-2 border-[#C6F432]/60 bg-[#0b0b0f] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#C6F432] sm:text-xs"
        >
          <span className="inline-block h-2 w-2 animate-pulse bg-[#C6F432]" aria-hidden="true" />
          <span>SUBMITTED · {student.name}</span>
        </motion.div>

        {/* Big pixelated 10/10 score slam */}
        <motion.div
          initial={{ scale: 1.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 16, delay: 0.08 }}
          className="mt-6 text-6xl font-bold leading-none tracking-tight text-[#C6F432] sm:text-8xl"
          style={{ textShadow: '5px 5px 0 #0B0B0F, 8px 8px 0 #263A0C' }}
        >
          10/10
        </motion.div>

        {/* Segmented 10-block Minecraft XP progress bar */}
        <div
          className="mx-auto mt-6 grid max-w-md grid-cols-10 gap-1.5 border-2 border-[#323244] bg-[#0b0b0f] p-2"
          aria-label="10 of 10 questions completed"
        >
          {Array.from({ length: 10 }, (_, i) => (
            <motion.span
              key={i}
              className="block h-3.5 sm:h-4"
              style={{
                background: i >= 7 ? '#FF4D2E' : '#C6F432',
                boxShadow: 'inset -2px -2px 0 rgba(0,0,0,0.35), inset 2px 2px 0 rgba(255,255,255,0.28)',
              }}
              initial={{ scaleY: 0, opacity: 0.2 }}
              animate={{ scaleY: 1, opacity: 1 }}
              transition={{ duration: 0.18, delay: 0.22 + i * 0.05, ease: EASE }}
            />
          ))}
        </div>

        {/* Randomized player phrase */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.35, ease: EASE }}
          className="mt-7 text-balance text-2xl font-bold leading-tight text-[#F7F5EF] sm:text-4xl"
          style={{ fontFamily: PIXEL_FONT, textShadow: '3px 3px 0 #0B0B0F' }}
        >
          {phrase}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.48 }}
          className="mx-auto mt-4 max-w-md text-xs leading-relaxed text-[#c7c4d4] sm:text-sm"
        >
          All 10 answers saved. Jump in to watch how the whole class voted.
        </motion.p>

        {/* Tactile 3D pixel CTA button with light sweep */}
        <motion.button
          type="button"
          onClick={onViewResults}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.56, ease: EASE }}
          whileHover={{ y: -3 }}
          whileTap={{ y: 3 }}
          className="group relative mx-auto mt-8 inline-flex min-h-[60px] items-center justify-center gap-3 overflow-hidden border-2 border-[#FF9566] px-8 text-sm font-bold uppercase tracking-wider sm:px-10 sm:text-base"
          style={{
            background: '#FF4D2E',
            color: '#0B0B0F',
            boxShadow: '0 6px 0 #8A220F, 6px 10px 0 #050507',
          }}
        >
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-white/30"
            animate={{ left: ['-40%', '140%'] }}
            transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.8, ease: 'easeInOut' }}
          />
          <span className="relative z-10">See class results</span>
          <ArrowRight className="relative z-10 h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </motion.button>
      </motion.div>
    </div>
  );
}