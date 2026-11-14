import type { Warning } from '../engine';

export function Banner({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="banners">
      {warnings.map((w) => (
        <div key={w.text} className={`banner banner-${w.level}`}>{w.text}</div>
      ))}
    </div>
  );
}
