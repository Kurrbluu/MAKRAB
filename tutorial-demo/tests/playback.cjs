// Dependency-free playback / rule checks. Optional: node tutorial-demo/tests/playback.cjs
// DOM layout and actual fullscreen still require a browser review.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const elements = new Map();
let raf;
function element() {
 return { style:{setProperty(name,value){this[name]=value}}, classList:{add(){},remove(){},toggle(){}},
  childNodes:[], content:{childNodes:[]}, handlers:{}, attributes:[],
  paused:true,currentTime:0,readyState:1,play(){this.paused=false;return Promise.resolve()},pause(){this.paused=true},
  setAttribute(){}, addEventListener(type,fn){this.handlers[type]=fn},
  matches(){return false}, blur(){}, requestFullscreen:async()=>{},
  click(){this.onclick?.()}, textContent:'', innerHTML:'' };
}
const shortcuts=Array.from(fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/data-jump="([^"]+)"/g),match=>Object.assign(element(),{dataset:{jump:match[1]}}));
const document={querySelector:s=>{if(!elements.has(s))elements.set(s,element());return elements.get(s)},
 querySelectorAll:()=>shortcuts,createElement:()=>element(),body:element(),documentElement:element(),
 handlers:{},addEventListener(type,fn){this.handlers[type]=fn}};
const context={document,window:{},Image:class{},performance:{now:()=>0},
 setTimeout:()=>0,clearTimeout(){},requestAnimationFrame:fn=>raf=fn,addEventListener(){},
 innerWidth:1920,innerHeight:1080,URLSearchParams,location:{search:''},console};
