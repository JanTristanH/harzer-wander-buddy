import React from 'react';
import { AbsoluteFill, Composition, Easing, Img, interpolate, registerRoot, staticFile, useCurrentFrame } from 'remotion';
const ease = Easing.inOut(Easing.cubic);
export function BuddyMap() {
 const frame = useCurrentFrame();
 const mapY = interpolate(frame,[0,24,54,150,205,240],[440,440,270,270,440,440],{easing:ease,extrapolateRight:'clamp'});
 const look = interpolate(frame,[0,52,72,97,122,148,175,205,240],[0,0,-6,-6,6,6,0,0,0],{easing:ease,extrapolateRight:'clamp'});
 const gazeY = interpolate(frame,[0,30,60,170,210,240],[0,0,5,5,0,0],{easing:ease,extrapolateRight:'clamp'});
 const tilt = interpolate(frame,[0,54,95,145,205,240],[0,-1,-1,1,0,0],{easing:ease,extrapolateRight:'clamp'});
 return <AbsoluteFill style={{background:'#f5f3ee',overflow:'hidden'}}>
  <div style={{position:'absolute',width:720,height:960,transform:'scale(.75)',transformOrigin:'top left'}}>
   <div style={{position:'absolute',inset:0,transform:`rotate(${tilt}deg)`,transformOrigin:'360px 520px'}}>
    <Img src={staticFile('buddy-portrait.png')} style={{position:'absolute',left:0,top:50,width:720,height:720}} />
    <svg width="720" height="960" style={{position:'absolute',inset:0}}>
     {[268,437].map((x,i)=><ellipse key={i} cx={x+look} cy={326+gazeY} rx="9" ry="13" fill="#32190e"/>)}
    </svg>
   </div>
   <Img src={staticFile('buddy-map.png')} style={{position:'absolute',left:0,top:mapY,width:720,height:480,transform:`rotate(${-tilt*.35}deg)`,transformOrigin:'50% 80%'}} />
  </div>
 </AbsoluteFill>;
}
const Root=()=> <Composition id="BuddyMap" component={BuddyMap} width={540} height={720} fps={60} durationInFrames={240}/>;
registerRoot(Root);
