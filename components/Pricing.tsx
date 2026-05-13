"use client";

import { motion } from "framer-motion";

const plans = [
  {
    name: "Business OS Starter",
    setup: "$497",
    monthly: "$197",
    tagline: "Get organized fast.",
    features: [
      "Core pipelines & CRM",
      "Basic automations",
      "Calendar & booking",
      "Reporting dashboard",
      "Email & SMS",
    ],
    highlight: false,
  },
  {
    name: "Business OS Full",
    setup: "$997",
    monthly: "$347",
    tagline: "The full operating system.",
    features: [
      "Everything in Starter",
      "Advanced automations",
      "Multi-pipeline workflows",
      "Review & reputation engine",
      "Advanced reporting",
      "Priority support",
    ],
    highlight: true,
  },
  {
    name: "AI Employee Add-on",
    setup: "$500",
    monthly: "$300",
    tagline: "Your 24/7 team member.",
    features: [
      "Inbound call answering",
      "Lead qualification & booking",
      "SMS & email handling",
      "Custom voice & knowledge",
      "Stacks on any plan",
    ],
    highlight: false,
  },
];

export default function Pricing() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Simple, transparent pricing.
          </h2>
          <p className="mt-5 text-lg text-gray-600">
            One setup fee. One monthly. No long contracts.
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {plans.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1, ease: "easeOut" }}
              className={
                p.highlight
                  ? "relative rounded-3xl bg-ink p-8 text-white shadow-2xl ring-2 ring-mint"
                  : "relative rounded-3xl border border-gray-200 bg-white p-8 shadow-sm"
              }
            >
              {p.highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-mint px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white shadow-md">
                  Most Popular
                </span>
              )}
              <h3
                className={
                  p.highlight
                    ? "text-xl font-semibold text-white"
                    : "text-xl font-semibold text-ink"
                }
              >
                {p.name}
              </h3>
              <p
                className={
                  p.highlight
                    ? "mt-1 text-sm text-gray-300"
                    : "mt-1 text-sm text-gray-500"
                }
              >
                {p.tagline}
              </p>

              <div className="mt-6 flex items-baseline gap-2">
                <span
                  className={
                    p.highlight
                      ? "text-5xl font-extrabold text-mint"
                      : "text-5xl font-extrabold text-ink"
                  }
                >
                  {p.monthly}
                </span>
                <span
                  className={
                    p.highlight ? "text-sm text-gray-300" : "text-sm text-gray-500"
                  }
                >
                  /mo
                </span>
              </div>
              <p
                className={
                  p.highlight
                    ? "mt-1 text-sm text-gray-300"
                    : "mt-1 text-sm text-gray-500"
                }
              >
                + {p.setup} one-time setup
              </p>

              <ul className="mt-7 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-mint"
                    >
                      <path
                        d="M5 12l5 5L20 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span
                      className={p.highlight ? "text-gray-200" : "text-gray-700"}
                    >
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href="#"
                className={
                  p.highlight
                    ? "mt-8 block rounded-full bg-mint px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-mint-dark"
                    : "mt-8 block rounded-full bg-ink px-6 py-3 text-center text-sm font-semibold text-white transition hover:bg-gray-800"
                }
              >
                Buy Now
              </a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
