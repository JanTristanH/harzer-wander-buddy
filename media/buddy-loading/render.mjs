import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
function run(command, args) {
  const result = spawnSync(command, args, {stdio:'inherit'});
  if (result.status !== 0) process.exit(result.status || 1);
}
const args=['remotion','render','src/index.tsx','BuddyMap','public/buddy-loading.mp4','--codec=h264','--crf=16','--concurrency=2'];
if(process.env.REMOTION_BROWSER_EXECUTABLE)args.push(`--browser-executable=${process.env.REMOTION_BROWSER_EXECUTABLE}`);
run('npx', args);
const target='../../app/assets/images/buddy';
mkdirSync(target,{recursive:true});
run('ffmpeg',['-v','error','-y','-i','public/buddy-loading.mp4','-vf','fps=24,scale=270:360','-loop','0','-c:v','libwebp','-quality','75',`${target}/map-loop.webp`]);
run('ffmpeg',['-v','error','-y','-ss','1.2','-i','public/buddy-loading.mp4','-frames:v','1',`${target}/map-poster.png`]);
