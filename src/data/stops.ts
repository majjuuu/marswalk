/** DEMO ONLY. These coordinates/images are synthetic and DO NOT represent rover localization. */
export type Stop = {
  id: string; label: string; sol: number | null; camera: string;
  x: number; y: number; headingOffsetDeg: number;
  image: string; neighbors: string[]; description: string;
};
export const stops: Stop[] = [
  {id:'approach',label:'Approach viewpoint',sol:null,camera:'HiRISE terrain reconstruction',x:17,y:72,headingOffsetDeg:0,image:'/panoramas/approach.svg',neighbors:['bright-angel'],description:'Illustrative camera position on USGS HiRISE terrain near Bright Angel.'},
  {id:'bright-angel',label:'Bright Angel overlook',sol:null,camera:'HiRISE terrain reconstruction',x:49,y:47,headingOffsetDeg:0,image:'/panoramas/bright-angel.svg',neighbors:['approach','outcrop'],description:'USGS elevation and orbital imagery of Bright Angel. Science marker bearings are illustrative.'},
  {id:'outcrop',label:'Layered outcrop',sol:null,camera:'HiRISE terrain reconstruction',x:77,y:27,headingOffsetDeg:0,image:'/panoramas/outcrop.svg',neighbors:['bright-angel'],description:'Illustrative camera position for exploring the terrain around Bright Angel.'}
];
export const stopById = Object.fromEntries(stops.map(s=>[s.id,s])) as Record<string, Stop>;
export type Instrument = 'camera'|'pixl'|'sherloc';
export type ScienceTarget = {id:string;title:string;kind:'mineral'|'layers';stopId:string;yaw:number;pitch:number;description:string};
export const targets: ScienceTarget[] = [
 {id:'cheyava',title:'Cheyava Falls: mineral evidence',kind:'mineral',stopId:'bright-angel',yaw:24,pitch:-6,description:'Explore published evidence for vivianite- and greigite-related mineral associations.'},
 {id:'layers',title:'Bright Angel: sedimentary layers',kind:'layers',stopId:'outcrop',yaw:-28,pitch:-4,description:'Inspect fine-grained mudstone and the role of ancient water.'}
];
export const missionTasks = [
 {id:'visit',title:'Visit the Bright Angel overlook'},
 {id:'mineral',title:'Review Cheyava Falls mineral evidence'},
 {id:'layers',title:'Inspect sedimentary layers'}
];
