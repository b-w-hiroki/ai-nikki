const { chromium } = require('playwright');
const { createServer } = require('node:http');
const { readFileSync, mkdirSync } = require('node:fs');
const assert = require('node:assert/strict');
const source=readFileSync('js/photo.js','utf8');
// Isolated module fixture: no diaries, credentials, cloud or app-wide initialization.
const html='<input id="photoInput" type="file"><div id="photoPreview"><img id="photoImg"></div><script type="module">import {Photo} from "/photo.js";window.Photo=Photo;</script>';
const server=createServer((req,res)=>{
 if(req.url==='/')res.writeHead(200,{'Content-Type':'text/html'}).end(html);
 else if(req.url==='/photo.js')res.writeHead(200,{'Content-Type':'application/javascript'}).end(source);
 else if(/^\/(?:app\.html|manifest\.json|(?:js|css|assets)\/[a-zA-Z0-9_./-]+)$/.test(req.url)&&!req.url.includes('..')){try{const ext=req.url.split('.').pop();res.writeHead(200,{'Content-Type':({html:'text/html',js:'application/javascript',css:'text/css',png:'image/png',json:'application/json'})[ext]||'application/octet-stream'}).end(readFileSync('.'+req.url));}catch{res.writeHead(404).end();}}
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
  assert.deepEqual(errors,[]);console.log('PASS module',JSON.stringify(result));
  const ui=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const origin=`http://127.0.0.1:${server.address().port}`;
  await ui.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  const app=await ui.newPage();const uiErrors=[];app.on('pageerror',e=>uiErrors.push(e.message));
  await app.goto(origin+'/app.html');await app.locator('#onboardSkip').click();
  const png=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=1600;c.height=1200;c.getContext('2d').fillStyle='orange';c.getContext('2d').fillRect(0,0,1600,1200);return c.toDataURL('image/png').split(',')[1];});
  const payload={name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')};
  await app.locator('#photoInput').setInputFiles(payload);
  await app.waitForFunction(()=>document.querySelector('#photoImg').naturalWidth===800);
  const saved=await app.locator('#photoImg').getAttribute('src');
  await app.locator('#photoInput').setInputFiles({name:'broken.png',mimeType:'image/png',buffer:Buffer.from('invalid')});
  await app.getByText(/この写真は開けませんでした/).waitFor();
  assert.equal(await app.locator('#photoImg').getAttribute('src'),saved);
  await app.locator('#photoRemove').click();assert.equal(await app.locator('#photoPreview').isVisible(),false);
  await app.locator('#photoInput').setInputFiles(payload);await app.locator('#photoPreview').waitFor({state:'visible'});
  assert.equal(await app.locator('#photoInput').inputValue(),'');
  await app.locator('#diaryText').fill('Synthetic browser QA diary');
  await app.locator('#saveBtn').click();
  await app.reload();
  assert.equal(await app.locator('#diaryText').inputValue(),'Synthetic browser QA diary');
  await app.waitForFunction(()=>document.querySelector('#photoImg').naturalWidth===800);
  assert.equal(await app.locator('#photoImg').getAttribute('src'),saved);
  await app.locator('#nav-calendar').click();await app.locator('.day-cell.today.has-entry').click();
  await app.getByText(/📖.*Synthetic browser QA diary/).waitFor();
  await app.locator('#nav-home').click();
  assert.equal(await app.locator('#diaryText').inputValue(),'Synthetic browser QA diary');
  assert.equal(await app.locator('#photoImg').getAttribute('src'),saved);
  mkdirSync('qa-artifacts',{recursive:true});
  for(const width of [390,1280]){await app.setViewportSize({width,height:844});await app.locator('#photoPreview').scrollIntoViewIfNeeded();await app.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));assert.equal(await app.evaluate(()=>document.querySelector('#photoPreview').getBoundingClientRect().bottom<=document.querySelector('.bottom-nav').getBoundingClientRect().top),true);assert.equal(await app.evaluate(()=>document.querySelector('#saveBtn').getBoundingClientRect().bottom<=document.querySelector('.bottom-nav').getBoundingClientRect().top),true);await app.screenshot({path:`qa-artifacts/photo-${width}.png`});}
  await app.locator('#photoRemove').click();await app.locator('#saveBtn').click();await app.reload();
  assert.equal(await app.locator('#photoPreview').isVisible(),false);
  assert.equal(await app.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('ai-nikki-photos')||'{}')).length),0);
  assert.deepEqual(uiErrors,[]);console.log('PASS app.html file input, broken-image toast/preservation, remove/reselect, saved diary/photo reload, calendar roundtrip, explicit remove-save-reload does not resurrect photo, preview/save above navigation, 390/1280 viewport screenshots; SW and external CDNs blocked');
  await ui.close();
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
