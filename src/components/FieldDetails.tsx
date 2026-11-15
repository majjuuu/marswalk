import { useEffect, useMemo } from 'react';
import { Html, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { leopardPhoto, rockSamples } from '../data/rocks';
import { useHUD } from '../store';

type HeightAt=(x:number,z:number)=>number;
function SampleRock({sample,heightAt}:{sample:typeof rockSamples[number];heightAt:HeightAt}){
 const select=useHUD(s=>s.selectTarget);
 const texture=useTexture(leopardPhoto);
 useEffect(()=>{texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;texture.needsUpdate=true;},[texture]);
 const geometry=useMemo(()=>{
  const geometry=new THREE.IcosahedronGeometry(1,4);
  const positions=geometry.attributes.position;
  const uv=new Float32Array(positions.count*2);
  for(let i=0;i<positions.count;i++){
   const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i);
   const bump=1+0.06*Math.sin(x*19+z*13)*Math.cos(y*17);
   positions.setXYZ(i,x*bump,y*bump,z*bump);
   // Planar projection preserves the photograph on the rock's upper face.
   uv[i*2]=(x+1)/2;uv[i*2+1]=(1-z)/2;
  }
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
  geometry.computeVertexNormals();return geometry;
 },[]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 const [x,z]=sample.position;
 return <group position={[x,heightAt(x,z)+0.55,z]}>
  <mesh castShadow receiveShadow name={`sample-${sample.id}`} geometry={geometry} scale={[2.2,0.85,1.6]} rotation={[0.06,0,0.04]} userData={{scienceTarget:sample.id}} onClick={e=>{e.stopPropagation();select(sample.id);}}>
   <meshStandardMaterial map={texture} color="white" roughness={0.96}/>
  </mesh>
  <Html center position={[0,3,0]} zIndexRange={[2,0]}>
   <button className="rock-label scene-hotspot" onClick={()=>select(sample.id)}>Cheyava Falls · leopard spots</button>
  </Html>
 </group>;
}
export function FieldDetails({heightAt}:{heightAt:HeightAt}){
 return <>{rockSamples.map(sample=><SampleRock key={sample.id} sample={sample} heightAt={heightAt}/>)}</>;
}
