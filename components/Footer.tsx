export default function Footer() {
  return (
    <footer className="bg-ink py-12 text-gray-400">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-white">Smintos</span>
          <span className="text-sm text-gray-500">
            © {new Date().getFullYear()} — All rights reserved.
          </span>
        </div>
        <a
          href="https://scalemintsolutions.com"
          target="_blank"
          rel="noreferrer"
          className="text-sm font-medium text-mint hover:text-mint-dark"
        >
          Powered by Scale Mint
        </a>
      </div>
    </footer>
  );
}
