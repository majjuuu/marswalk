import { useEffect } from 'react';
import { ExternalLink, X, FlaskConical } from 'lucide-react';
import { InstrumentSelector } from './InstrumentSelector';
import { useHUD } from '../store';
import { targets } from '../data/stops';
import { leopardPhoto, leopardPhotoSource, mineralSource, mineralSummary, rockById } from '../data/rocks';
export function SciencePanel(){
 const selectedId=useHUD(s=>s.selectedTargetId),close=useHUD(s=>s.selectTarget),done=useHUD(s=>s.completed),complete=useHUD(s=>s.complete),instrument=useHUD(s=>s.instrument);
 const hasMinerals=!!done.spots&&!!done.minerals;
 const isotopeRelevant=selectedId==='cheyava'||selectedId==='leopard';
 useEffect(()=>{if(isotopeRelevant&&instrument==='camera'&&hasMinerals&&!done.isotopes)complete('isotopes');},[isotopeRelevant,instrument,hasMinerals,done.isotopes,complete]);
 const target=targets.find(t=>t.id===selectedId);if(!target)return null;
 const rock=rockById[target.id];
 return <aside className="science-panel mineral-summary" role="dialog" aria-label={target.title} aria-modal="false">
  <div className="panel-heading"><span><FlaskConical size={16}/> {rock?'ROCK INSPECTION':'FIELD NOTES'}</span><button aria-label="Close summary" className="icon-btn" onClick={()=>close(null)}><X size={18}/></button></div>
  <div className="science-scroll">
   <h2>{target.title}</h2>
   {isotopeRelevant&&<InstrumentSelector/>}
   <div role={isotopeRelevant?'tabpanel':undefined} id={isotopeRelevant?`mineral-panel-${instrument}`:undefined} aria-labelledby={isotopeRelevant?`mineral-tab-${instrument}`:undefined} tabIndex={isotopeRelevant?0:undefined}>
   {isotopeRelevant&&instrument==='pixl'?<>
    <h3>Elemental chemistry</h3>
    <p>PIXL uses X-ray fluorescence to map elemental composition. At Cheyava Falls, chemistry supports vivianite in dark rims and greigite within leopard-spot interiors.</p>
    <dl className="mineral-evidence"><dt>Vivianite · iron phosphate</dt><dd>Iron and phosphorus associations help interpret phosphate-bearing reaction fronts.</dd><dt>Greigite · iron sulfide</dt><dd>Iron and sulfur associations help interpret sulfide-bearing spot interiors.</dd></dl>
    <p className="small-muted">Mineral identifications are interpretations of published data, rather than a new scan of the displayed rock.</p>
    <a href={mineralSource} target="_blank" rel="noreferrer">NASA PIXL mineral map <ExternalLink size={12}/></a>
   </>:isotopeRelevant&&instrument==='sherloc'?<>
    <h3>Organics & mineral context</h3>
    <p>SHERLOC uses ultraviolet Raman and fluorescence spectroscopy to investigate minerals and organic compounds. It detected organic compounds in Cheyava Falls.</p>
    <p>Consider the organic evidence alongside the vivianite–greigite reaction fronts. Organic compounds and mineral associations can have nonbiological origins; they do not establish life on their own.</p>
    <p className="small-muted">Published observations · no live spectrum is generated.</p>
    <a href="https://www.nasa.gov/missions/mars-2020-perseverance/perseverance-rover/nasas-perseverance-rover-scientists-find-intriguing-mars-rock/" target="_blank" rel="noreferrer">NASA SHERLOC findings <ExternalLink size={12}/></a>
   </>:isotopeRelevant?<>
    <figure className="rock-photo"><img src={leopardPhoto} alt="Perseverance photograph of Cheyava Falls showing pale leopard spots, dark rims, and white veins"/><figcaption>NASA/JPL-Caltech/MSSS · PIA26368</figcaption></figure>
    <h3>Vivianite & greigite</h3>
    <p>{mineralSummary}</p>
   </>:<p>Fine-grained mudstone beds record sediment deposition in ancient water-rich environments. Compare bedding geometry and texture to investigate changing conditions.</p>}

   {isotopeRelevant&&instrument==='camera'&&<section className="isotope-exercise">
    <h3>Isotopic fractionation test plan</h3>
    <p className="small-muted">Proposed laboratory steps · no measurements performed</p>
    <ol className="test-plan-steps">
     <li>Document the leopard-spot rims, interiors, and surrounding mudstone.</li>
     <li>Isolate vivianite- and greigite-bearing material from the same rock, retaining unaltered matrix and procedural blanks as controls.</li>
     <li>Measure relevant iron and sulfur isotope ratios using validated laboratory methods and reference standards.</li>
     <li>Compare mineral-associated ratios with the controls and plausible nonbiological fractionation pathways.</li>
     <li>Report uncertainty and assess the results alongside mineral chemistry and rock context.</li>
    </ol>
   </section>}
   </div>
   <details className="science-details"><summary>Source & sample context</summary>
    {rock&&<p className="small-muted">Real Perseverance photograph projected onto a simplified rock mesh. Rock shape and placement are educational.</p>}
    {isotopeRelevant&&<a href={leopardPhotoSource} target="_blank" rel="noreferrer">Original rock photograph <ExternalLink size={12}/></a>}
    <a href={mineralSource} target="_blank" rel="noreferrer">NASA observations <ExternalLink size={12}/></a>
   </details>
   <p className="small-muted">{isotopeRelevant?'1 Summary · 2 PIXL · 3 SHERLOC · E Return':'E · Return to terrain'}</p>
  </div>
 </aside>;
}
