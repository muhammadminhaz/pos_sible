"use client";

import { MotionConfig, motion } from "motion/react";
import { SITE } from "@/lib/site";

/** The footer's huge name. Each letter, the hyphen too, springs up into place in turn once the bottom of the page comes into view. */
export function Wordmark() {
  return (
    // Reduced motion: letters fade in place, no movement.
    <MotionConfig reducedMotion="user">
    <motion.p
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.4 }}
      transition={{ staggerChildren: 0.07 }}
      className="-mb-[0.2em] text-center font-display text-[21vw] leading-none font-semibold tracking-[-0.07em] whitespace-nowrap select-none lg:text-[17rem]"
    >
      {/* Read once as a word: the letters are split for the animation only. */}
      <span className="sr-only">{SITE.name}</span>
      {[...SITE.name].map((ch, i) => (
        <motion.span
          key={i}
          aria-hidden
          variants={{ hidden: { y: "60%", opacity: 0 }, shown: { y: 0, opacity: 1 } }}
          transition={{ type: "spring", stiffness: 260, damping: 18, mass: 0.9 }}
          // Each letter carries the gradient itself (a transformed child would not show its parent's background-clip text), and paints
          // only inside its own box. The tight tracking pushes glyph edges past that box, so padding widens it and the matching
          // negative margin keeps the layout where it was.
          className="-mx-[0.12em] -my-[0.1em] inline-block bg-[linear-gradient(180deg,#3f82ff,#0a3cff_45%,#071447)] bg-clip-text px-[0.12em] py-[0.1em] text-transparent"
        >
          {ch}
        </motion.span>
      ))}
    </motion.p>
    </MotionConfig>
  );
}
