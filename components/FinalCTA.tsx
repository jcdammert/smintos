"use client";

import { motion } from "framer-motion";

export default function FinalCTA() {
  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl bg-ink px-8 py-16 text-center shadow-2xl sm:px-16"
        >
          <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_80%_20%,rgba(62,180,137,0.25),transparent_55%)]" />
          <div className="relative z-10">
            <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Stop duct-taping software.
              <br />
              <span className="text-mint">Run your business on Smintos.</span>
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-lg text-gray-300">
              One platform. Built for home service. Ready in days, not months.
            </p>
            <a
              href="#"
              className="mt-9 inline-block rounded-full bg-mint px-9 py-4 text-base font-semibold text-white shadow-lg shadow-mint/30 transition hover:bg-mint-dark"
            >
              Buy Now
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
