import type { MapPoint, SiteImage } from '../types';

/** Real rover images for the clicked point, each with its NASA credit. */
export function ImagePanel({ point, images, onClose }: { point: MapPoint; images: SiteImage[]; onClose: () => void }) {
  const shown = images.filter((im) => im.point_ids.includes(point.id));
  return (
    <section className="panel image-panel">
      <div className="row">
        <h3>{point.name}</h3>
        <button className="close" onClick={onClose} aria-label="Close">x</button>
      </div>
      {point.note && <p className="muted">{point.note}</p>}
      {point.type === 'sample' && (
        <p className="muted">Sample positions are notional: use these images to pick the real spot on the rock.</p>
      )}
      {shown.length === 0 && <p className="muted">No images for this point yet.</p>}
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
