"use client";

import { motion } from "framer-motion";

const stats = [
  { value: "200+", label: "Home service operators" },
  { value: "$40M+", label: "Revenue tracked through Smintos" },
  { value: "3.2x", label: "Avg. lead-to-close lift" },
  { value: "24/7", label: "AI coverage" },
];

const testimonials = [
  {
    quote:
      "We killed five tools the week we switched to Smintos. Our techs and CSRs actually use it.",
    name: "Marcus T.",
    role: "Owner, HVAC company",
  },
  {
    quote:
      "The AI employee books jobs at 11pm. That alone paid for the whole platform in month one.",
    name: "Jenna R.",
    role: "GM, plumbing & drain",
  },
];

export default function SocialProof() {
  return (
    <section className="bg-smoke py-24">
      <div className="mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-2 gap-6 rounded-3xl border border-gray-100 bg-white p-8 shadow-sm md:grid-cols-4"
        >
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-extrabold text-ink sm:text-4xl">
                {s.value}
              </div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">
                {s.label}
              </div>
            </div>
          ))}
        </motion.div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {testimonials.map((t, i) => (
            <motion.figure
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="rounded-2xl border border-gray-100 bg-white p-7 shadow-sm"
            >
              <blockquote className="text-lg leading-relaxed text-ink">
                "{t.quote}"
              </blockquote>
              <figcaption className="mt-5 text-sm">
                <span className="font-semibold text-ink">{t.name}</span>
                <span className="text-gray-500"> — {t.role}</span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}
