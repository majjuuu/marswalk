export const toRad = (deg:number)=>deg*Math.PI/180;
export const toDeg = (rad:number)=>rad*180/Math.PI;
export const normalize = (degrees:number)=>(degrees%360+360)%360;
/** Convert a yaw angle and pitch into a point inside panorama sphere. */
export function sphericalPoint(yaw:number,pitch:number,radius=48):[number,number,number]{
 const y=toRad(yaw),p=toRad(pitch);
 return [radius*Math.cos(p)*Math.sin(y),radius*Math.sin(p),-radius*Math.cos(p)*Math.cos(y)];
}
export function sceneBearing(from:{x:number;y:number},to:{x:number;y:number}){
 return normalize(toDeg(Math.atan2(to.x-from.x,from.y-to.y)));
}
