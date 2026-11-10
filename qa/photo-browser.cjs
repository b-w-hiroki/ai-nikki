const { chromium } = require('playwright');
const { createServer } = require('node:http');
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const source=readFileSync('js/photo.js','utf8');
// Isolated module fixture: no diaries, credentials, cloud or app-wide initialization.
const html='<input id="photoInput" type="file"><div id="photoPreview"><img id="photoImg"></div><script type="module">import {Photo} from "/photo.js";window.Photo=Photo;</script>';
const server=createServer((req,res)=>{
 if(req.url==='/')res.writeHead(200,{'Content-Type':'text/html'}).end(html);
 else if(req.url==='/photo.js')res.writeHead(200,{'Content-Type':'application/javascript'}).end(source);
 else res.writeHead(404).end();
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch();
 try{
  const context=await browser.newContext();const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.Photo);
  const result=await page.evaluate(async()=>{
   const check=(v,m)=>{if(!v)throw Error(m);};
   async function file(color,w=1600,h=1200){const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,w,h);return new File([await new Promise(r=>c.toBlob(r,'image/png'))],color+'.png',{type:'image/png'});}
   const red=await file('red'),blue=await file('blue');
   const first=await Photo.handleFileInput(red);check(first.startsWith('data:image/jpeg;'),'native jpeg');
   await document.querySelector('#photoImg').decode();check(document.querySelector('#photoImg').naturalWidth===800,'800px limit');check(Photo.isNew(),'new');
   Photo.loadExisting(first);
   try{await Photo.handleFileInput(new File(['invalid PNG'],'broken.png',{type:'image/png'}));throw Error('should reject');}catch(e){check(/写真|画像/.test(e.message),'decode rejection');}
   check(Photo.getCurrentBase64()===first&&!Photo.isNew(),'broken image preserves original');
   const expectedBlue=await Photo.handleFileInput(blue);
   const old=Photo.handleFileInput(red),latest=Photo.handleFileInput(blue);
   check(await old===null,'old selection discarded');check(await latest===expectedBlue,'latest selection wins');
   for(const action of ['remove','reset','loadExisting']){
    const pending=Photo.handleFileInput(red);Photo[action](first);check(await pending===null,action+' invalidates pending reader');
    check(Photo.getCurrentBase64()===(action==='loadExisting'?first:null),action+' protects current state');
   }
   Photo.remove();await Photo.handleFileInput(red);Photo.remove();await Photo.handleFileInput(red);check(Photo.getCurrentBase64()===first,'same image can be selected again');
   const thin=await file('green',1600,1);await Photo.handleFileInput(thin);await document.querySelector('#photoImg').decode();check(document.querySelector('#photoImg').naturalHeight===1,'thin image positive height');
   return {nativeFileReader:true,nativeCanvas:true,nativeDecode:true,brokenPreserves:true,latestWins:true,removeResetSwitch:true,reselection:true,thinImage:true};
  });
  assert.deepEqual(errors,[]);console.log('PASS',JSON.stringify(result));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