vm.createContext(context);
const scriptSource=fs.readFileSync(path.join(root,'script.js'),'utf8');
vm.runInContext(scriptSource,context);
const api=context.window.TUTORIAL;
const markup=()=>vm.runInContext('lastMarkup',context);
const sceneStart=id=>api.scenes.slice(0,api.scenes.findIndex(s=>s.id===id)).reduce((sum,s)=>sum+s.duration,0);
const seekScene=(id,offset=0)=>api.seek(sceneStart(id)+offset);
assert.equal(api.total,330040);assert.equal(api.scenes.length,20);
assert.equal(api.scenes[0].duration,9240);
assert.deepEqual(Array.from(api.scenes.slice(0,2),scene=>scene.id),['intro','leaders']);
assert(!api.scenes.some(scene=>scene.id==='missions'));
api.seek(9239);assert(markup().includes('opening-intro'));
api.seek(9240);assert(markup().includes('leader-setup-scene'),'Frame 2 follows the narrated opening');
for(let t=0;t<=api.total;t+=100){api.seek(t);assert(!/undefined|NaN/.test(markup()),'Invalid content at '+t);assert(!/seer/i.test(markup()),'Removed role appears at '+t)}
vm.runInContext('artworkNames.forEach(name=>loadedArtwork.add(name))',context);
const openingScales=()=>Array.from(markup().matchAll(/transform:scale\(([^)]+)\)/g),m=>Number(m[1]));
api.seek(0);const smallScales=openingScales();
api.seek(900);const growingScales=openingScales();
api.seek(2600);const finishedScales=openingScales();
assert.equal(smallScales.length,4);
assert(smallScales.every(v=>v===api.config.introMotion.startScale));
assert(growingScales.every((v,i)=>v>smallScales[i]&&v<finishedScales[i]),'Every logo must grow through the reveal');
assert(finishedScales.every(v=>v===api.config.introMotion.endScale),'Each zoom must settle at its final size');
api.seek(4000);const openingFrame=markup();
assert.deepEqual(openingScales(),finishedScales,'Logo size must remain stable after zoom');
assert(openingFrame.includes('opening-intro'));
assert.equal((openingFrame.match(/class="opening-crest"/g)||[]).length,4);
for(const f of api.config.factions)assert(openingFrame.includes(f.name));
for(const label of ['4 FACTIONS','2 ROOMS','1 OBJECTIVES'])assert(openingFrame.includes(`>${label}</span>`));
const firstAct=openingFrame.split('opening-act opening-secrets')[0];
assert(!firstAct.includes('crest-caption'));assert(!firstAct.includes('opening-brand'));assert(!firstAct.includes('PANDUAN PERMAINAN'));
api.seek(5000);assert.equal((markup().match(/class="opening-crest"/g)||[]).length,4);assert(!markup().includes('opening-hidden-card'));
api.seek(4000);assert.equal(markup(),openingFrame,'Opening reveal must seek deterministically');
// Frame 2 selects two Leaders per faction and places exactly one in each room.
const setup=api.config.leaderSetup,setupDuration=api.scenes.find(scene=>scene.id==='leaders').duration;
const leaderIdentities=()=>Array.from(markup().matchAll(/data-leader-id="([^"]+)"/g),match=>match[1]);
seekScene('leaders',1000);const choosingLeaders=markup(),eightLeaders=leaderIdentities();
assert.equal((choosingLeaders.match(/class="leader-setup-team"/g)||[]).length,4);
assert.equal(eightLeaders.length,8);assert.equal(new Set(eightLeaders).size,8);
for(const faction of api.config.factions)assert.equal(eightLeaders.filter(id=>id.startsWith(faction.id+':')).length,2);
assert.equal((choosingLeaders.match(/data-selected="true"/g)||[]).length,0);
seekScene('leaders',2000);assert.equal((markup().match(/data-selected="true"/g)||[]).length,8);
assert.equal((markup().match(/data-state="selected"/g)||[]).length,8,'All faction pairs are chosen before placement');
seekScene('leaders',(setup.moveStart+setup.moveDuration*.5)*setupDuration);
assert.deepEqual(leaderIdentities(),eightLeaders,'All eight identities remain present while moving');
assert.equal((markup().match(/data-state="moving"/g)||[]).length,8);
seekScene('leaders',setupDuration-100);const assignedLeaders=markup();
assert.deepEqual(leaderIdentities(),eightLeaders,'Room placement cannot duplicate or lose a Leader');
assert.equal((assignedLeaders.match(/data-state="assigned"/g)||[]).length,8);
for(const [roomIndex,room] of Array.from(api.config.rooms).entries()){
 assert(assignedLeaders.includes(`class="leader-setup-room" data-room="${room}" data-leaders="4"`));
 for(const [factionIndex,faction] of Array.from(api.config.factions).entries()){
  assert.equal((assignedLeaders.match(new RegExp(`data-faction="${faction.id}" data-destination="${room}" data-state="assigned"`,'g'))||[]).length,1,'Each faction contributes exactly one Leader per room');
  const position=vm.runInContext(`leaderSetupState(.8,${factionIndex},${roomIndex})`,context);
  assert(position.x-64>=setup.layout.roomXs[roomIndex]&&position.x+64<=setup.layout.roomXs[roomIndex]+setup.layout.roomWidth);
 }
}
assert(assignedLeaders.includes('4 Leader per ruangan'));assert(assignedLeaders.includes('8 Leader total'));
assert(assignedLeaders.includes('Leader tidak mendapat kartu role'));
assert(assignedLeaders.includes('Leader tidak boleh dipindahkan saat Exchange'));
assert.equal((assignedLeaders.match(/data-warning="[12]"/g)||[]).length,2);
api.pause();raf(2000);assert.equal(markup(),assignedLeaders,'Pausing freezes placement and both warnings');
seekScene('intro',1000);seekScene('leaders',setupDuration-100);assert.equal(markup(),assignedLeaders,'Seeking reproduces the same two Leaders per faction');
// Protected Leaders are excluded; physical ribbons distinguish Leaders and ordinary members.
seekScene('leader-protection',3200);const protectionFrame=markup();
assert(protectionFrame.includes('Leader tidak bisa diterawang'));
assert(protectionFrame.includes('Bukan target Terawang'));
assert(protectionFrame.includes('ROLE LAIN'));
assert(protectionFrame.includes('Role lain bisa diterawang'));
api.pause();raf(2000);assert.equal(markup(),protectionFrame);
seekScene('intro',0);seekScene('leader-protection',3200);assert.equal(markup(),protectionFrame);
seekScene('ribbons',1000);assert.equal((markup().match(/data-fitted="true"/g)||[]).length,0);
seekScene('ribbons',6500);
assert(markup().includes('data-placement="headband" data-fitted="true"'));
assert(markup().includes('data-placement="wristband" data-fitted="false"'));
seekScene('ribbons',9400);const ribbonFrame=markup();
assert(ribbonFrame.includes('data-placement="headband" data-fitted="true"'));
assert(ribbonFrame.includes('data-placement="wristband" data-fitted="true"'));
assert(ribbonFrame.includes('Pita di kepala'));assert(ribbonFrame.includes('Pita di pergelangan tangan'));
assert(!ribbonFrame.includes('leader-crown'),'Physical Leader identification uses a ribbon headband');
api.pause();raf(2000);assert.equal(markup(),ribbonFrame);
seekScene('leaders',setupDuration-100);seekScene('ribbons',9400);assert.equal(markup(),ribbonFrame,'Ribbon placement rewinds deterministically');
// Four settled faction piles: distinct players each take one card, starting at the top.
seekScene('card-pickup',1150);const tableFrame=markup();
assert.equal((tableFrame.match(/class="pickup-pile"/g)||[]).length,4);
assert.equal((tableFrame.match(/class="pickup-stack-card"/g)||[]).length,20);
assert.equal((tableFrame.match(/class="pickup-card"/g)||[]).length,8);
assert.equal((tableFrame.match(/class="pickup-hand"/g)||[]).length,8);
assert.equal((tableFrame.match(/class="pickup-recipient"/g)||[]).length,8);
assert.equal((tableFrame.match(/Kartu tertutup untuk pemain/g)||[]).length,8);
assert(!tableFrame.includes('pickup-deck'),'Faction piles replace the shared deck');
const draws=Array.from(tableFrame.matchAll(/class="pickup-card" data-player="(\d+)" data-state="[^"]+" data-faction="([^"]+)" data-draw="(\d+)" data-layer="(\d+)"/g),m=>({player:Number(m[1]),faction:m[2],draw:Number(m[3]),layer:Number(m[4])}));
assert.equal(new Set(draws.map(d=>d.player)).size,8,'Each card belongs to a different player');
assert.deepEqual(draws.map(d=>d.faction),Array.from(api.config.factions).flatMap(f=>[f.id,f.id]),'Each faction must finish its left and right draws before the next faction');
for(const f of api.config.factions){
 const factionDraws=draws.filter(d=>d.faction===f.id);
 assert.equal(factionDraws.length,2);
 assert.deepEqual(factionDraws.map(d=>d.layer),[6,5],'The first draw removes the top layer, then the next layer');
 assert(tableFrame.includes(`aria-label="Tumpukan kartu ${f.name}"`));
}
assert(!tableFrame.includes('distribution-role-art'));
for(const role of api.config.roles)assert(!tableFrame.includes(`>${role}</h3>`),'Role identities must stay hidden on the table');
const cardStates=()=>Array.from(markup().matchAll(/class="pickup-card" data-player="(\d)" data-state="([^"]+)"/g),m=>m[2]);
assert(cardStates().every(s=>s==='waiting'),'All piles must settle before pickup');
const pickupDuration=api.scenes.find(s=>s.id==='card-pickup').duration;
const motion=api.config.cardPickupMotion;
for(let i=0;i<8;i++){
 const p=motion.pickupStart+i*motion.pickupStagger+motion.pickupDuration*.7;
 seekScene('card-pickup',p*pickupDuration);
 assert.deepEqual(cardStates(),Array.from({length:8},(_,j)=>j<i?'taken':j===i?'carrying':'waiting'));
 const first=vm.runInContext(`cardPickupState(${p},${i})`,context);
 assert.equal(first.direction,i%2===0?-1:1,'Take from the left first, then from the right');
 const next=vm.runInContext(`cardPickupState(${p+.005},${i})`,context);
 assert(Math.abs((next.x-first.x)-(next.handX-first.handX))<1e-8,'Hand and card must travel together horizontally');
 assert(Math.abs((next.y-first.y)-(next.handY-first.handY))<1e-8,'Hand and card must travel together vertically');
 const frame=markup();seekScene('intro',1000);seekScene('card-pickup',p*pickupDuration);
 assert.equal(markup(),frame,'Pickup must be identical after seeking backward');
 api.pause();raf(2000);assert.equal(markup(),frame,'Pause must freeze the pickup');
}
seekScene('card-pickup',pickupDuration-100);assert(cardStates().every(s=>s==='taken'));
assert.equal((markup().match(/class="pickup-stack-card"/g)||[]).length,20,'Five cards must remain in each pile after two draws');
seekScene('card-pickup',1150);assert.equal(markup(),tableFrame,'Scrubbing must restore all pile layers and hands');
const roomMotion=api.config.roomDistribution;
const roomStates=p=>Array.from(vm.runInContext(`Array.from({length:GAME_CONFIG.roomDistribution.memberCount},(_,i)=>roomMemberState(${p},i))`,context));
const seekRoom=p=>seekScene('rooms',p*api.scenes.find(s=>s.id==='rooms').duration);
const arrivals=()=>Array.from(markup().matchAll(/data-room="[^"]+" data-arrived="(\d+)"/g),m=>Number(m[1]));
seekRoom(.06);const gatheredFrame=markup(),gathered=roomStates(.06);
assert.equal((gatheredFrame.match(/class="distribution-member /g)||[]).length,10);
assert.equal((gatheredFrame.match(/src="assets\/azure-dragon.png"/g)||[]).length,10);
assert(gathered.every(s=>s.phase==='gathered'&&s.visible===1));
assert.equal(new Set(gathered.map(s=>`${s.x},${s.y}`)).size,10,'Every player starts at a distinct position');
assert(gatheredFrame.includes('CONTOH · AZURE DRAGON'));
assert(gatheredFrame.includes('>Room A</h3>'));assert(gatheredFrame.includes('>Room B</h3>'));
assert(gatheredFrame.includes('Setiap faction membagi anggotanya ke kedua ruangan.'));
const queuedTime=(roomMotion.splitStart+roomMotion.splitDuration+roomMotion.entryStart)/2;
seekRoom(queuedTime);const split=roomStates(queuedTime);
assert(split.every(s=>s.phase==='queued'));
assert.equal(split.filter(s=>s.x<860).length,5);assert.equal(split.filter(s=>s.x>860).length,5);
assert.deepEqual(arrivals(),[0,0]);
for(let i=0;i<10;i++){
 const p=roomMotion.entryStart+i*roomMotion.entryStagger+roomMotion.entryDuration*.5;
 seekRoom(p);const states=roomStates(p),moving=states.filter(s=>s.phase==='entering');
 assert.equal(moving.length,1,'Players must enter one at a time');
 assert.equal(states.filter(s=>s.phase==='inside').length,i);
 assert.equal(moving[0].entryIndex,i);
 assert.equal(moving[0].roomIndex,i%2,'Alternate room entry while keeping five assigned to each room');
 assert(Math.abs(moving[0].x-moving[0].gate.x)<1e-8&&Math.abs(moving[0].y-moving[0].gate.y)<1e-8,'Each player must pass through the door');
 assert.deepEqual(arrivals(),[Math.ceil(i/2),Math.floor(i/2)]);
 assert.equal((markup().match(/class="distribution-member /g)||[]).length,10,'No player is added or lost during entry');
 const frame=markup();api.pause();raf(2000);assert.equal(markup(),frame,'Pause must freeze room entry');
 seekRoom(.06);seekRoom(p);assert.equal(markup(),frame,'Seeking must reproduce the same room entry');
}
seekRoom(.98);const settledRooms=roomStates(.98);
assert(settledRooms.every(s=>s.phase==='inside'));assert.deepEqual(arrivals(),[5,5]);
for(const s of settledRooms){
 const bounds=roomMotion.layout,half=bounds.tokenSize/2,center=bounds.roomCenters[s.roomIndex];
 assert(s.x-half>=center-bounds.roomWidth/2&&s.x+half<=center+bounds.roomWidth/2);
 assert(s.y-half>=bounds.roomTop&&s.y+half<=bounds.roomTop+bounds.roomHeight,'Final player token must fit inside its assigned room');
}
seekRoom(.06);assert.equal(markup(),gatheredFrame,'Rewinding must gather the same ten players again');
// Room corners must preserve faction identity and match the later Exchange layout.
const spots=api.config.factionSpots;
const spotMembers=()=>Array.from(markup().matchAll(/data-member-id="([^"]+)"/g),match=>match[1]);
seekScene('faction-spots',1000);const waitingSpots=markup(),memberIds=spotMembers();
assert.equal((waitingSpots.match(/class="faction-spot"/g)||[]).length,8);
assert.equal(memberIds.length,24);assert.equal(new Set(memberIds).size,24);
seekScene('faction-spots',(spots.moveStart+spots.moveDuration*.5)*api.scenes.find(scene=>scene.id==='faction-spots').duration);assert.deepEqual(spotMembers(),memberIds);
assert.equal((markup().match(/data-state="moving"/g)||[]).length,24);
seekScene('faction-spots',8500);const placedSpots=markup();
assert.deepEqual(spotMembers(),memberIds);assert.equal((placedSpots.match(/data-state="placed"/g)||[]).length,24);
for(const [factionIndex,faction] of Array.from(api.config.factions).entries()){
 const [column,row]=api.config.leaderSelection.layout.factionCorners[factionIndex];
 assert.equal((placedSpots.match(new RegExp(`class="faction-spot" data-faction="${faction.id}" data-corner="${column}-${row}"`,'g'))||[]).length,2);
 for(let member=0;member<spots.membersPerFaction;member++){
  const pose=vm.runInContext(`factionSpotMemberState(.85,0,${factionIndex},${member})`,context);
  assert(pose.x-spots.layout.tokenSize/2>=spots.layout.zoneXs[column]&&pose.x+spots.layout.tokenSize/2<=spots.layout.zoneXs[column]+spots.layout.zoneWidth);
  assert(pose.y-spots.layout.tokenSize/2>=spots.layout.zoneYs[row]&&pose.y+spots.layout.tokenSize/2<=spots.layout.zoneYs[row]+spots.layout.zoneHeight);
 }
}
api.pause();raf(2000);assert.equal(markup(),placedSpots);
seekScene('rooms',500);seekScene('faction-spots',8500);assert.equal(markup(),placedSpots,'Faction placement rewinds deterministically');
// Exchange instructions: one shared target, ordinary players only, simultaneous movement.
const fixedLeaders=()=>Array.from(markup().matchAll(/class="leader-member is-leader" data-room="([^"]+)" data-faction="([^"]+)" data-player="(\d+)"[^>]*style="([^"]+)"/g),m=>`${m[1]}:${m[2]}:${m[3]}:${m[4]}`);
for(const [id,previousClass,currentClass] of [
 ['leaders','opening-intro','leader-setup-scene'],
 ['leader-protection','leader-setup-scene','leader-protection-scene'],
 ['ribbons','leader-protection-scene','ribbon-demo-scene'],
 ['roles','ribbon-demo-scene','roles-overview-scene'],
 ['card-pickup','roles-overview-scene','card-table-scene'],
 ['rooms','card-table-scene','room-distribution-scene'],
 ['faction-spots','room-distribution-scene','faction-spots-scene'],
 ['gm-cues','faction-spots-scene','gm-cue-scene'],
 ['loop','gm-cue-scene','game-flow-scene'],
 ['inspection','game-flow-scene','terawang-preparation-scene'],
 ['discussion','terawang-loss-scene','discussion-scene'],
 ['exchange','discussion-scene','exchange-question-scene'],
 ['gm-selection','exchange-room-act','gm-selection-scene'],
 ['exchange-completion','gm-selection-scene','gm-exchange-scene'],
 ['gambler-exchange','exchange-room-act','gambler-exchange-scene'],
 ['final','gambler-exchange-scene','exchange-scoring-scene'],
 ['card-safety','gm-exchange-scene','card-safety-scene'],
 ['room-communication','card-safety-scene','room-communication-scene'],
 ['end','room-communication-scene','closing-scene']
]){
 api.seek(sceneStart(id)-1);assert(markup().includes(previousClass),'Previous scene before '+id+' should contain '+previousClass);
 seekScene(id);assert(markup().includes(currentClass));
}
// Single Exchange chapter: one shared target draw and one balanced transfer.
const exchangeMotion=api.config.exchangeTutorial,exchangeDuration=api.scenes.find(scene=>scene.id==='exchange').duration;
seekScene('exchange',exchangeMotion.questionEnd*exchangeDuration*.5);assert(markup().includes('Leader memilih pemain<br>dari faction mana?'));
const gachaState=p=>vm.runInContext(`exchangeGachaState(${p})`,context);
for(let step=0;step<=150;step++){
 const start=exchangeMotion.rollStart,stop=exchangeMotion.rollStop;
 const state=gachaState(start+(stop-start)*step/150);
 assert.equal(state.orders.length,exchangeMotion.rollCycles+1);
 assert.deepEqual(JSON.parse(JSON.stringify(state.orders)),JSON.parse(JSON.stringify(gachaState(start).orders)),'A roll keeps the same cards instead of replacing their images');
 if(step>0)assert(state.offset>=gachaState(start+(stop-start)*(step-1)/150).offset,'The reel never jumps backwards');
 for(const pairing of [state.pairing,state.nextPairing]){
  assert.equal(new Set(pairing).size,4,'Gacha must target each faction exactly once');
  assert(pairing.every((target,source)=>target!==source),'Gacha must not target its own faction');
 }
}
const rollStop=exchangeMotion.rollStop,landed=gachaState(rollStop),lastMoment=gachaState(rollStop-.00001);
assert.equal(landed.offset,exchangeMotion.rollCycles*exchangeMotion.layout.reelHeight,'The landing retains the last card position');
assert(Math.abs(landed.offset-lastMoment.offset)<.01,'The final result has no offset reset');
assert.deepEqual(Array.from(landed.orders.at(-1)),Array.from(api.config.exchangePairing));
// The whole video contains one Exchange chapter, one draw and one transfer.
assert.equal(api.scenes.filter(scene=>scene.id==='exchange').length,1);
assert(!api.scenes.some(scene=>scene.id==='leader-rules'),'The former adjacent Exchange explanation is merged');
assert(!Object.hasOwn(exchangeMotion,'rerollStart'),'A second draw must not restart the example');
let drawSegments=0,previousDraw=false;
for(let sample=0;sample<=200;sample++){
 seekScene('exchange',Math.min(exchangeDuration-1,exchangeDuration*sample/200));
 const drawing=markup().includes('exchange-gacha-scene');
 if(drawing&&!previousDraw)drawSegments++;
 previousDraw=drawing;
 assert(!markup().includes('exchange-rules-scene'),'The old miniature Exchange example must not play again');
}
assert.equal(drawSegments,1);
const completionMotion=api.config.exchangeCompletion,completionDuration=api.scenes.find(scene=>scene.id==='exchange-completion').duration;
assert(completionMotion.movementDuration*completionDuration>=2000,'The room transfer remains visible for at least two seconds');
seekScene('exchange',(exchangeMotion.rollStart+exchangeMotion.rollStop)/2*exchangeDuration);const rollingGacha=markup();
assert.equal((rollingGacha.match(/class="exchange-gacha-slot /g)||[]).length,4);
assert.equal((rollingGacha.match(/data-locked="false"/g)||[]).length,4);
api.pause();raf(2000);assert.equal(markup(),rollingGacha,'Pause freezes all four reels');
seekScene('intro',1000);seekScene('exchange',(exchangeMotion.rollStart+exchangeMotion.rollStop)/2*exchangeDuration);assert.equal(markup(),rollingGacha,'Reels must rewind deterministically');
seekScene('exchange',(exchangeMotion.rollStop+exchangeMotion.roomsStart)/2*exchangeDuration);
const outcomes=Array.from(markup().matchAll(/data-owner="([^"]+)" data-target="([^"]+)" data-locked="true"/g),match=>[match[1],match[2]]);
assert.deepEqual(outcomes,Array.from(api.config.factions,(faction,index)=>[faction.id,api.config.factions[api.config.exchangePairing[index]].id]));
const exchangeWaitingTime=(exchangeMotion.targetMarkStart+exchangeMotion.targetMarkDuration+exchangeMotion.selectionStart)/2*exchangeDuration;
seekScene('exchange',exchangeWaitingTime);
assert.equal((markup().match(/exchange-candidate/g)||[]).length,6,'Exclude the Leader and Gambler from target candidates in each room');
assert.equal((markup().match(/class="leader-fixed-lock"/g)||[]).length,8);
const exchangeTravelers=()=>Array.from(markup().matchAll(/class="leader-rule-traveler exchange-picked-player" data-origin="([^"]+)" data-destination="([^"]+)" data-faction="([^"]+)" data-player="(\d+)" style="[^\"]*transform:translate\(([^p]+)px,([^p]+)px\)"/g),match=>({from:match[1],to:match[2],faction:match[3],player:Number(match[4]),x:Number(match[5]),y:Number(match[6])}));
const exchangeState=(p,completion=false)=>vm.runInContext(`exchangeRoomExample(${p},${completion})`,context);
const exchangeWaiting=exchangeTravelers(),exchangeFixedLeaders=fixedLeaders();
assert.equal(exchangeFixedLeaders.length,8);assert.equal(exchangeWaiting.length,2);
for(const [roomIndex,traveler] of exchangeWaiting.entries()){
 assert.equal(traveler.faction,'white-tiger');
 assert.notEqual(traveler.player-1,api.config.leaderSelection.selectedMembers[roomIndex][exchangeState(.40).target]);
}
assert.deepEqual(Array.from(exchangeState(.40).cases,example=>[example.source,example.target]),[[0,2],[0,2]],'Both rooms must share the same roll');
const exchangeMoveTime=(completionMotion.movementStart+completionMotion.movementDuration*.5)*completionDuration;
seekScene('exchange-completion',exchangeMoveTime);
assert(markup().includes('exchange-motion-trace'),'Moving players must have trajectory traces');
const midFrame=markup(),midClock=elements.get('#stage').style['--film-clock'];
assert.equal(midClock,`${-(sceneStart('exchange-completion')+exchangeMoveTime)/1000}s`);
assert.deepEqual(fixedLeaders(),exchangeFixedLeaders,'Leaders must remain fixed during Exchange');
assert(exchangeTravelers().every((traveler,index)=>traveler.x!==exchangeWaiting[index].x),'Both selected members move together');
api.seek(10000);seekScene('exchange-completion',exchangeMoveTime);
assert.equal(markup(),midFrame,'Effect paths must rewind deterministically');
assert.equal(elements.get('#stage').style['--film-clock'],midClock);
api.pause();raf(2000);assert.equal(elements.get('#stage').style['--film-clock'],midClock,'Paused effects must freeze');
const exchangeArrivalTime=Math.min(completionDuration-1,(completionMotion.movementStart+completionMotion.movementDuration+.015)*completionDuration);
seekScene('exchange-completion',exchangeArrivalTime);const movement=markup();seekScene('end',5000);seekScene('exchange-completion',exchangeArrivalTime);
assert.equal(markup(),movement,'Seeking must reproduce the same frame');
assert.equal(fixedLeaders().length,8);
assert.equal(exchangeTravelers().length,2);
for(const [index,traveler] of exchangeTravelers().entries()){
 assert.equal(traveler.x,exchangeWaiting[1-index].x);assert(Math.abs(traveler.y-exchangeWaiting[1-index].y)<1e-8);
 assert.equal(traveler.to,exchangeWaiting[1-index].from);
}
assert(movement.includes('data-population="20" data-leaders="4"'));
assert.deepEqual(fixedLeaders(),exchangeFixedLeaders);
assert(!/token leader[^>]*translate/.test(movement),'Leaders never move');
seekScene('exchange',exchangeDuration*.95);
assert(markup().includes('exchange-room-act'));
assert(!markup().includes('exchange-gacha-scene'),'After arrival, the video never starts another roll');
assert(markup().includes('Pilihan Leader final · tidak dapat diganti.'));
assert(markup().includes('Pemain lain tetap duduk selama Exchange.'));
assert.equal((markup().match(/class="exchange-seated-person"/g)||[]).length,4);
// A GM fallback preserves the target faction and excludes the stationary Leader.
const fallbackState=p=>vm.runInContext(`gmSelectionState(${p})`,context);
const seenChoices=new Set();
for(let sample=0;sample<=200;sample++){
 const p=sample/200,state=fallbackState(p);
 assert.equal(state.target,api.config.exchangePairing[state.source]);
 assert(!Array.from(state.players).includes(api.config.leaderSelection.selectedMembers[api.config.gmSelection.roomIndex][state.target]));
 if(state.deadline<1)assert.equal(state.selected,-1,'No random selection appears while the Leader still has time');
 if(p>=api.config.gmSelection.rollStart&&p<api.config.gmSelection.rollStop)seenChoices.add(state.selected);
}
assert.equal(seenChoices.size,3,'Every eligible ordinary member appears; Leader and Gambler are excluded');
seekScene('gm-selection',11800);const gmFallbackFrame=markup();
assert(gmFallbackFrame.includes('PILIHAN GM'));
assert.equal((gmFallbackFrame.match(/data-is-leader="false"/g)||[]).length,3);
api.pause();raf(2000);assert.equal(markup(),gmFallbackFrame);
seekScene('roles',200);seekScene('gm-selection',11800);assert.equal(markup(),gmFallbackFrame);
// Both Gamblers move together in opposite directions, without crossing each other visually.
const swapState=p=>Array.from(vm.runInContext(`gamblerExchangeState(${p})`,context));
const swapStart=swapState(0),swapEnd=swapState(1);
for(let sample=0;sample<=100;sample++){
 const state=swapState(sample/100);
 assert.equal(state.length,2);assert.equal(state[0].move,state[1].move);
 assert.equal(state[0].faction,state[1].faction,'Gambler partners belong to the same faction');
 assert(state.every(person=>person.scoreDelta===0),'The dedicated Gambler swap earns no points');
 assert.deepEqual(state.map(person=>[person.room,person.destination]),[['Room A','Room B'],['Room B','Room A']]);
 assert(Math.hypot(state[0].x-state[1].x,state[0].y-state[1].y)>108,'Gambler markers never overlap');
}
assert.equal(swapEnd[0].x,swapStart[1].x);assert.equal(swapEnd[1].x,swapStart[0].x);
seekScene('gambler-exchange',6300);const swapFrame=markup();
assert(swapFrame.includes('data-exchange-number="2"'));
assert.equal((swapFrame.match(/data-role="Gambler"/g)||[]).length,2);
assert.equal((swapFrame.match(/data-faction="azure-dragon"/g)||[]).length,2);
assert(swapFrame.includes('Tanpa poin'));
api.pause();raf(2000);assert.equal(markup(),swapFrame);
seekScene('roles',200);seekScene('gambler-exchange',6300);assert.equal(markup(),swapFrame);
seekScene('roles',1800);const combinedRoleFrame=markup();
for(const role of api.config.roles)assert(combinedRoleFrame.includes(`>${role}</h3>`));
assert.equal((combinedRoleFrame.match(/class="role-card /g)||[]).length,5,'Exactly five roles appear on one page');
assert.deepEqual(Array.from(combinedRoleFrame.matchAll(/class="role-overview-entry" data-role="([^"]+)"/g),match=>match[1]),['VIP','Gambler','Warden','Civilian','Pretender']);
assert(!api.scenes.some(scene=>['active-roles','passive-roles'].includes(scene.id)),'The three role introductions are consolidated into one scene');
assert(combinedRoleFrame.includes('roles-overview-scene'));
assert(!combinedRoleFrame.includes('flip-card')&&!combinedRoleFrame.includes('gambler-inspection-board'));
assert(sceneStart('roles')<sceneStart('inspection'));
seekScene('roles',1800);const roleCardsOpening=markup();
assert(roleCardsOpening.includes('assets/crown.png'));assert(roleCardsOpening.includes('assets/pretender.png'));
assert(roleCardsOpening.includes('Penjelasan role menyusul.'));
assert(!/<small>|poin|BO3|role asli|Penyamar VIP/.test(roleCardsOpening),'Frame 5 only introduces the five names');
assert.equal(api.scenes.find(scene=>scene.id==='roles').duration,7480);
api.pause();raf(2000);assert.equal(markup(),roleCardsOpening);
// Five cards start in one deck, are drawn in order, and settle on their own slots.
const deckState=p=>vm.runInContext('roleIntroState('+p+')',context);
const roleDuration=api.scenes.find(scene=>scene.id==='roles').duration;
const stacked=deckState(200/roleDuration),spread=deckState(.98);
const centers=Array.from(stacked.cards,card=>card.targetX+card.x);
assert(Math.max(...centers)-Math.min(...centers)<=20,'The initial five cards share a compact deck');
assert(Array.from(stacked.cards).every(card=>card.draw===0&&card.flip===0));
assert(Array.from(spread.cards).every(card=>card.draw===1&&card.flip===1&&card.x===0&&card.y===0&&card.rotation===0),'All five cards finish on the correct slots');
const drawing=deckState((api.config.roleIntroMotion.drawStart+api.config.roleIntroMotion.drawDuration*.5)/roleDuration);
assert(drawing.cards[0].draw>0&&drawing.cards.slice(1).every(card=>card.draw===0),'The first named card is drawn before the remaining cards');
for(let sample=0;sample<=100;sample++){
 const state=deckState(sample/100);
 for(const card of state.cards){
  const angle=card.rotation*Math.PI/180,c=Math.abs(Math.cos(angle)),s=Math.abs(Math.sin(angle));
  const halfW=(state.width*c+state.height*s)*card.scale/2,halfH=(state.height*c+state.width*s)*card.scale/2;
  const x=card.targetX+card.x,y=card.targetY+card.y;
  assert(x-halfW>=0&&x+halfW<=1720&&y-halfH>=112&&y+halfH<=708,'Moving cards stay clear of the heading, footer and canvas edges');
 }
}
seekScene('roles',750);const drawingFrame=markup();
api.pause();raf(2000);assert.equal(markup(),drawingFrame,'Pause freezes the cards being drawn');
seekScene('intro',1000);seekScene('roles',750);assert.equal(markup(),drawingFrame,'The deck animation rewinds deterministically');
// Preparation starts frame 10; frame 5 remains a brief introduction.
const preparation=api.config.terawangPreparation;
const preparationStart=0;
seekScene('inspection',preparationStart+preparation.sitStart-1);
assert.equal((markup().match(/data-seat="0"/g)||[]).length,4);
const sittingOffset=preparationStart+preparation.sitStart+preparation.sitDuration/2;
seekScene('inspection',sittingOffset);
assert.equal((markup().match(/data-posture="sitting-down"/g)||[]).length,4,'All four players sit smoothly');
const seatedOffset=preparationStart+preparation.sitStart+(api.config.factions.length-1)*preparation.sitStagger+preparation.sitDuration+200;
seekScene('inspection',seatedOffset);
const seatedPlayers=markup();
assert(seatedPlayers.includes('Pemain selain Gambler<br>harus tunduk'));
assert.equal((seatedPlayers.match(/data-seat="1"/g)||[]).length,4);
assert.equal((seatedPlayers.match(/data-posture="standing"/g)||[]).length,1,'Only Gambler remains standing');
assert(seatedPlayers.includes('data-role="Gambler"'));
assert(!seatedPlayers.includes('Seer'));
assert(!seatedPlayers.includes('gambler-inspection-board'),'The reminder precedes the inspection');
api.pause();raf(2000);assert.equal(markup(),seatedPlayers);
seekScene('roles',1000);seekScene('inspection',seatedOffset);
assert.equal(markup(),seatedPlayers,'Sitting must replay identically when seeking');
// Gambler is the sole active role during the recorded Terawang demonstration.
const inspectionDuration=api.scenes.find(s=>s.id==='inspection').duration-preparation.duration;
seekScene('inspection',preparation.duration+2000);assert(markup().includes('terawang-gambler-scene'));
// The suit score advances only after each hand reveal; opening the card requires a BO3 win.
const duelTime=local=>preparation.duration+local*inspectionDuration;
const duelState=local=>vm.runInContext(`gamblerDuelState(${local})`,context);
const duel=api.config.terawang.gamblerDuel;
const resultTime=round=>duel.roundStart+round*duel.roundStagger+duel.resultOffset+.001;
for(const [local,expected] of [[.10,[0,0]],[resultTime(0),[1,0]],[resultTime(1),[1,1]],[resultTime(2),[2,1]]]){
 const state=duelState(local);assert.deepEqual([state.score.gambler,state.score.target],expected);
 seekScene('inspection',duelTime(local));
 assert(markup().includes(`data-gambler-wins="${expected[0]}" data-target-wins="${expected[1]}"`));
 assert(markup().includes('data-role-revealed="false"'),'Do not reveal the role before the winner and reveal beat');
}
assert.equal(duelState(resultTime(2)-.002).winner,null);assert.equal(duelState(resultTime(2)).winner,'gambler');
assert.equal(duelState(duel.cardRevealStart).reveal,0);assert.equal(duelState(.89).reveal,1);
assert.equal(duelState(duel.cardRevealStart+duel.cardRevealDuration+.001).reveal,1,'The private card reveal follows its spoken cue');
seekScene('inspection',duelTime((duel.cardRevealStart+duel.cardRevealDuration+duel.lossStart)/2));const revealedRole=markup();
assert(revealedRole.includes('BEST OF 3'));
assert.equal((revealedRole.match(/class="duel-round is-complete/g)||[]).length,3);
assert(revealedRole.includes('data-role-revealed="true"'));assert(revealedRole.includes('data-visible-face="front"'));assert(revealedRole.includes('visibility:visible;transform:rotateY(0deg)'));
assert(revealedRole.includes('>Pretender</h3>'));assert(revealedRole.includes('TERNYATA PRETENDER'));
assert(revealedRole.includes('Gambler menang → lawan wajib membuka kartu.'));
assert(revealedRole.includes('Role asli diperlihatkan kepada Gambler pemenang.'));
api.pause();raf(2000);assert.equal(markup(),revealedRole);
seekScene('inspection',duelTime(.10));seekScene('inspection',duelTime((duel.cardRevealStart+duel.cardRevealDuration+duel.lossStart)/2));assert.equal(markup(),revealedRole,'Suit rounds and forced reveal must rewind deterministically');
const secondHand=api.config.terawang.gamblerDuel.rounds[1].target;
api.config.terawang.gamblerDuel.rounds[1].target='scissors';
const earlyWin=duelState(.90);
assert.deepEqual([earlyWin.score.gambler,earlyWin.score.target],[2,0]);
assert.equal(earlyWin.rounds[2].opened,false,'Best of three must stop when someone has won two rounds');
api.config.terawang.gamblerDuel.rounds[1].target=secondHand;
const narrationCues=JSON.parse(fs.readFileSync(path.join(root,'../audio/narration-sync.json'),'utf8'));
assert.deepEqual(Array.from(api.scenes,s=>s.id),narrationCues.chapters.map(cue=>cue.id));
assert.deepEqual(Array.from(api.scenes,s=>s.duration),narrationCues.chapters.map(cue=>cue.durationMs));
assert(!narrationCues.correction,'The new recording requires no old word replacement');
// The Warden demonstration is removed; all five roles still appear in the overview.
assert(!api.scenes.some(scene=>scene.id==='anchor'));
assert.equal(api.scenes[12].id,'exchange');
assert.deepEqual(Array.from(api.config.roles),['Gambler','Warden','Civilian','VIP','Pretender']);
assert.deepEqual(Array.from(api.config.terawangPreparation.activeRoles),['Gambler']);
assert(!Object.hasOwn(api.config.roleAssets,'Seer'));
assert(!vm.runInContext('artworkNames',context).includes('seer'));
seekScene('roles',1800);
for(const value of ['+3 poin','−3 poin','−1 poin','+1 poin'])assert(!markup().includes(value),'Point values are explained later');
// Each Exchange uses the true role of the moved player; there are no final answers or destination bonuses.
const pointConfig=api.config.exchangeScoring,finalDuration=api.scenes.find(scene=>scene.id==='final').duration;
assert.deepEqual(JSON.parse(JSON.stringify(pointConfig.roleValues)),{VIP:3,Pretender:-3,Civilian:-1,Warden:1});
const pointRows=()=>Array.from(markup().matchAll(/class="exchange-score-card[^"]*" data-role="([^"]+)" data-score="(-?\d+)"/g),m=>({role:m[1],points:Number(m[2])}));
for(let sample=0;sample<=100;sample++){
 seekScene('final',Math.min(finalDuration-1,finalDuration*sample/100));
 if(finalDuration*sample/100<pointConfig.overviewDuration){
  assert.equal(pointRows().length,4);
  assert.deepEqual(pointRows(),[{role:'VIP',points:3},{role:'Pretender',points:-3},{role:'Warden',points:1},{role:'Civilian',points:-1}]);
 } else assert(markup().includes('gm-exchange-scene'),'The point overview is followed by the GM example');
 assert(!/final-answer-sheet|final-room-note|final-leader-scene|MISI SELESAI|JAWABAN AKHIR|POSISI AKHIR WARDEN|data-received/.test(markup()),'Removed answer and destination rules never reappear');
}
seekScene('final',3200);const pointFrame=markup();
assert(pointFrame.includes('Nilai sesuai role asli pemain yang dipindahkan.'));
api.pause();raf(2000);assert.equal(markup(),pointFrame);
seekScene('rooms',1000);seekScene('final',3200);assert.equal(markup(),pointFrame,'Point explanation rewinds deterministically');
const gmState=p=>vm.runInContext(`exchangeScoreExampleState(${p})`,context);
const gmTime=p=>pointConfig.overviewDuration+p*(finalDuration-pointConfig.overviewDuration);
for(let sample=0;sample<=200;sample++){
 const p=sample/200,state=gmState(p);
 assert.equal(state.points,3);assert.equal(state.source,0);assert.equal(state.target,2);
 if(state.check<1)assert.equal(state.score,0,'GM checks the true role before adding points');
 if(state.score<1)assert.equal(state.move,0,'Players stay in the room until the score is recorded');
 assert.equal(state.move,0,'The point example must not replay the Exchange transfer');
 assert(state.total>=0&&state.total<=3);
}
assert.equal(gmState(.04).step,'selected');assert.equal(gmState(.14).step,'checking');
assert.equal(gmState(.225).step,'checked');assert.equal(gmState(.30).step,'scoring');
assert.equal(gmState(.85).step,'recorded');assert.equal(gmState(.9).step,'recorded');
assert.equal(gmState(.90).step,'recorded');assert.equal(gmState(.90).total,3);
seekScene('final',gmTime(.225));const checkedByGM=markup();
assert(checkedByGM.includes('data-role-checked="true" data-score-updated="false" data-move-progress="0"'));
assert(checkedByGM.includes('data-score-recipient="azure-dragon"'));
assert(checkedByGM.includes('data-initial-score="0" data-score="0" data-delta="3"'));
assert(checkedByGM.includes('Role asli: VIP → +3 poin.'));
seekScene('final',gmTime(.86));const recordedByGM=markup();
assert(recordedByGM.includes('data-role-checked="true" data-score-updated="true" data-move-progress="0"'));
assert(recordedByGM.includes('data-score-recipient="azure-dragon"'));
assert(recordedByGM.includes('data-initial-score="0" data-score="3"'));
assert(recordedByGM.includes('Skor sudah diperbarui. Pemain menunggu aba-aba GM.'));
api.pause();raf(2000);assert.equal(markup(),recordedByGM);
seekScene('roles',1000);seekScene('final',gmTime(.86));assert.equal(markup(),recordedByGM,'GM scoring rewinds without adding points twice');
seekScene('final',gmTime(.90));assert(markup().includes('data-gm-step="recorded"'));
assert(markup().includes('data-move-progress="0"'),'Scoring ends at GM confirmation rather than another transfer');
seekScene('final',gmTime(.95));const endingPoints=markup();
assert(endingPoints.includes('POIN TERTINGGI MENANG'));
assert(endingPoints.includes('Azure Dragon mendapat +3 poin dari satu VIP.'));
assert(!endingPoints.includes('data-winner-faction'),'The tutorial does not invent actual faction scores or a winner');
api.pause();raf(2000);assert.equal(markup(),endingPoints);
assert.equal(api.config.totalExchanges,3);
seekScene('loop',7000);assert(markup().includes('3 menit'));assert(!markup().includes('30 detik'));
seekScene('end',1000);assert(markup().includes('closing-scene'));assert(markup().includes('<h1>Siap bermain?</h1>'));
assert.equal(api.scenes.at(-1).duration,9700);
for(const pairing of [api.config.exchangePairing,...api.config.rollExamples]){
 assert.equal(new Set(pairing).size,4);assert(pairing.every((v,i)=>v!==i));
}
// Changing the example also updates the chosen movers in BOTH rooms.
api.config.exchangePairing=[1,0,3,2];seekScene('exchange-completion',exchangeArrivalTime);
assert(exchangeTravelers().every(traveler=>traveler.faction==='vermilion-bird'));
assert(markup().includes('Azure Dragon → Vermilion Bird'));
api.config.exchangePairing=[2,3,0,1];
elements.get('#start').click();assert.equal(api.time,0);assert.equal(elements.get('#launch').hidden,true);
elements.get('#narrationAudio').readyState=2;elements.get('#narrationAudio').currentTime=1;raf(1000);assert.equal(api.time,1000);api.pause();raf(2000);assert.equal(api.time,1000);
api.seek(api.total);assert.equal(elements.get('#endScreen').hidden,false);
elements.get('#replay').click();assert.equal(api.time,0);assert.equal(elements.get('#endScreen').hidden,true);
shortcuts.find(b=>b.dataset.jump==='exchange').handlers.click();assert.equal(api.time,sceneStart('exchange')+37300);assert.equal(elements.get('#play').textContent,'▶ Putar');
shortcuts.find(b=>b.dataset.jump==='intro').handlers.click();assert.equal(api.time,0);assert.equal(elements.get('#play').textContent,'▶ Putar');
for(const id of ['leaders','leader-protection','ribbons','roles','card-pickup','rooms','faction-spots','loop','inspection']){
 shortcuts.find(b=>b.dataset.jump===id).handlers.click();
 assert.equal(api.time,sceneStart(id)+(api.scenes.find(s=>s.id===id).previewTime??500));
}
assert.equal(elements.get('#launchDuration').textContent,'5:30');
assert.equal(elements.get('#seek').max,330.04);
for(const name of vm.runInContext('artworkNames',context))assert(fs.existsSync(path.join(root,'assets',name+'.png')));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
assert(!html.includes('data-jump="missions"'),'The removed scene cannot remain in chapter shortcuts');
assert(!vm.runInContext('artworkNames',context).includes('mission-card'),'The removed scene artwork is not preloaded');
assert(html.includes('<audio id="narrationAudio" preload="auto" hidden>'));
assert(html.includes('id="voiceoverControl"'));assert(!scriptSource.includes('speechSynthesis'));
assert(fs.existsSync(path.join(root,api.config.narration.asset.split('?')[0])));
// One complete recorded track drives every scene, including deliberate quiet sections.
const narration=elements.get('#narrationAudio'),voiceButton=elements.get('#voiceoverControl');
assert.equal(api.config.narration.enabled,true);
assert.equal(narration.src,api.config.narration.asset);
assert.equal(voiceButton.hidden,false);
narration.readyState=2;narration.duration=api.total/1000;narration.muted=false;
narration.handlers.loadedmetadata();
elements.get('#start').click();assert.equal(narration.currentTime,0);assert.equal(narration.paused,false);
api.seek(sceneStart('leaders')+900);assert.equal(narration.currentTime,(sceneStart('leaders')+900)/1000);assert.equal(narration.paused,false,'Narration continues beyond the opening');
api.pause();assert.equal(narration.paused,true);
const frozen=api.time;raf(2000);assert.equal(api.time,frozen);
api.seek(2400);assert.equal(narration.currentTime,2.4);assert.equal(narration.paused,true);
api.play();narration.currentTime=9.75;raf(50000);
assert.equal(api.time,9750,'Delayed animation frames follow the audio clock rather than advancing narration');
narration.currentTime=sceneStart('final')/1000+.125;narration.handlers.timeupdate();
assert(Math.abs(api.time-sceneStart('final')-125)<.01,'Audio timeupdate also keeps a backgrounded video aligned');
voiceButton.click();assert.equal(narration.muted,true);assert.equal(voiceButton.textContent,'Suara: mati');
elements.get('#restart').click();assert.equal(narration.currentTime,0);assert.equal(narration.muted,true,'Restart preserves the mute preference');
voiceButton.click();assert.equal(narration.muted,false);
api.seek(api.total-1000);narration.paused=true;narration.currentTime=narration.duration;narration.handlers.ended();
assert.equal(api.time,api.total);assert.equal(elements.get('#endScreen').hidden,false);
vm.runInContext('draw()',context);assert.equal(narration.paused,true,'The ended track never restarts itself');
api.seek(0);assert.equal(narration.currentTime,0);assert.equal(narration.paused,true);api.play();assert.equal(narration.paused,false);
api.config.narration.enabled=false;api.play();assert.equal(narration.paused,true);
api.config.narration.enabled=true;narration.handlers.error();assert.equal(narration.paused,true);assert.equal(voiceButton.hidden,true);
api.seek(2000);assert.equal(narration.paused,true,'Audio errors retain a silent playback fallback');
narration.handlers.loadedmetadata();assert.equal(narration.currentTime,2);assert.equal(narration.paused,false);
api.pause();
assert(!html.includes('sceneNumber'));assert(!html.includes('EMPAT FACTION. SATU KEMENANGAN.'));

assert(html.includes('PLAY VIDEO'));assert(html.includes('id="seek"'));assert(html.includes('id="replay"'));
// The fresh review link must open directly on both choosing Leaders, paused.
function launchAt(search){
 const freshElements=new Map([['#launch',element()]]);let nextFrame;
 const freshContext={...context,window:{},location:{search},requestAnimationFrame:fn=>nextFrame=fn,
  document:{...document,body:element(),documentElement:element(),
   querySelector:s=>{if(!freshElements.has(s))freshElements.set(s,element());return freshElements.get(s)},
   querySelectorAll:()=>[]}};
 vm.createContext(freshContext);vm.runInContext(scriptSource,freshContext);
 return {api:freshContext.window.TUTORIAL,elements:freshElements,markup:()=>vm.runInContext('lastMarkup',freshContext),tick:now=>{const track=freshElements.get('#narrationAudio');if(track&&!track.paused){track.readyState=2;track.currentTime+=now/1000;}nextFrame(now)}};
}
// These timestamps come from the 13:10 recording, independent of animation settings.
for(const [time,fragment] of [[19000,'Leader tidak boleh dipindahkan saat Exchange'],[102000,'1 tantangan per fase'],[109000,'faksi lain · ruangan yang sama'],[114000,'wajib menerima suit'],[125000,'Seri → ronde diulang'],[133000,'data-role-revealed="true"'],[137000,'data-conditional="gambler-loses"'],[148000,'discussion-scene'],[184000,'Leader dan Gambler tidak dipilih'],[194000,'Pilihan Leader final'],[208000,'PILIHAN GM'],[216000,'data-recorded="true"'],[220000,'Tunggu aba-aba GM'],[224500,'berpindah bersamaan'],[247500,'data-score-delta="0"'],[306000,'Gambler pemenang'],[317000,'Dibawa pemain yang berpindah'],[329500,'Siap bermain?']]){
 api.seek(time);assert(markup().includes(fragment),'Narrated rule must be visible at '+time);
}
for(const [time,role] of [[262300,'VIP'],[267100,'Pretender'],[272200,'Warden'],[277100,'Civilian']]){
 api.seek(time);
 assert(markup().includes('class="exchange-score-card is-highlighted" data-role="'+role+'"'),'The named role is highlighted at its recorded cue');
}
for(let sample=0;sample<=100;sample++){
 assert.equal(exchangeState(sample/100).move,0,'Selection never prematurely transfers a player');
 const face=vm.runInContext('inspectionCardPose('+sample/100+')',context);
 assert.notEqual(face.frontVisible,face.backVisible,'Exactly one card face can be visible');
 if(face.frontVisible)assert(face.frontAngle>=-90&&face.frontAngle<=0,'Visible Pretender text never turns onto its mirrored back');
 if(face.backVisible)assert(face.backAngle>=0&&face.backAngle<=90,'The visible card back never mirrors');
}
assert.equal(exchangeState(completionMotion.movementStart-.001,true).move,0,'Movement waits for the recorded GM cue');
api.seek(216000);assert(!markup().includes('data-score="3"'),'Numerical role values are explained after verification');
api.seek(sceneStart('card-safety')+11000);assert(markup().includes('Jangan ditukar')&&markup().includes('Jangan difoto'));
api.seek(sceneStart('rooms')+9500);assert.equal((markup().match(/data-role="Gambler"/g)||[]).length,2,'Each room has an illustrated same-faction Gambler');
assert.deepEqual(shortcuts.map(button=>button.dataset.jump),Array.from(api.scenes,scene=>scene.id).filter(id=>id!=='end'));
// Every review opens paused on its actual chapter and its recorded audio cue.
const reviewClasses={intro:'opening-intro',leaders:'leader-setup-scene','leader-protection':'leader-protection-scene',ribbons:'ribbon-demo-scene',roles:'roles-overview-scene','card-pickup':'card-table-scene',rooms:'room-distribution-scene','faction-spots':'faction-spots-scene','gm-cues':'gm-cue-scene',loop:'game-flow-scene',inspection:'terawang-gambler-scene',discussion:'discussion-scene',exchange:'exchange-room-act','gm-selection':'gm-selection-scene','exchange-completion':'exchange-room-act','gambler-exchange':'gambler-exchange-scene',final:'exchange-scoring-scene','card-safety':'card-safety-scene','room-communication':'room-communication-scene',end:'closing-scene'};
for(const scene of api.scenes){
 const review=launchAt('?scene='+scene.id+'&v=voiceover-1310-sync-1');
 const expected=sceneStart(scene.id)+scene.previewTime;
 assert.equal(review.api.time,expected);
 assert.equal(review.elements.get('#play').textContent,'▶ Putar');
 assert.equal(review.elements.get('#narrationAudio').paused,true);
 assert(review.markup().includes(reviewClasses[scene.id]));
 review.tick(100);assert.equal(review.api.time,expected,'Reviews wait for Play');
 review.elements.get('#play').click();review.tick(100);
 assert(Math.abs(review.api.time-expected-100)<.01,'Review playback follows its recording position');
}
for(const id of ['leader-rules','anchor'])assert.equal(launchAt('?scene='+id).api.time,sceneStart('exchange')+37300);
const gmReview=launchAt('?scene=final&cue=gm-example');
assert.equal(gmReview.api.time,sceneStart('final')+pointConfig.overviewDuration+pointConfig.example.previewTime);
assert(gmReview.markup().includes('gm-exchange-scene'));
const preparationReview=launchAt('?scene=inspection&cue=terawang-preparation');
assert.equal(preparationReview.api.time,sceneStart('inspection')+preparation.previewTime);
assert(preparationReview.markup().includes('terawang-preparation-scene'));
for(const name of fs.readdirSync(root).filter(name=>/^review-[\w-]+\.html$/.test(name))){
 const page=fs.readFileSync(path.join(root,name),'utf8');
 assert(page.includes('voiceover-1310-sync-1'),'Review links use the new cache version');
}
const recording=launchAt('?scene=leader-rules&autoplay&record');
assert.equal(recording.api.time,0,'Recording must start at scene 1 even when a review scene is supplied');
assert.equal(recording.elements.get('#play').textContent,'Ⅱ Jeda');
const invalidReview=launchAt('?scene=missing');assert.equal(invalidReview.api.time,0);assert(!invalidReview.elements.get('#launch').hidden);
const reviewHtml=fs.readFileSync(path.join(root,'review-frame-12.html'),'utf8');
assert(reviewHtml.includes('index.html?scene=exchange&amp;v=voiceover-1310-sync-1'));
assert(html.includes('styles.css?v=faction-colour-box-2'));assert(html.includes('script.js?v=faction-colour-box-2'));
// Check the node reconciliation itself keeps existing decoded image elements.
function node(type,name,value='',attrs={}){
 const n={nodeType:type,nodeName:name,nodeValue:value,childNodes:[],_attrs:{...attrs},
  get attributes(){return Object.entries(this._attrs).map(([name,value])=>({name,value}))},
  hasAttribute(k){return k in this._attrs},getAttribute(k){return this._attrs[k]},setAttribute(k,v){this._attrs[k]=v},removeAttribute(k){delete this._attrs[k]},
  appendChild(c){this.childNodes.push(c);c.parent=this},replaceChild(c,o){this.childNodes[this.childNodes.indexOf(o)]=c;c.parent=this},
  get lastChild(){return this.childNodes.at(-1)},remove(){this.parent.childNodes.pop()},
  cloneNode(){const copy=node(type,name,this.nodeValue,this._attrs);this.childNodes.forEach(c=>copy.appendChild(c.cloneNode()));return copy}};
 return n;
}
const target=node(1,'DIV'),source=node(1,'DIV');
const original=node(1,'IMG','',{src:'assets/azure-dragon.png',style:'opacity:0'});
target.appendChild(original);source.appendChild(node(1,'IMG','',{src:'assets/azure-dragon.png',style:'opacity:1'}));
context.testTarget=target;context.testSource=source;vm.runInContext('syncChildren(testTarget,testSource)',context);
assert.equal(target.childNodes[0],original);assert.equal(original.getAttribute('style'),'opacity:1');
async function checkBlockedAudio(){
 const blocked=launchAt('?scene=intro');
 const track=blocked.elements.get('#narrationAudio');
 blocked.api.config.narration.enabled=true;track.src=blocked.api.config.narration.asset;
 track.play=()=>Promise.reject(Object.assign(new Error('User gesture required'),{name:'NotAllowedError'}));
 blocked.api.play();await new Promise(resolve=>setImmediate(resolve));
 const button=blocked.elements.get('#voiceoverControl');
 assert.equal(button.hidden,false);assert.equal(button.textContent,'Aktifkan suara');
 track.play=()=>{track.paused=false;return Promise.resolve()};
 button.click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(track.paused,false);assert.equal(button.textContent,'Suara: aktif');
 blocked.api.pause();
 console.log(`PASS: ${Math.floor(api.total/100)+1} timeline samples; full recorded narration synchronized to the audio clock; play, pause, seeking and autoplay recovery; frame 2 has two Leaders per faction, one per room, and both approved warnings; paused and reversible scene clock; per-movement VIP +3, Pretender -3, Civilian -1 and Warden +1; BO3 Gambler; faster gated role reveal; fixed Leaders; shared valid Exchange rolls; Exchange-only explanation; no answer submission; highest-point winning rule; narrated closing; paused review links; recording from zero.`);
}
checkBlockedAudio().catch(error=>{console.error(error);process.exitCode=1});
