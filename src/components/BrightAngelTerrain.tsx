import { useCallback, useEffect, useMemo } from 'react';
import { useLoader, useThree } from '@react-three/fiber';
import { Html, useTexture } from '@react-three/drei';
import * as THREE from 'three';

import { FieldDetails } from './FieldDetails';
import { useHUD } from '../store';
import { cameraClearance, geographicPosition, locationPoints } from '../data/geography';

type Terrain = {size:number; resolution:number; heights:number[]};
export function BrightAngelTerrain(){
 const position=useHUD(s=>s.position);
 const selectTarget=useHUD(s=>s.selectTarget);
 const raw=useLoader(THREE.FileLoader,'/terrain/bright-angel.json') as string;
 const terrain=useMemo(()=>JSON.parse(raw) as Terrain,[raw]);
 const texture=useTexture('/terrain/bright-angel.webp');
 const {camera}=useThree();
 const geometry=useMemo(()=>{
  const {size,resolution:n,heights}=terrain;
  const mesh=new THREE.PlaneGeometry(size,size,n-1,n-1);
  mesh.rotateX(-Math.PI/2);
  const positions=mesh.attributes.position;
  const baseline=heights[Math.floor(n*n/2)];
  for(let i=0;i<heights.length;i++)positions.setY(i,heights[i]-baseline);
  mesh.computeVertexNormals();return mesh;
 },[terrain]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 useEffect(()=>{texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;texture.needsUpdate=true;},[texture]);
 const heightAt=useCallback((x:number,z:number)=>{
  const {resolution:n,size,heights}=terrain;
  const col=THREE.MathUtils.clamp((x/size+0.5)*(n-1),0,n-1.000001),row=THREE.MathUtils.clamp((z/size+0.5)*(n-1),0,n-1.000001);
  const ix=Math.floor(col),iz=Math.floor(row),fx=col-ix,fz=row-iz;
  // Interpolate the same triangles used by PlaneGeometry, so the camera stays above the mesh.
  const a=heights[iz*n+ix],b=heights[(iz+1)*n+ix],c=heights[iz*n+ix+1],d=heights[(iz+1)*n+ix+1];
  return (fx+fz<=1?a+(c-a)*fx+(b-a)*fz:d+(b-d)*(1-fx)+(c-d)*(1-fz))-heights[Math.floor(n*n/2)];
 },[terrain]);
 useEffect(()=>{
  const [x,z]=position;
  camera.position.set(x,heightAt(x,z)+cameraClearance,z);
  if(Math.hypot(...position)<30)useHUD.getState().complete('visit');
  // Position changes come from either ground clicks or named viewpoint navigation.
 },[camera,position,heightAt]);
 useEffect(()=>{camera.rotation.set(-0.3,0,0);},[camera]);
 return <>
  <color attach="background" args={['#b99a7e']}/>
  <fog attach="fog" args={['#b99a7e',200,720]}/>
  <hemisphereLight args={['#f5d9b0','#514137',2.1]}/>
  <directionalLight position={[-300,240,-180]} intensity={2.3} color="#fff0d9" castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-220} shadow-camera-right={220} shadow-camera-top={220} shadow-camera-bottom={-220} shadow-camera-far={1000} shadow-normalBias={0.08}/>
  <mesh receiveShadow name="walkable-terrain" geometry={geometry}><meshStandardMaterial map={texture} color="#c8a388" roughness={1}/></mesh>
  <FieldDetails heightAt={heightAt}/>
  {locationPoints.map(point=>{
   const [x,z]=point.position;const geo=geographicPosition(x,z);
   return <group key={point.id} position={[x,heightAt(x,z)+2,z]}>
    <mesh><sphereGeometry args={[1.5,12,8]}/><meshBasicMaterial color="#8af3dc"/></mesh>
    <Html center position={[0,5,0]} zIndexRange={[2,0]} style={{pointerEvents:'auto'}}>
     <button className="scene-hotspot geo-marker" onClick={()=>{if(point.target)selectTarget(point.target);else useHUD.getState().jump(point.id);}}>
      <strong>{point.name}</strong><small>{geo.latitude.toFixed(5)}° N · {geo.longitude.toFixed(5)}° E</small>
     </button>
    </Html>
   </group>;
  })}
 </>;
}
