import type { MapPoint, ScienceNote, SiteImage } from '../types';

/** Real rover images for the clicked point, each with its NASA credit. */
export function ImagePanel({
  point,
  images,
  science = [],
  onClose,
}: {
  point: MapPoint;
  images: SiteImage[];
  science?: ScienceNote[];
  onClose: () => void;
}) {
  const shown = images.filter((im) => im.point_ids.includes(point.id));
  const notes = science.filter((n) => n.point_ids.includes(point.id));
  return (
    <section className="panel image-panel">
      <div className="row">
        <h2>{point.name}</h2>
        <button className="close" onClick={onClose} aria-label="Close">×</button>
      </div>
      {point.note && <p className="muted">{point.note}</p>}
      {point.type === 'sample' && (
        <p className="muted">Sample positions are notional: use these images to pick the real spot on the rock.</p>
      )}
      {shown.length === 0 && <p className="muted">No images for this point yet.</p>}
      {notes.map((n) => (
        <div key={n.id} className="science-note">
          <h4>{n.title}</h4>
          {n.paragraphs.map((t, i) => <p key={i}>{t}</p>)}
          {n.eva_note && <p className="eva-note">{n.eva_note}</p>}
          <ul>
            {n.sources.map((s) => (
              <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></li>
            ))}
          </ul>
        </div>
      ))}
      {shown.map((im) => (
        <figure key={im.id}>
          <a href={im.src} target="_blank" rel="noreferrer">
            <img src={im.src} alt={im.title} />
          </a>
          <figcaption>
            <strong>{im.title}</strong>
            <span>{im.caption}</span>
            <small>
              {im.credit} | {im.camera} | Sol {im.sol} ({im.date}) |{' '}
              <a href={im.source_url} target="_blank" rel="noreferrer">{im.id}</a>
            </small>
          </figcaption>
        </figure>
      ))}
    </section>
  );
}
