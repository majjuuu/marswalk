import { useHUD } from '../store';
import type { Instrument } from '../data/stops';
const options:{id:Instrument;label:string}[]=[{id:'camera',label:'Summary'},{id:'pixl',label:'PIXL'},{id:'sherloc',label:'SHERLOC'}];
/** Instrument tabs live inside the mineral inspection dialog. */
export function InstrumentSelector(){
 const selected=useHUD(s=>s.instrument),change=useHUD(s=>s.setInstrument);
 return <div className="mineral-tabs" role="tablist" aria-label="Mineral inspection views">
  {options.map((option,index)=><button key={option.id} id={`mineral-tab-${option.id}`} role="tab" aria-selected={selected===option.id} aria-controls={`mineral-panel-${option.id}`} tabIndex={selected===option.id?0:-1} data-science-tab={index+1} onClick={()=>change(option.id)} onKeyDown={e=>{
   let next=index;
   if(e.key==='ArrowRight')next=(index+1)%options.length;
   else if(e.key==='ArrowLeft')next=(index+options.length-1)%options.length;
   else if(e.key==='Home')next=0;
   else if(e.key==='End')next=options.length-1;
   else return;
   e.preventDefault();change(options[next].id);document.getElementById(`mineral-tab-${options[next].id}`)?.focus();
  }}>{option.label}</button>)}
 </div>;
}
