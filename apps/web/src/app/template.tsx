"use client";

import { motion } from "framer-motion";

// Opacity only, on purpose. Animating `y` here puts a CSS transform on this
// wrapper, and a transformed element becomes the containing block for every
// `position: fixed` descendant — the sidebar, mobile tab bar, command palette
// and every modal all live inside pages. While the transform is active they
// stop being viewport-fixed: the nav chrome slid 15px on each navigation, and
// an overlay opened in the first half-second only covered this box.
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex-1 flex flex-col h-full w-full"
    >
      {children}
    </motion.div>
  );
}
