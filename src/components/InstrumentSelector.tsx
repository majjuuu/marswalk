import { useHUD } from '../store';
import type { Instrument } from '../data/stops';
const options:{id:Instrument;label:string}[]=[{id:'camera',label:'CAMERA'},{id:'pixl',label:'PIXL'},{id:'sherloc',label:'SHERLOC'}];
export function InstrumentSelector(){
 const selected=useHUD(s=>s.instrument),change=useHUD(s=>s.setInstrument);
 return <section className="instruments"><div className="panel-heading">INSTRUMENT DATA</div><div className="instrument-buttons">{options.map(o=><button key={o.id} onClick={()=>change(o.id)} className={selected===o.id?'selected':''}>{o.label}</button>)}</div><p className="small-muted">{selected==='camera'?'Camera exploration view. Scenes are synthetic demo artwork.':selected==='pixl'?'PIXL: elemental measurements and published mineral interpretations; open a science target for original NASA sources.':'SHERLOC: Raman / fluorescence studies; only historical findings are linked, not simulated live scans.'}</p></section>;
}
