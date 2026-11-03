export function LoginAntigravityBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {/* Dental Clinic Photography Base */}
      <img
        src="/dental-login-bg.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center filter brightness-[0.98] contrast-[1.02] scale-[1.01]"
        loading="eager"
      />

      {/* Layer 1: Clinical Atmosphere Tint Overlay */}
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/25 via-sky-900/10 to-teal-800/15" />

      {/* Layer 2: Soft White/Sky Frosting for High-Contrast Text Legibility */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/60 to-sky-50/75 backdrop-blur-[1.5px]" />

      {/* Layer 3: Ambient Radial Glows aligned with Content Focal Points */}
      <div className="absolute -left-20 top-1/4 h-[500px] w-[500px] rounded-full bg-cyan-400/15 blur-[120px]" />
      <div className="absolute -right-20 top-1/3 h-[550px] w-[550px] rounded-full bg-sky-500/15 blur-[130px]" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[750px] w-[950px] rounded-full bg-white/45 blur-[80px]" />

      {/* Layer 4: Soft Edge Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(15,23,42,0.12)_100%)]" />
    </div>
  );
}

