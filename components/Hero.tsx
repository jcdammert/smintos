"use client";

import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-white pt-20 pb-28">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-20%,rgba(62,180,137,0.12),transparent_60%)]" />
      <div className="mx-auto max-w-4xl px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <span className="mb-6 inline-block rounded-full border border-mint/30 bg-mint/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-mint-dark">
            THE BUSINESS OS FOR HOME SERVICE
          </span>
          <h1 className="text-5xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-6xl md:text-7xl">
            Run your entire home
            <br />
            service business from
            <br />
            <span className="text-mint">one place.</span>
          </h1>
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-gray-600 sm:text-xl">
            Smintos replaces a tangle of tools with one operating system —
            pipelines, automations, AI employees, and reporting built for
            contractors who want to scale.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          className="mt-10 flex flex-col items-center"
        >
          <a
            href="#"
            className="rounded-full bg-mint px-8 py-4 text-base font-semibold text-white shadow-lg shadow-mint/20 transition hover:bg-mint-dark hover:shadow-xl hover:shadow-mint/30"
          >
            Buy Now
          </a>
          <a
            href="https://scalemintsolutions.com"
            target="_blank"
            rel="noreferrer"
            className="mt-5 text-sm font-medium text-mint hover:text-mint-dark"
          >
            Powered by Scale Mint
          </a>
        </motion.div>
      </div>
    </section>
  );
}
