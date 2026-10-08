import type { ReactNode } from "react";

// Ícones de traço (estilo Lucide) embutidos para não adicionar dependência.
const PATHS: Record<string, ReactNode> = {
  chevron: <path d="m9 6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.2 2.5 3.5 5.2" />
    </>
  ),
  compare: <path d="M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4" />,
  download: <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 20h16" />,
  megaphone: <path d="m3 11 15-6v14L3 13v-2ZM7 13.5V18a2 2 0 0 0 4 0v-2.5M21 9v6" />,
  pencil: <path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3ZM14 7l3 3" />,
  userPlus: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5M19 8v6M16 11h6" />
    </>
  ),
  // setores
  music: (
    <>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </>
  ),
  sparkles: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" />,
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
  cross: <path d="M10 3h4v6h6v4h-6v8h-4v-8H4V9h6V3Z" />,
  heart: <path d="M12 20s-8-4.9-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.1 12 20 12 20Z" />,
  utensils: <path d="M6 3v8a2 2 0 0 0 2 2v8M10 3v8a2 2 0 0 1-2 2M18 21V3c-2.5 1.5-3.5 4.5-3.5 8H18" />,
  pill: (
    <>
      <path d="m10.5 20.5-7-7a4.9 4.9 0 0 1 7-7l7 7a4.9 4.9 0 0 1-7 7Z" />
      <path d="m8.5 8.5 7 7" />
    </>
  ),
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" />,
  crown: <path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z" />,
  wrench: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L3 17.7 6.3 21l6.3-6.3a4 4 0 0 0 5.1-5.4l-2.6 2.6-2.4-.6-.6-2.4 2.6-2.6Z" />,
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V3h6v1M9 11h6M9 15h6" />
    </>
  ),
  masks: (
    <>
      <path d="M4 5h11v7a5.5 5.5 0 0 1-11 0V5Z" />
      <path d="M7.5 9.5h.01M11.5 9.5h.01M7.5 13.5c1.3 1 2.7 1 4 0M17 9h3v6a4.5 4.5 0 0 1-6 4.2" />
    </>
  ),
  shield: <path d="M12 3 4 6v6c0 4.5 3.3 7.8 8 9 4.7-1.2 8-4.5 8-9V6l-8-3Z" />,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />,
  book: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5ZM4 19a2 2 0 0 1 2-2h13" />,
  inbox: <path d="M3 13h5l1.5 3h5l1.5-3h5M5 5h14l2 8v6H3v-6l2-8Z" />,
};

export function Icon({ name, className = "h-4 w-4" }: { name: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS.users}
    </svg>
  );
}

// Ícone + cor pastel de cada setor, resolvido pelo nome (setores novos caem no padrão).
const SETOR_VISUAL: [RegExp, string, string][] = [
  [/ANIMA/, "sparkles", "bg-amber-50 text-amber-600"],
  [/MARIANO/, "heart", "bg-sky-50 text-sky-600"],
  [/CAPELA/, "cross", "bg-indigo-50 text-indigo-600"],
  [/PREGADOR|CONDU/, "mic", "bg-rose-50 text-rose-600"],
  [/COORDENADORES/, "crown", "bg-yellow-50 text-yellow-700"],
  [/COZINHA/, "utensils", "bg-orange-50 text-orange-600"],
  [/ESPIRITUAL/, "book", "bg-violet-50 text-violet-600"],
  [/EVANGELIZ/, "megaphone", "bg-emerald-50 text-emerald-600"],
  [/FARM/, "pill", "bg-teal-50 text-teal-600"],
  [/LIGA/, "link", "bg-cyan-50 text-cyan-600"],
  [/L[ÍI]DERES/, "star", "bg-fuchsia-50 text-fuchsia-600"],
  [/MANUTEN/, "wrench", "bg-stone-100 text-stone-600"],
  [/M[ÚU]SICA/, "music", "bg-pink-50 text-pink-600"],
  [/SECRETARIA/, "clipboard", "bg-blue-50 text-blue-600"],
  [/TEATRO/, "masks", "bg-purple-50 text-purple-600"],
  [/TROPA/, "shield", "bg-slate-100 text-slate-600"],
];

export function setorVisual(nome: string): { icone: string; cor: string } {
  const n = nome.toUpperCase();
  const hit = SETOR_VISUAL.find(([re]) => re.test(n));
  return hit ? { icone: hit[1], cor: hit[2] } : { icone: "users", cor: "bg-slate-100 text-slate-600" };
}
