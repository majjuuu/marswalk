/** USGS Mars 2000 sphere / equirectangular local coordinates. +x east, +z south. */
export const terrainCenter = { longitude:77.30519, latitude:18.49748 };
export const terrainSize = 1024;
export const cameraClearance = 18;
export const viewpoints:Record<string,[number,number]> = {
 approach:[90,90], 'bright-angel':[0,0], outcrop:[-55,-40],
};
export function geographicPosition(x:number,z:number){
 const degreesPerMeter=180/(Math.PI*3396190);
 return {longitude:terrainCenter.longitude+x*degreesPerMeter,latitude:terrainCenter.latitude-z*degreesPerMeter};
}
export const locationPoints = [
 {id:'cheyava',name:'Cheyava Falls',position:[0,0] as [number,number],note:'Bright Angel · crop reference location',target:'cheyava'},
 {id:'approach',name:'Bright Angel approach',position:viewpoints.approach,note:'Illustrative viewpoint',target:null},
 {id:'outcrop',name:'Layered outcrop viewpoint',position:viewpoints.outcrop,note:'Illustrative viewpoint',target:'layers'},
];
