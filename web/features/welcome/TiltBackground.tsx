"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";

type Threads = { viewBox: string; boxes: { x: number; y: number; w: number; h: number }[]; path: string; dots: number[][] };

/** Faint outlines joined by threads, drawn around the hero rather than through it. */
const WIDE: Threads = {
  viewBox: "0 0 1440 900",
  boxes: [
    { x: 60, y: 90, w: 260, h: 170 },
    { x: 120, y: 330, w: 210, h: 260 },
    { x: 40, y: 660, w: 300, h: 180 },
    { x: 1110, y: 70, w: 290, h: 200 },
    { x: 1150, y: 340, w: 230, h: 240 },
    { x: 1080, y: 650, w: 320, h: 190 },
    { x: 430, y: 40, w: 580, h: 290 },
  ],
  path: "M320 175 H430 M330 640 H440 V380 M1010 210 H1110 M1150 640 H1000 V380",
  dots: [[320, 175], [430, 175], [440, 380], [1010, 210], [1110, 210], [1000, 380]],
};

/** Phones: a portrait layout whose boxes run off the left and right edges, so the threads cross the narrow column in short runs. */
const TALL: Threads = {
  viewBox: "0 0 400 900",
  boxes: [
    { x: -50, y: 60, w: 130, h: 150 },
    { x: 320, y: 30, w: 130, h: 120 },
    { x: -60, y: 400, w: 110, h: 210 },
    { x: 350, y: 300, w: 100, h: 230 },
    { x: -30, y: 720, w: 150, h: 150 },
    { x: 300, y: 680, w: 140, h: 180 },
  ],
  path: "M80 135 H150 V250 M320 90 H260 V190 M50 505 H110 V620 M350 415 H290 V560 M120 795 H190 M300 770 H230 V690",
  dots: [[80, 135], [150, 250], [320, 90], [260, 190], [50, 505], [110, 620], [350, 415], [290, 560], [120, 795], [190, 795], [300, 770], [230, 690]],
};

function ThreadLines({ layout, className }: { layout: Threads; className: string }) {
  return (
    <svg className={`absolute inset-0 size-full ${className}`} viewBox={layout.viewBox} preserveAspectRatio="xMidYMid slice">
      <g fill="none" stroke="white" strokeOpacity="0.16" strokeWidth="1">
        {layout.boxes.map((b) => <rect key={`${b.x}-${b.y}`} x={b.x} y={b.y} width={b.w} height={b.h} rx="28" />)}
        <path d={layout.path} />
      </g>
      <g fill="white" fillOpacity="0.35">
        {layout.dots.map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3" />)}
      </g>
    </svg>
  );
}

/** Blue backdrop that tilts like a 3D plane toward the pointer. Static with reduced motion or a touch-only device. */
export function TiltBackground() {
  const reduce = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 80, damping: 20 });
  const sy = useSpring(py, { stiffness: 80, damping: 20 });
  const rotateY = useTransform(sx, (v) => v * 6);
  const rotateX = useTransform(sy, (v) => v * -6);
  const x = useTransform(sx, (v) => v * -16);
  const y = useTransform(sy, (v) => v * -16);

  useEffect(() => {
    if (reduce || !matchMedia("(pointer: fine)").matches) return;
    const move = (e: PointerEvent) => {
      px.set(e.clientX / innerWidth - 0.5);
      py.set(e.clientY / innerHeight - 0.5);
    };
    addEventListener("pointermove", move);
    return () => removeEventListener("pointermove", move);
  }, [reduce, px, py]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 [perspective:1200px]">
      <motion.div
        data-tilt
        style={{ rotateX, rotateY, x, y }}
        className="absolute -inset-[8%] bg-[linear-gradient(180deg,#0a3cff_0%,#1a4fff_42%,#3f82ff_58%,#9fd0ff_76%,#e6f6ff_92%)]"
      >
        <ThreadLines layout={TALL} className="sm:hidden" />
        <ThreadLines layout={WIDE} className="hidden sm:block" />
        {/* Pale sky haze rising from the bottom, brightest toward the right, as in the reference. */}
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-[radial-gradient(ellipse_70%_80%_at_72%_100%,rgb(255_255_255/0.9),rgb(214_240_255/0.5)_45%,transparent_75%)]" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-[radial-gradient(ellipse_60%_90%_at_15%_100%,rgb(220_242_255/0.7),transparent_70%)]" />
      </motion.div>
    </div>
  );
}
