import { create } from 'zustand';
import { stopById, targets, type Instrument } from './data/stops';
import { terrainSize, viewpoints } from './data/geography';
type State = {
 currentStopId:string; position:[number,number]; headingDeg:number; instrument:Instrument; selectedTargetId:string|null;
 completed:Record<string,boolean>; showMission:boolean;
 jump:(destination:string)=>void; moveTo:(x:number,z:number)=>void; setHeading:(n:number)=>void; setInstrument:(v:Instrument)=>void;
 selectTarget:(id:string|null)=>void; complete:(id:string)=>void; toggleMission:()=>void;
};
export const useHUD = create<State>((set)=>({
 currentStopId:'bright-angel',position:[0,0],headingDeg:0,instrument:'camera',selectedTargetId:null,completed:{},showMission:false,
 jump:(destination)=>{if(!stopById[destination])return;set(s=>({currentStopId:destination,position:[...viewpoints[destination]],selectedTargetId:null,completed:{...s.completed,...(destination==='bright-angel'?{visit:true}:{})}}));},
 moveTo:(x,z)=>{
  if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>=terrainSize/2||Math.abs(z)>=terrainSize/2)return;
  const nearest=Object.entries(viewpoints).sort((a,b)=>Math.hypot(x-a[1][0],z-a[1][1])-Math.hypot(x-b[1][0],z-b[1][1]))[0][0];
  set(s=>({position:[x,z],currentStopId:nearest,completed:{...s.completed,...(Math.hypot(x,z)<30?{visit:true}:{})}}));
 },
 setHeading:(headingDeg)=>set({headingDeg}),setInstrument:(instrument)=>set({instrument}),
 selectTarget:(selectedTargetId)=>{const target=targets.find(t=>t.id===selectedTargetId);set(s=>({selectedTargetId:target?.id??null,instrument:'camera',completed:{...s.completed,...(target?.id==='leopard'?{spots:true,minerals:true}:target?.id==='cheyava'?{minerals:true}:target?.id==='layers'?{layers:true}:{})}}));},
 complete:(id)=>set(s=>({completed:{...s.completed,[id]:true}})),
 toggleMission:()=>set(s=>({showMission:!s.showMission}))
}));
