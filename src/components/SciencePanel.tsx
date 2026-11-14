import { ExternalLink, Layers3, X, FlaskConical } from 'lucide-react';
import { useHUD } from '../store';
import { targets } from '../data/stops';
export function SciencePanel(){
 const selectedId=useHUD(s=>s.selectedTargetId),close=useHUD(s=>s.selectTarget);
 const t=targets.find(t=>t.id===selectedId);if(!t)return null;
 const mineral=t.kind==='mineral';
 return <aside className="science-panel" role="dialog" aria-label={t.title} aria-modal="false">
  <div className="panel-heading"><span>{mineral?<FlaskConical size={16}/>:<Layers3 size={16}/>} SCIENCE INSPECTION</span><button aria-label="Close science panel" className="icon-btn" onClick={()=>close(null)}><X size={18}/></button></div>
  <div className="science-scroll">
   <h2>{t.title}</h2>
   <p className="small-muted">Published NASA scientific observations · not live instrument data</p>
   {mineral?<>
    <div className="science-image"><img src="/map/mineral-diagram.svg" alt="Illustrative mineral association diagram, not a PIXL product"/><span>DIAGRAM · NOT REAL PIXL DATA</span></div>
    <h3>Mineral evidence</h3>
    <p><b>Vivianite</b> is a hydrated iron phosphate (Fe₃(PO₄)₂·8H₂O). <b>Greigite</b> is an iron sulfide (Fe₃S₄). NASA has reported associations consistent with these minerals at Cheyava Falls.</p>
    <p>The minerals may reflect low-temperature water-related redox chemistry. Biological origin is <b>not established</b>; nonbiological explanations remain possible.</p>
    <a href="https://science.nasa.gov/photojournal/perseverances-pixl-finds-vivianite-greigite-in-cheyava-falls-sample/" target="_blank" rel="noreferrer">Open NASA PIXL mineral map <ExternalLink size={13}/></a>
    <a href="https://www.nature.com/articles/s41586-025-09413-0" target="_blank" rel="noreferrer">Read scientific study <ExternalLink size={13}/></a>
   </>:<>
    <div className="science-image"><img src="/map/layers-diagram.svg" alt="Illustration of fine sedimentary layers"/><span>CONCEPTUAL SECTION · NOT REAL ROVER IMAGE</span></div>
    <h3>Layered mudstones</h3>
    <p>Bright Angel has fine-grained mudstone beds. Clay and silt record deposition in ancient water-rich environments. Comparing thickness, grain size, and bedding helps interpret how conditions changed.</p>
    <p>Look for differences in layer geometry and texture. Image appearance alone cannot prove exact sediment composition or age.</p>
    <a href="https://science.nasa.gov/mission/mars-2020-perseverance/" target="_blank" rel="noreferrer">NASA Perseverance mission <ExternalLink size={13}/></a>
   </>}
   <p className="small-muted">✓ Objective completed automatically · E to return to terrain</p>
  </div>
 </aside>;
}
