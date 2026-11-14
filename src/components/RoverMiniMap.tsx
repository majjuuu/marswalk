import { useHUD } from '../store';
import { geographicPosition, locationPoints, terrainSize } from '../data/geography';
export function RoverMiniMap(){
 const position=useHUD(s=>s.position),heading=useHUD(s=>s.headingDeg),moveTo=useHUD(s=>s.moveTo),select=useHUD(s=>s.selectTarget);
 const project=(n:number)=>(n/terrainSize+0.5)*250;
 const cx=project(position[0]),cy=project(position[1]);
 const geo=geographicPosition(...position);
 const alpha=(heading-90)*Math.PI/180,wing=0.34,radius=30;
 const points=[[cx,cy],[cx+radius*Math.cos(alpha-wing),cy+radius*Math.sin(alpha-wing)],[cx+radius*Math.cos(alpha+wing),cy+radius*Math.sin(alpha+wing)]];
 const activate=(point:typeof locationPoints[number])=>{moveTo(...point.position);if(point.target)select(point.target);};
 return <section className="minimap-panel" aria-label="Geographic location map">
  <div className="panel-heading"><span>BRIGHT ANGEL · HiRISE</span><span className="accent">N ↑</span></div>
  <svg viewBox="0 0 250 250" className="minimap" aria-label="USGS orbital imagery with geographic locations and camera position">
   <image href="/terrain/bright-angel.webp" width="250" height="250"/>
   <polygon points={points.map(p=>p.join(',')).join(' ')} fill="#70dfd2" opacity=".5"/>
   {locationPoints.map(point=><g key={point.id} role="button" tabIndex={0} className="minimap-stop" aria-label={point.name} onClick={()=>activate(point)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate(point);}}}>
    <circle cx={project(point.position[0])} cy={project(point.position[1])} r="6" fill="#ebad69" stroke="#11212c" strokeWidth="2"/>
    <title>{point.name}</title>
   </g>)}
   <circle cx={cx} cy={cy} r="4" fill="#7ce9d6" stroke="#18262e" strokeWidth="1"/>
   <path d="M 12 231 h 49 v -4 M 12 231 v -4" stroke="white" fill="none"/><text x="12" y="244" fill="white" fontSize="9">200 m</text>
  </svg>
  <div className="small-muted">{geo.latitude.toFixed(5)}° N · {geo.longitude.toFixed(5)}° E<br/>18 m above ground · heading {Math.round(heading)}°</div>
  <div className="location-list">{locationPoints.map(point=><button key={point.id} onClick={()=>activate(point)}>{point.name}</button>)}</div>
  <div className="small-muted">Orbital map · viewpoint positions illustrative</div>
 </section>;
}
