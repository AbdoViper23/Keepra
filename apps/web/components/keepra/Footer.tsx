export function Footer() {
  return (
    <footer className="py-20 bg-foreground text-background px-6 mt-32">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-start">
          <div>
            <div className="font-display text-2xl tracking-tighter uppercase mb-8">Keepra</div>
            <p className="max-w-xs text-background/60 text-sm leading-relaxed">
              Built for the preservation of human intention through the certainty of code. Your
              legacy, protected by mathematics.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm">
            <div className="space-y-4">
              <div className="text-background/40 font-mono text-[10px] uppercase">Protocol</div>
              <a href="#" className="block hover:text-primary transition-colors">
                Documentation
              </a>
              <a href="#" className="block hover:text-primary transition-colors">
                Github
              </a>
              <a href="#" className="block hover:text-primary transition-colors">
                Whitepaper
              </a>
            </div>
            <div className="space-y-4">
              <div className="text-background/40 font-mono text-[10px] uppercase">Network</div>
              <a href="#" className="block hover:text-primary transition-colors">
                Sui Explorer
              </a>
              <a href="#" className="block hover:text-primary transition-colors">
                Walrus Stats
              </a>
              <a href="#" className="block hover:text-primary transition-colors">
                Status
              </a>
            </div>
          </div>
        </div>
        <div className="mt-20 pt-8 border-t border-background/10 flex flex-col md:flex-row justify-between gap-4">
          <div className="font-mono text-[10px] text-background/40">
            © 2026 KEEPRA PROTOCOL — UI PROTOTYPE
          </div>
          <div className="flex gap-6 text-[10px] font-mono text-background/40">
            <a href="#" className="hover:text-background">
              TERMS
            </a>
            <a href="#" className="hover:text-background">
              PRIVACY
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
