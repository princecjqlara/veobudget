const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {pathToFileURL} = require('node:url');
const assert = require('node:assert/strict');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const qa = path.join(__dirname, '.qa');
fs.mkdirSync(qa, {recursive:true});
const profile = path.join(qa, 'chrome-profile-'+Date.now());
const browser = [process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
].find(candidate=>candidate&&fs.existsSync(candidate));
if(!browser)throw new Error('Set CHROME_PATH to a Chrome, Chromium, or Edge executable.');
const initialURL=process.env.CALCULATOR_URL||pathToFileURL(path.join(__dirname,'ad-budget-calculator.html')).href;
const child = spawn(browser, ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0','--user-data-dir='+profile,initialURL], {stdio:'ignore',windowsHide:true});
let socket;
const failures = [];
let checks = 0;
(async()=>{
  const portFile = path.join(profile, 'DevToolsActivePort');
  for(let i=0;i<150&&!fs.existsSync(portFile);i++)await wait(100);
  assert.ok(fs.existsSync(portFile),'Browser debugging port must be available');
  const port = fs.readFileSync(portFile,'utf8').split('\n')[0].trim();
  let tabs;
  for(let i=0;i<80;i++){
    tabs=await (await fetch('http://127.0.0.1:'+port+'/json/list')).json();
    if(tabs.some(t=>t.url.startsWith(initialURL)))break;
    await wait(100);
  }
  const tab=tabs.find(t=>t.url.startsWith(initialURL));
  assert.ok(tab,'Calculator tab must open');
  socket=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let nextId=1;
  const pending=new Map();
  socket.addEventListener('message',e=>{
    const message=JSON.parse(e.data);
    if(message.method==='Runtime.exceptionThrown')failures.push(message.params.exceptionDetails.text);
    if(message.id&&pending.has(message.id)){
      const {resolve,reject,timer}=pending.get(message.id);clearTimeout(timer);pending.delete(message.id);
      if(message.error)reject(new Error(JSON.stringify(message.error)));else resolve(message.result);
    }
  });
  const rpc=(method,params={})=>new Promise((resolve,reject)=>{
    const id=nextId++;const timer=setTimeout(()=>{pending.delete(id);reject(new Error('Timeout: '+method));},15000);
    pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const r=await rpc('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;
  };
  await rpc('Runtime.enable');await rpc('Page.enable');
  for(let i=0;i<80;i++){if(await evaluate('document.readyState === "complete" && !!window.currentBudgetResult'))break;await wait(100);}
  const value=()=>evaluate('document.getElementById("result-budget").textContent');
  const set=async (id,input)=>evaluate(`document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(String(input))};document.getElementById(${JSON.stringify(id)}).dispatchEvent(new Event('input',{bubbles:true}));true`);
  const reset=async()=>{
    await evaluate('document.getElementById("reset").click();true');
    for(const [id,input]of Object.entries({currentBudget:2000,day:4,activePeople:10,maxPerPerson:3}))await set(id,input);
  };
  assert.equal(await value(),'₱4,660');checks++;
  assert.equal(await evaluate('document.getElementById("currentBudget").value'),'2800');checks++;
  assert.equal(await evaluate('document.getElementById("activePeople").value'),'5');checks++;
  assert.equal(await evaluate('document.getElementById("maxPerPerson").value'),'3.5');checks++;
  assert.equal(await evaluate('document.getElementById("day").value'),'1');checks++;
  await reset();
  assert.equal(await value(),'₱4,810');checks++;
  assert.deepEqual(await evaluate('Array.from(document.getElementById("yesterdayResult").options).map(o=>o.value)'),['PROFIT','BREAK-EVEN','LOSS']);checks++;
  assert.equal(await evaluate('document.querySelectorAll("#ySpend,#yRevenue,#yCosts,#yAcquisitions,#aggression,#targetROIPct,#breakEvenPct,#backlogTotal,#committed,#otherProjects,#cashLimit,#hardCap,#baselineCPA").length'),0);checks++;
  assert.equal(await evaluate('document.getElementById("result-per-person").textContent'),'1.43 projects / day');checks++;
  assert.equal(await evaluate('document.getElementById("result-quota").textContent'),'13 projects');checks++;
  await set('yesterdayResult','BREAK-EVEN');assert.equal(await value(),'₱1,000');checks++;
  assert.equal(await evaluate('document.getElementById("result-multiplier").textContent'),'0.50×');checks++;
  await set('yesterdayResult','LOSS');assert.equal(await value(),'₱500');checks++;
  assert.equal(await evaluate('document.getElementById("result-multiplier").textContent'),'0.25×');checks++;
  await reset();await set('currentBudget',1000);
  assert.equal(await evaluate('document.getElementById("result-multiplier").textContent'),'3.4651×');checks++;
  assert.equal(await value(),'₱3,460');checks++;
  await set('currentBudget',5000);
  assert.equal(await value(),'₱8,000');checks++;
  assert.equal(await evaluate('document.getElementById("result-per-person").textContent'),'2.2 projects / day');checks++;
  await reset();await set('yesterdayCPA',200);
  assert.equal(await evaluate('document.getElementById("result-per-person").textContent'),'2.2 projects / day');checks++;
  assert.equal(await evaluate('document.getElementById("result-cpa").textContent'),'₱200.00');checks++;
  await set('yesterdayCPA',100);assert.equal(await value(),'₱2,700');checks++;
  await set('maxPerPerson',5);assert.equal(await value(),'₱3,860');checks++;
  assert.equal(await evaluate('document.getElementById("result-per-person").textContent'),'4.29 projects / day');checks++;
  await evaluate('document.querySelector("[data-scenario=\\\"5\\\"]").click();true');
  assert.equal(await value(),'₱6,000');checks++;
  assert.equal(await evaluate('document.getElementById("result-multiplier").textContent'),'1.198×');checks++;
  assert.equal(await evaluate('window.currentBudgetResult.result.plannedPerPerson < Number(document.getElementById("maxPerPerson").value)'),true);checks++;
  await set('yesterdayResult','LOSS');
  await evaluate('document.getElementById("save").click();true');
  await rpc('Page.reload');
  for(let i=0;i<80;i++){if(await evaluate('document.readyState === "complete" && !!window.currentBudgetResult'))break;await wait(100);}
  assert.equal(await evaluate('document.getElementById("yesterdayResult").value'),'LOSS');checks++;
  assert.equal(await evaluate('document.getElementById("currentBudget").value'),'10000');checks++;
  await evaluate('localStorage.removeItem("tomorrow-ad-budget-v3");true');
  await reset();await set('activePeople',0);assert.equal(await value(),'₱0');checks++;
  assert.equal(await evaluate('document.getElementById("result-quota").textContent'),'0 projects');checks++;
  await set('activePeople','');assert.equal(await value(),'—');checks++;
  assert.equal(await evaluate('document.getElementById("errors").hidden'),false);checks++;
  await reset();await set('yesterdayCPA',0);assert.equal(await value(),'—');checks++;
  await reset();
  const calculatorUrl=new URL(initialURL);
  calculatorUrl.search=new URLSearchParams({currentBudget:'2800',startingBudget:'2000',day:'1',activePeople:'5',maxPerPerson:'3.5',yesterdayCPA:'400',yesterdayResult:'PROFIT',planDate:'2026-10-19'}).toString();
  await rpc('Page.navigate',{url:calculatorUrl.href});
  for(let i=0;i<80;i++){if(await evaluate('document.readyState === "complete" && !!window.currentBudgetResult && document.getElementById("currentBudget").value === "2800"'))break;await wait(100);}
  assert.equal(await value(),'₱4,660');checks++;
  assert.equal(await evaluate('document.getElementById("result-per-person").textContent'),'2.64 projects / day');checks++;
  assert.equal(await evaluate('document.getElementById("result-acquisitions").textContent'),'11.65');checks++;
  assert.equal(await evaluate('document.getElementById("result-quota").textContent'),'12 projects');checks++;
  assert.equal(await evaluate('document.getElementById("result-quota-person").textContent'),'2.4 projects per person on average');checks++;
  assert.equal(await evaluate('document.getElementById("result-team-boost").textContent'),'+8% of base step');checks++;
  assert.equal(await evaluate('document.getElementById("result-capacity-boost").textContent'),'₱480');checks++;
  await set('activePeople',10);assert.equal(await value(),'₱5,750');checks++;
  assert.equal(await evaluate('document.getElementById("result-quota-person").textContent'),'1.5 projects per person on average');checks++;
  await set('activePeople',5);
  await set('day',5);assert.equal(await value(),'₱4,940');checks++;
  assert.equal(await evaluate('document.getElementById("result-day-boost").textContent'),'+20% on profit step');checks++;
  await set('day',10);assert.equal(await value(),'₱5,280');checks++;
  await set('day',1);
  assert.equal(await evaluate('Number(document.getElementById("day").value)'),1);checks++;
  assert.equal(await evaluate('window.currentBudgetResult.result.limited'),false);checks++;
  assert.equal(await evaluate('window.currentBudgetResult.result.plannedPerPerson < Number(document.getElementById("maxPerPerson").value)'),true);checks++;
  await rpc('Emulation.setDeviceMetricsOverride',{width:1365,height:1100,deviceScaleFactor:1,mobile:false});
  await wait(600);await evaluate('window.scrollTo({top:0,behavior:"instant"});true');await wait(150);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'),true);checks++;
  const desktop=await rpc('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(qa,'desktop.png'),Buffer.from(desktop.data,'base64'));
  await rpc('Emulation.setDeviceMetricsOverride',{width:360,height:1000,deviceScaleFactor:1,mobile:true});
  await evaluate('window.scrollTo(0,0);true');await wait(150);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'),true);checks++;
  assert.equal(await evaluate('document.getElementById("result-budget").getBoundingClientRect().right <= window.innerWidth'),true);checks++;
  const mobile=await rpc('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(qa,'mobile.png'),Buffer.from(mobile.data,'base64'));
  await evaluate('document.querySelector(".advanced").open=true;true');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'),true);checks++;
  await evaluate('document.querySelector(".advanced").open=false;document.querySelector(".examples").scrollIntoView();true');
  assert.equal(await evaluate('document.querySelector(".examples .table-wrap").scrollWidth <= document.querySelector(".examples .table-wrap").clientWidth'),true,'Scenario table must fit on mobile');checks++;
  const examples=await rpc('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});
  fs.writeFileSync(path.join(qa,'mobile-examples.png'),Buffer.from(examples.data,'base64'));
  assert.equal(failures.length,0,'No runtime exceptions');checks++;
  console.log(JSON.stringify({checks,runtimeExceptions:failures,screenshots:['desktop.png','mobile.png','mobile-examples.png']},null,2));
  socket.send(JSON.stringify({id:nextId++,method:'Browser.close'}));
  await wait(300);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{if(socket)socket.close();if(!child.killed)child.kill();child.unref();process.exit(process.exitCode||0);});
