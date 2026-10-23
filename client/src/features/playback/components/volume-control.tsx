import { Volume2, VolumeX } from "lucide-react";

export function VolumeControl({ volume, onChange, onToggleMute }: {
  volume: number;
  onChange: (value: number) => void;
  onToggleMute: () => void;
}) {
  return (
    <div className="flex w-full items-center gap-2">
      <button
        type="button"
        onClick={onToggleMute}
        aria-label={volume === 0 ? "Unmute" : "Mute"}
        aria-pressed={volume === 0}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-300 transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
      >
        {volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label="Volume"
        aria-valuetext={`${Math.round(volume * 100)}%`}
        className="h-8 min-w-0 flex-1 cursor-pointer accent-emerald-400"
      />
    </div>
  );
}
