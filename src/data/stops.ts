import { rockSamples } from './rocks';
/** DEMO ONLY. These coordinates/images are synthetic and DO NOT represent rover localization. */
export type Stop = {
  id: string; label: string; sol: number | null; camera: string;
  x: number; y: number; headingOffsetDeg: number;
  image: string; neighbors: string[]; description: string;
};
export const stops: Stop[] = [
  {id:'approach',label:'Approach viewpoint',sol:null,camera:'HiRISE terrain reconstruction',x:17,y:72,headingOffsetDeg:0,image:'/panoramas/approach.svg',neighbors:['bright-angel'],description:'Survey the approach to Bright Angel.'},
  {id:'bright-angel',label:'Bright Angel overlook',sol:null,camera:'HiRISE terrain reconstruction',x:49,y:47,headingOffsetDeg:0,image:'/panoramas/bright-angel.svg',neighbors:['approach','outcrop'],description:'Inspect mineral-bearing mudstone at Cheyava Falls.'},
  {id:'outcrop',label:'Layered outcrop',sol:null,camera:'HiRISE terrain reconstruction',x:77,y:27,headingOffsetDeg:0,image:'/panoramas/outcrop.svg',neighbors:['bright-angel'],description:'Compare bedding and fine-grained sedimentary textures.'}
];
export const stopById = Object.fromEntries(stops.map(s=>[s.id,s])) as Record<string, Stop>;
export type Instrument = 'camera'|'pixl'|'sherloc';
export type ScienceTarget = {id:string;title:string;kind:'mineral'|'layers'|'rock';stopId:string;yaw:number;pitch:number;description:string};
export const targets: ScienceTarget[] = [
 ...rockSamples.map(rock=>({id:rock.id,title:rock.name,kind:'rock' as const,stopId:'bright-angel',yaw:0,pitch:0,description:rock.summary})),
 {id:'cheyava',title:'Cheyava Falls: mineral evidence',kind:'mineral',stopId:'bright-angel',yaw:24,pitch:-6,description:'Explore published evidence for vivianite- and greigite-related mineral associations.'},
 {id:'layers',title:'Bright Angel: sedimentary layers',kind:'layers',stopId:'outcrop',yaw:-28,pitch:-4,description:'Inspect fine-grained mudstone and the role of ancient water.'}
];
export const missionTasks = [
 {id:'visit',title:'Reach the Cheyava Falls survey zone'},
 {id:'spots',title:'Inspect pale cores and dark rims in leopard-spotted mudstone'},
 {id:'minerals',title:'Identify vivianite rims and greigite interiors in the same leopard-spotted rock'},
 {id:'isotopes',title:'Review the isotopic fractionation test plan for vivianite and greigite'},
 {id:'layers',title:'Inspect bedding in the layered mudstone outcrop'}
];
