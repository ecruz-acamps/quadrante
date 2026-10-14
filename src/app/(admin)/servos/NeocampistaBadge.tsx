import { COR_TRIBO_HEX } from "@/lib/constants";

export default function NeocampistaBadge({ info }: { info: { missao: string; tribo: string | null } | null }) {
  if (!info) return null;
  const hex = info.tribo ? COR_TRIBO_HEX[info.tribo] : undefined;
  return (
    <span className="inline-flex items-center gap-1">
      neocampista no {info.missao}
      {hex && (
        <span
          title={info.tribo ?? undefined}
          className="inline-block w-2.5 h-2.5 rounded-full border border-black/20"
          style={{ background: hex }}
        />
      )}
      {info.tribo && <span>{info.tribo.replace("TRIBO ", "").toLowerCase()}</span>}
    </span>
  );
}
