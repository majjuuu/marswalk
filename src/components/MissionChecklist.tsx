import { X, ClipboardList } from 'lucide-react';
import { missionTasks } from '../data/stops';
import { useHUD } from '../store';
export function MissionChecklist(){
 const shown=useHUD(s=>s.showMission),toggle=useHUD(s=>s.toggleMission),completed=useHUD(s=>s.completed);
 if(!shown)return null;
 return <aside className="mission-panel"><div className="panel-heading"><span><ClipboardList size={16}/> MISSION CHECKLIST</span><button aria-label="Close checklist" className="icon-btn" onClick={toggle}><X size={18}/></button></div>
 <p>Visit Bright Angel and open the named science markers. Objectives check off automatically as you explore.</p>
 {missionTasks.map(t=><label className="task" key={t.id}><input type="checkbox" checked={!!completed[t.id]} readOnly/><span>{t.title}</span></label>)}
 <div className="small-muted">{missionTasks.filter(t=>completed[t.id]).length} / {missionTasks.length} observations complete</div></aside>;
}
