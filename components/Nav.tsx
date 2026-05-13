"use client";

import { motion } from "framer-motion";

export default function Nav() {
  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="#" className="text-2xl font-bold tracking-tight text-ink">
          Smintos
        </a>
        <a
          href="#"
          className="rounded-full bg-mint px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-mint-dark hover:shadow-md"
        >
          Buy Now
        </a>
      </div>
    </motion.header>
  );
}
