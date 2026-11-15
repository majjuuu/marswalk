import { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import * as THREE from 'three';
import { BrightAngelTerrain } from './BrightAngelTerrain';
import { useHUD } from '../store';
import { normalize, toDeg } from '../lib/angles';

function MouseLook({onLock,onUnlock,onError}:{onLock:()=>void;onUnlock:()=>void;onError:()=>void}){
 const {camera,gl,scene}=useThree();
 useEffect(()=>{
  const canvas=gl.domElement;
  const controls=new PointerLockControls(camera,canvas);
  const raycaster=new THREE.Raycaster();
  const requestLock=()=>{
   if(document.pointerLockElement===canvas)return;
   try{Promise.resolve(canvas.requestPointerLock()).catch(onError);}catch{onError();}
  };
  const change=()=>{if(document.pointerLockElement===canvas)onLock();else onUnlock();};
  const click=(e:MouseEvent)=>{
   if(document.pointerLockElement!==canvas){requestLock();return;}
   e.stopImmediatePropagation();
   const state=useHUD.getState();
   // Inspect panels without losing mouse lock. E closes the panel; wheel scrolls it.
   if(state.selectedTargetId||state.showMission)return;
   const bounds=canvas.getBoundingClientRect();
   const x=bounds.left+bounds.width/2,y=bounds.top+bounds.height/2;
   const target=Array.from(document.querySelectorAll<HTMLButtonElement>('.geo-marker, .rock-label')).find(button=>{
    const rect=button.getBoundingClientRect();
    return rect.width>0&&x>=rect.left&&x<=rect.right&&y>=rect.top&&y<=rect.bottom;
   });
   if(target){target.click();return;}
   const terrain=scene.getObjectByName('walkable-terrain');
   if(!terrain)return;
   camera.updateMatrixWorld();terrain.updateMatrixWorld();
   raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
   const hits=raycaster.intersectObjects(scene.children,true).filter(hit=>hit.object===terrain||hit.object.userData.scienceTarget);
   const hit=hits[0];
   if(hit?.object.userData.scienceTarget)state.selectTarget(hit.object.userData.scienceTarget);
   else if(hit)state.moveTo(hit.point.x,hit.point.z);
  };
  const wheel=(e:WheelEvent)=>{
   e.preventDefault();
   const state=useHUD.getState();
   if(state.selectedTargetId){document.querySelector('.science-scroll')?.scrollBy({top:e.deltaY});return;}
   const c=camera as THREE.PerspectiveCamera;
   c.fov=THREE.MathUtils.clamp(c.fov+e.deltaY*0.025,35,90);c.updateProjectionMatrix();
  };
  const keys=(e:KeyboardEvent)=>{
   if(e.target instanceof HTMLInputElement||e.repeat)return;
   const state=useHUD.getState();
   if(e.code==='KeyE'){state.selectTarget(null);if(state.showMission)state.toggleMission();}
   if(e.code==='KeyM')state.toggleMission();
   if(state.selectedTargetId&&/^Digit[123]$/.test(e.code))document.querySelector<HTMLButtonElement>(`[data-science-tab="${e.code.slice(-1)}"]`)?.click();
  };
  // Reuse a preceding user gesture when navigation into this scene provides one.
  if(navigator.userActivation?.isActive)requestLock();
  canvas.addEventListener('click',click,true);
  canvas.addEventListener('wheel',wheel,{passive:false});
  document.addEventListener('pointerlockchange',change);
  document.addEventListener('pointerlockerror',onError);
  window.addEventListener('keydown',keys);
  return()=>{
   controls.dispose();
   canvas.removeEventListener('click',click,true);canvas.removeEventListener('wheel',wheel);
   document.removeEventListener('pointerlockchange',change);document.removeEventListener('pointerlockerror',onError);
   window.removeEventListener('keydown',keys);
  };
 },[camera,gl,scene,onLock,onUnlock,onError]);
 return null;
}
function HeadingTracker(){
 const setHeading=useHUD(s=>s.setHeading);const last=useRef(-1000);const dir=useRef(new THREE.Vector3());
 useFrame(({camera})=>{
  camera.getWorldDirection(dir.current);
  const n=normalize(toDeg(Math.atan2(dir.current.x,-dir.current.z)));
  if(last.current===-1000 || Math.abs(((n-last.current+540)%360)-180)>1.2){last.current=n;setHeading(n);}
 });return null;
}
export function PanoramaViewer(){
 const [locked,setLocked]=useState(false),[error,setError]=useState(false);
 // Stable callbacks keep the controls connected when the HUD changes.
 const callbacks=useRef({lock:()=>{setLocked(true);setError(false);},unlock:()=>setLocked(false),error:()=>setError(true)}).current;
 return <div className="panorama-shell" aria-label="Interactive Bright Angel terrain reconstruction">
  <Canvas shadows dpr={[1,2]} camera={{position:[0,18,0],fov:72,near:0.1,far:2000}} gl={{antialias:true}}>
   <color attach="background" args={['#b99a7e']}/>
   <Suspense fallback={<Html center><div className="terrain-loading">Loading Bright Angel terrain…</div></Html>}><BrightAngelTerrain/></Suspense>
   <MouseLook onLock={callbacks.lock} onUnlock={callbacks.unlock} onError={callbacks.error}/>
   <HeadingTracker/>
  </Canvas>
  {locked?<><div className="scene-reticle" aria-hidden="true"/><div className="walk-hint">Aim at ground and click to move · M missions · E close panel</div></>:<button id="enter-scene" className="lock-hint" onClick={()=>{
   const canvas=document.querySelector<HTMLCanvasElement>('.panorama-shell canvas');
   if(canvas)try{Promise.resolve(canvas.requestPointerLock()).catch(()=>setError(true));}catch{setError(true);}
  }}>{error?'Click to retry mouse look':'Enter terrain · click to begin mouse look'}</button>}

 </div>;
}
