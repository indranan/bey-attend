import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

function numberConfig(label, color) {
  return {
    text: label,
    className: 'text-white text-7xl sm:text-9xl md:text-[12rem] font-black italic',
    initial: { opacity: 0, scale: 2, rotate: -6 },
    animate: { opacity: 1, scale: 1, rotate: [0, -4, 4, 0] },
    transition: { duration: 0.6, ease: 'easeOut' },
    dropShadow: `drop-shadow-[0_0_20px_${color}]`,
  };
}

const introConfig = {
  STANDBY: {
    text: 'BLADERS, STANDBY...',
    className: 'text-blue-300 text-2xl sm:text-4xl md:text-5xl font-bold uppercase tracking-[0.3em]',
    initial: { opacity: 0, scale: 0.95 },
    animate: {
      opacity: [0, 1, 1, 0.6, 1],
      scale: [0.95, 1, 1, 0.98, 1],
    },
    transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' },
    dropShadow: 'drop-shadow-[0_0_15px_#2563EB]',
  },
  READY: {
    text: 'READY',
    className: 'text-blue-400 text-6xl sm:text-8xl md:text-9xl font-bold uppercase tracking-[0.4em]',
    initial: { opacity: 0, scale: 0.6 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.6, ease: 'easeOut' },
    dropShadow: 'drop-shadow-[0_0_15px_#2563EB]',
  },
  '3': numberConfig('3', '#60A5FA'),
  '2': numberConfig('2', '#60A5FA'),
  '1': numberConfig('1', '#2563EB'),
  GO: {
    text: 'GO',
    className: 'text-blue-400 text-6xl sm:text-8xl md:text-[10rem] font-black uppercase tracking-[0.3em]',
    initial: { opacity: 0, scale: 0.5 },
    animate: { opacity: 1, scale: 1.2 },
    transition: { duration: 0.2, ease: 'easeOut' },
    dropShadow: 'drop-shadow-[0_0_20px_#2563EB]',
  },
  SHOOT: {
    text: 'SHOOT!',
    className: 'text-blue-500 text-6xl sm:text-8xl md:text-[11rem] font-black uppercase tracking-[0.2em]',
    initial: { opacity: 0, scale: 0.5 },
    animate: { opacity: 1, scale: [0.5, 1.5, 1.0], x: [0, -12, 12, -8, 8, 0] },
    transition: { duration: 0.6, times: [0, 0.6, 1], ease: 'easeOut' },
    dropShadow: 'drop-shadow-[0_0_30px_#2563EB]',
  },
  FADEOUT: {
    text: '',
    className: 'text-white text-6xl sm:text-8xl md:text-9xl font-black uppercase',
    initial: { opacity: 1 },
    animate: { opacity: 0 },
    transition: { duration: 0.3 },
    dropShadow: '',
  },
};

export default function MatchIntro({
  show,
  onFinish,
  audioSrc = '/suara-announcer.mp3',
  visualDelayMs = 0,
}) {
  const [phase, setPhase] = useState(null);

  useEffect(() => {
    if (!show) {
      setPhase(null);
      return;
    }

    // Bluetooth mode: audio tetap diputar pada timeline normal.
    // Yang digeser adalah timeline VISUAL agar mengikuti latency speaker Bluetooth.
    const delay = Math.max(0, Number(visualDelayMs) || 0);

    setPhase('STANDBY');

    const timers = [];

    // Audio tetap mulai pada 2500ms.
    timers.push(
      setTimeout(() => {
        try {
          const audio = new Audio(audioSrc);
          audio.play().catch(() => {});
        } catch (e) {
          // Abaikan kegagalan audio; timeline visual tetap berjalan.
        }
      }, 2500)
    );

    // Semua perubahan visual mulai setelah audio + visual delay.
    timers.push(setTimeout(() => setPhase('READY'), 2500 + delay));
    timers.push(setTimeout(() => setPhase(null), 3300 + delay));
    timers.push(setTimeout(() => setPhase('3'), 3500 + delay));
    timers.push(setTimeout(() => setPhase('2'), 4300 + delay));
    timers.push(setTimeout(() => setPhase('1'), 5100 + delay));
    timers.push(setTimeout(() => setPhase('GO'), 6200 + delay));
    timers.push(setTimeout(() => setPhase('SHOOT'), 7450 + delay));
    timers.push(setTimeout(() => setPhase('FADEOUT'), 9050 + delay));

    timers.push(
      setTimeout(() => {
        setPhase(null);
        if (typeof onFinish === 'function') onFinish();
      }, 9350 + delay)
    );

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [show, audioSrc, onFinish, visualDelayMs]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[999] bg-black flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Radial esports glow */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.25)_0%,transparent_60%)] pointer-events-none" />

          {/* Particles / rotating ring */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <motion.div
              className="w-[60vmin] h-[60vmin] rounded-full border border-blue-500/20"
              animate={{ rotate: 360, scale: [1, 1.1, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            />
          </div>

          {/* White radial burst flash on climax */}
          <AnimatePresence>
            {phase === 'SHOOT' && (
              <motion.div
                className="absolute inset-0 z-20 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.9)_0%,rgba(37,99,235,0.4)_25%,transparent_60%)]"
                initial={{ opacity: 0, scale: 0.3 }}
                animate={{ opacity: [0, 1, 0], scale: [0.3, 1.4, 2] }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            )}
          </AnimatePresence>

          <div className="relative z-10 flex items-center justify-center w-full px-4">
            {phase && introConfig[phase] && (
              <motion.div
                key={phase}
                className={`text-center uppercase font-bold tracking-widest text-white ${introConfig[phase].className} ${introConfig[phase].dropShadow}`}
                initial={introConfig[phase].initial}
                animate={introConfig[phase].animate}
                transition={introConfig[phase].transition}
              >
                {introConfig[phase].text}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
