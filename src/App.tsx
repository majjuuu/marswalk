import { useEffect } from 'react';
import { Compass, ChevronLeft, ChevronRight, ClipboardList, Radar } from 'lucide-react';
import { useHUD } from './store';
import { missionTasks, stopById } from './data/stops';
import { PanoramaViewer } from './components/PanoramaViewer';
import { RoverMiniMap } from './components/RoverMiniMap';
import { SciencePanel } from './components/SciencePanel';
import { MissionChecklist } from './components/MissionChecklist';
function App(){
 const stopId=useHUD(s=>s.currentStopId),jump=useHUD(s=>s.jump),heading=useHUD(s=>s.headingDeg),toggle=useHUD(s=>s.toggleMission),completed=useHUD(s=>s.completed);
 const stop=stopById[stopId];
 useEffect(()=>{function keys(e:KeyboardEvent){if(e.target instanceof HTMLInputElement||e.target instanceof HTMLButtonElement)return;const i=stop.neighbors.findIndex(s=>s===stopId);void i;if(e.key==='ArrowRight'&&stop.neighbors[0])jump(stop.neighbors[0]);if(e.key==='Escape')useHUD.getState().selectTarget(null);}window.addEventListener('keydown',keys);return()=>window.removeEventListener('keydown',keys);},[stop,jump,stopId]);
 return <main className="app">
  <PanoramaViewer/>
  <div className="hud-top"><div className="brand"><div className="brand-mark"><Radar size={22}/></div><div><strong>MARSWALK</strong><span>BRIGHT ANGEL · SURFACE HUD</span></div></div><div className="top-right"><button className="hud-button" onClick={toggle}><ClipboardList size={16}/> Missions</button></div></div>
  <div className="left-rail"><div className="status-card"><span className="eyebrow">NEAREST VIEWPOINT</span><h1>{stop.label}</h1><p>{stop.description}</p><div className="status-row"><span><Compass size={14}/> {Math.round(heading)}° heading</span></div></div></div>
  <div className="right-rail"><RoverMiniMap/></div>
  <div className="bottom-controls"><div className="viewpoint-nav"><span className="eyebrow">JUMP TO VIEWPOINT</span><div className="nav-stops">{stop.neighbors.map((id,i)=><button key={id} className="nav-stop" onClick={()=>jump(id)}>{i===0?<ChevronLeft size={16}/>:<ChevronRight size={16}/>} {stopById[id].label}</button>)}</div></div></div>
  <SciencePanel/><MissionChecklist/>
  <div className="progress-pill">MISSION PROGRESS {missionTasks.filter(task=>completed[task.id]).length}/{missionTasks.length}</div>
 </main>;
}
export default App;
