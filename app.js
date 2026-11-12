const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const toast = $('#toast');
let toastTimer;
function notify(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// Workspace views: every navigation button selects one matching view.
const pages = {
  overview: ['Overview', 'Good morning, Admin', "Your lake is looking good today. Here's what's happening on the water."],
  missions: ['Missions', 'Mission control', 'Track your current run or plan the next lake-cleaning mission.'],
  analytics: ['Analytics', 'Lake insights', 'Review waste detections and environmental readings.'],
  system: ['System', 'Robot systems', 'Check camera connections and system status.']
};
function showPage(key) {
  if (!pages[key]) return;
  $$('[data-workspace-page]').forEach(view => { view.hidden = view.dataset.workspacePage !== key; });
  $('#page-name').textContent = pages[key][0];
  $('#page-title').textContent = pages[key][1];
  $('#page-subtitle').textContent = pages[key][2];
  $$('[data-page]').forEach(button => button.classList.toggle('active', button.dataset.page === key));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
$$('[data-page]').forEach(button => button.addEventListener('click', () => showPage(button.dataset.page)));
$$('[data-page="overview"]').forEach(button => button.addEventListener('click', () => showPage('overview')));
$('#open-camera-setup')?.addEventListener('click', () => {
  showPage('overview');
  requestAnimationFrame(() => $('#camera-monitor')?.scrollIntoView({ behavior:'smooth', block:'start' }));
});

function updateClock() {
  const now = new Date();
  $('#live-date-time').textContent = `${new Intl.DateTimeFormat(undefined, { weekday:'long', month:'long', day:'numeric', year:'numeric' }).format(now).toUpperCase()} · ${new Intl.DateTimeFormat(undefined, { hour:'2-digit', minute:'2-digit', second:'2-digit', timeZoneName:'short' }).format(now)}`;
}
updateClock(); setInterval(updateClock, 1000);

// Local weather uses browser location and Open-Meteo. Geocoding is best effort.
const WEATHER = { 0:['Clear sky','☀'],1:['Mostly clear','🌤'],2:['Partly cloudy','⛅'],3:['Overcast','☁'],45:['Fog','🌫'],48:['Fog','🌫'],51:['Drizzle','🌦'],53:['Drizzle','🌦'],55:['Heavy drizzle','🌧'],61:['Light rain','🌧'],63:['Rain','🌧'],65:['Heavy rain','🌧'],71:['Light snow','🌨'],73:['Snow','🌨'],75:['Heavy snow','❄'],80:['Rain showers','🌦'],81:['Rain showers','🌧'],82:['Heavy showers','⛈'],95:['Thunderstorm','⛈'],96:['Thunderstorm','⛈'],99:['Thunderstorm','⛈'] };
async function placeName(lat, lon, fallback) {
  try {
    const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    const d = await r.json(); const city = d.city || d.locality; if (city) return [city, d.principalSubdivision].filter(Boolean).join(', ');
  } catch {}
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`);
    const a = (await r.json()).address || {}; const city = a.city || a.town || a.municipality || a.county || a.state_district;
    if (city) return [city, a.state].filter(Boolean).join(', ');
  } catch {}
  return fallback;
}
async function weatherAt(lat, lon, fallback) {
  $('#weather-status').textContent = 'Fetching current conditions…';
  placeName(lat, lon, fallback).then(name => { $('#weather-location').textContent = name; });
  try {
    const p = new URLSearchParams({ latitude:lat, longitude:lon, current:'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m', timezone:'auto' });
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`); if (!r.ok) throw Error();
    const c = (await r.json()).current, [desc, icon] = WEATHER[c.weather_code] || ['Current conditions','☁'];
    $('#weather-temp').textContent = `${Math.round(c.temperature_2m)}°`; $('#weather-description').textContent = desc;
    $('#weather-icon').textContent = icon; $('#weather-wind').textContent = `↗ ${Math.round(c.wind_speed_10m)} km/h`;
    $('#weather-status').textContent = `Updated ${new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(new Date(c.time))} · Open-Meteo`;
  } catch { $('#weather-status').textContent = 'Live weather unavailable · retry'; $('#weather-description').textContent = 'No connection'; }
  finally { $('#weather-refresh').disabled = false; }
}
function refreshWeather() {
  $('#weather-refresh').disabled = true;
  const fallback = () => weatherAt(18.5204,73.8567,'Pune, Maharashtra · fallback');
  if (!navigator.geolocation) return fallback();
  navigator.geolocation.getCurrentPosition(p => weatherAt(p.coords.latitude,p.coords.longitude,'Nearby city unavailable'), fallback, { timeout:8000, maximumAge:900000 });
}
$('#weather-refresh')?.addEventListener('click', refreshWeather); refreshWeather(); setInterval(refreshWeather, 900000);

// Mode profiles automatically set the two operator-adjustable robot controls.
const modeProfiles = {
  'Cleaning': { collection:true, sonar:true, collectionText:'Running · obstruction watch', sonarText:'Active · 20m range' },
  'Survey': { collection:false, sonar:true, collectionText:'Paused · survey mode', sonarText:'Active · 20m range' },
  'Low-Power Patrol': { collection:false, sonar:true, collectionText:'Paused · power saving', sonarText:'Reduced duty · safety active' },
  'Return-to-Dock': { collection:false, sonar:true, collectionText:'Paused · returning to dock', sonarText:'Active · navigation safety' },
  'Emergency-Safe': { collection:false, sonar:true, collectionText:'Stopped · emergency safe', sonarText:'Active · safety monitoring' }
};
function setControlToggle(name, enabled, description) {
  $$(`[data-toggle="${name}"]`).forEach(row=>row.querySelector('.switch')?.classList.toggle('on',enabled));
  const id=name==='collection'?'conveyor-status':'sonar-status';
  if(description) $$('#'+id).forEach(text=>text.textContent=description);
}
function applyOperatingMode(mode, announce=false) {
  const profile=modeProfiles[mode]; if(!profile)return;
  $$('#mode-select').forEach(select=>{if(select.value!==mode)select.value=mode;});
  setControlToggle('collection',profile.collection,profile.collectionText);
  setControlToggle('sonar',profile.sonar,profile.sonarText);
  if(announce)notify(`${mode} mode · controls updated`);
}
$$('#mode-select').forEach(select=>select.addEventListener('change',event=>applyOperatingMode(event.target.value,true)));
$$('.toggle-row').forEach(row=>row.addEventListener('click',()=>{
  const name=row.dataset.toggle;
  const enabled=!row.querySelector('.switch').classList.contains('on');
  const descriptions={collection:enabled?'Running · manual override':'Paused · manual override',sonar:enabled?'Active · manual override':'Paused · manual override'};
  setControlToggle(name,enabled,descriptions[name]);
}));
applyOperatingMode($('#mode-select')?.value||'Cleaning');

// Shared mission model: both overview and Missions cards are rendered together.
let mission = 'running', missionDurationSeconds = 1800, missionElapsedSeconds = 0, missionSecondsRemaining = 1800;
let missionProgress = 0, missionArea = '2000', missionCoveredHa = 0, missionWasteKg = 0, missionWaypointsTotal = 12;
function syncDetails() {
  const panel = $('.mission-panel'); if (!panel || !$('#mission-details-title')) return;
  $('#mission-details-title').textContent = panel.querySelector('h2').childNodes[0]?.textContent.trim() || 'Current mission';
  $('#mission-detail-state').textContent = `Status: ${$('.mission-state-label',panel).textContent}`;
  $('#detail-id').textContent = $('.mission-id',panel)?.textContent || '—';
  $('#detail-route').textContent = $('.mission-route b',panel).textContent.replace('Route: ','');
  $('#detail-progress').textContent = $('.progress-label',panel).textContent;
  $('#detail-area').textContent = $('.area-value',panel).textContent.trim();
  $('#detail-waste').textContent = $('.mission-waste',panel).textContent.trim();
  $('#detail-time').textContent = $('.time-remaining',panel).textContent.trim();
  $('#detail-waypoints').textContent = $('.mission-route small',panel).textContent.replace('Waypoints ','');
}
function renderMission() {
  missionProgress = Math.min(100, Math.max(0, missionProgress));
  const mmss = n => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  const reached = Math.min(missionWaypointsTotal, Math.floor(missionProgress/100*missionWaypointsTotal));
  $$('.mission-panel').forEach(panel => {
    const aborted = mission === 'aborted';
    let abortedView = $('.mission-aborted-view',panel);
    if (!abortedView) {
      abortedView=document.createElement('div'); abortedView.className='mission-aborted-view';
      abortedView.innerHTML='<div class="mission-danger-icon" aria-hidden="true">🚨</div><h3>MISSION ABORTED</h3><p>The mission was stopped. Start a new run when ready.</p>';
      const controls = $('.mission-bottom',panel);
      if (controls) panel.insertBefore(abortedView,controls); else panel.append(abortedView);
    }
    abortedView.hidden=!aborted;
    ['.mission-progress-head','.progress-track','.mission-stats'].forEach(selector=>{
      const section=$(selector,panel); if(section)section.hidden=aborted;
    });
    $('.progress-label',panel).textContent = `${Math.floor(missionProgress)}%`;
    $('.mission-progress',panel).style.width = `${missionProgress}%`;
    $('.area-value',panel).innerHTML = `${Math.round(missionCoveredHa).toLocaleString()} <em>/ ${Number(missionArea).toLocaleString()} sq ft</em>`;
    $('.mission-waste',panel).innerHTML = `${missionWasteKg.toFixed(1)} <em>kg</em>`;
    $('.time-remaining',panel).innerHTML = `${mmss(missionSecondsRemaining)} <em>min</em>`;
    $('.mission-route small',panel).innerHTML = `Waypoints <strong>${reached}</strong> of <strong>${missionWaypointsTotal}</strong> reached`;
    $('.mission-progress-head>span',panel).textContent = `Mission progress · elapsed ${mmss(missionElapsedSeconds)}`;
    $('.mission-state-label',panel).textContent = mission === 'running' ? 'IN PROGRESS' : mission === 'paused' ? 'PAUSED' : mission === 'aborted' ? 'MISSION ABORTED' : 'COMPLETED';
    $('.pause-mission',panel).innerHTML = mission === 'paused' ? '▶ <span>Resume</span>' : 'Ⅱ <span>Pause</span>';
    $('.pause-mission',panel).disabled = mission !== 'running' && mission !== 'paused';
  });
  syncDetails();
}
function resetMission() { missionElapsedSeconds=0; missionSecondsRemaining=missionDurationSeconds; missionProgress=0; missionCoveredHa=0; missionWasteKg=0; }
$$('.start-mission').forEach(b => b.addEventListener('click', () => { if (mission==='aborted'||mission==='ended') resetMission(); mission='running'; renderMission(); notify('Mission started · simulated'); }));
$$('.pause-mission').forEach(b => b.addEventListener('click', () => { if (mission==='ended') return; mission=mission==='running'?'paused':'running'; renderMission(); notify(mission==='paused'?'Mission paused · simulated':'Mission resumed · simulated'); }));
$$('.stop-mission').forEach(b => b.addEventListener('click', () => { mission='aborted'; renderMission(); notify('Mission aborted · progress stopped'); }));
$$('#return-dock').forEach(button=>button.addEventListener('click',()=>{
  mission='aborted';
  applyOperatingMode('Return-to-Dock');
  renderMission();
  syncDetails();
  const signal=$('.dock-signal'); if(signal)signal.innerHTML='<i></i><i></i>';
  const dockText=$('.dock-status small'); if(dockText)dockText.textContent='Returning · simulated navigation';
  notify('Mission progress stopped · returning to dock');
}));
$$('.mission-details').forEach(b => b.addEventListener('click', () => { syncDetails(); $('#mission-details-modal').classList.add('open'); $('#mission-details-modal').setAttribute('aria-hidden','false'); }));
setInterval(() => {
  if (mission !== 'running') return;
  missionElapsedSeconds++; missionSecondsRemaining=Math.max(0,missionDurationSeconds-missionElapsedSeconds);
  missionProgress=missionElapsedSeconds/missionDurationSeconds*100;
  missionCoveredHa=Number(missionArea)*missionProgress/100; missionWasteKg+=Math.random()*0.006;
  if (missionSecondsRemaining===0) mission='ended'; renderMission();
},1000);
renderMission();

// Mission planner
const planner = $('#modal');
function closePlanner(){planner.classList.remove('open');planner.setAttribute('aria-hidden','true');}
$('#plan-mission')?.addEventListener('click',()=>{planner.classList.add('open');planner.setAttribute('aria-hidden','false');$('#mission-name-input').focus();});
$('#create-mission')?.addEventListener('click',()=>{
  const name=$('#mission-name-input').value.trim()||'New cleaning mission';
  const durationMinutes = Number($('#plan-duration').value);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440) {
    $('#plan-duration').setCustomValidity('Enter a whole number from 1 to 1440 minutes.');
    $('#plan-duration').reportValidity();
    return;
  }
  $('#plan-duration').setCustomValidity('');
  const [route,area]=$('#plan-area').value.split('|'); missionArea=area; missionDurationSeconds=durationMinutes*60; missionWaypointsTotal=route==='Full lake perimeter'?18:12;
  const id=`#MS-${Math.floor(2100+Math.random()*800)}`;
  $$('.mission-panel h2').forEach(h=>{h.replaceChildren(document.createTextNode(`${name} `));const s=document.createElement('span');s.className='mission-id';s.textContent=id;h.append(s);});
  $$('.mission-route b').forEach(el=>el.textContent=`Route: ${route}`); resetMission(); mission='running';
  renderMission(); closePlanner(); notify('New simulated mission created.');
});

// Dialog close and escape handling.
$$('.modal-close').forEach(b=>b.addEventListener('click',()=>{const modal=b.closest('.modal-backdrop');modal.classList.remove('open');modal.setAttribute('aria-hidden','true');}));
$$('.modal-backdrop').forEach(m=>m.addEventListener('click',e=>{if(e.target===m){m.classList.remove('open');m.setAttribute('aria-hidden','true');}}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){$$('.modal-backdrop.open').forEach(m=>{m.classList.remove('open');m.setAttribute('aria-hidden','true');});}});

// Basic camera mode interactions remain available in the dashboard.
$$('[data-map]').forEach(tab=>tab.addEventListener('click',()=>{if(typeof switchMapCSS==='function')switchMapCSS(tab.dataset.map);}));
// Expand the map into a dedicated overlay and move it back when closed.
const mapModal = $('#map-modal');
const mapElement = $('#lake-map');
function closeMap() {
  if (!mapModal || !mapElement) return;
  $('#map-placeholder')?.after(mapElement);
  mapModal.classList.remove('open'); mapModal.setAttribute('aria-hidden','true');
  document.body.classList.remove('map-screen');
}
$('.map-expand')?.addEventListener('click',()=>{
  $('#map-modal-content').append(mapElement);
  mapModal.classList.add('open'); mapModal.setAttribute('aria-hidden','false');
  document.body.classList.add('map-screen');
});
$('#close-map')?.addEventListener('click',closeMap);
mapModal?.addEventListener('click',event=>{if(event.target===mapModal)closeMap();});
$$('.map-zoom button').forEach((button,index)=>button.addEventListener('click',()=>{
  const shape=$('.lake-shape'); const zoom=Number(shape.dataset.zoom||1);
  const next=Math.max(1,Math.min(2,zoom+(index===0?.2:-.2)));
  shape.dataset.zoom=next; shape.style.transform=`scale(${next})`;
}));
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeMap();});
$('#alert-banner .alert-close')?.addEventListener('click',()=>$('#alert-banner').remove());
$('.notification-button')?.addEventListener('click',()=>notify('Prototype notification · simulated data'));

// Camera demo boxes are explicitly illustrative. A configured backend can replace them.
const cameraDemo = {
  surface: [
    { label:'Plastic bottle · 91%', box:[17,32,20,27] },
    { label:'Floating debris · 84%', box:[61,52,23,25] }
  ],
  underwater: [
    { label:'Submerged plastic · 88%', box:[23,36,22,27] },
    { label:'Debris · 79%', box:[65,52,21,26] }
  ]
};
const liveCounts = { surface: 0, underwater: 0 };
const detectionHistory = [];
const lastHistorySignature = { surface:'', underwater:'' };
const BACKEND_KEY = 'lakeclean.backendUrl';
const backendInput = $('#backend-url');
function backendBase() {
  const saved = localStorage.getItem(BACKEND_KEY);
  if (saved) return saved.replace(/\/+$/, '');
  // When the dashboard is served by the included backend, use that same origin.
  if (location.hostname === '127.0.0.1' || location.hostname === 'localhost') return 'http://127.0.0.1:8001';
  return '';
}
if (backendInput) backendInput.value = backendBase();
$('#save-backend')?.addEventListener('click', async () => {
  const value = backendInput?.value.trim().replace(/\/+$/, '') || '';
  if (value && !/^https?:\/\//i.test(value)) {
    $('#detection-status').textContent = 'Backend URL must start with http:// or https://';
    return;
  }
  if (value) localStorage.setItem(BACKEND_KEY, value); else localStorage.removeItem(BACKEND_KEY);
  $('#detection-status').textContent = value ? 'Checking inference backend…' : 'Backend URL cleared';
  try {
    if (!value) throw new Error('Enter the URL where the LakeClean backend is running');
    const response = await fetch(`${value}/api/health`, {cache:'no-store'});
    if (!response.ok) throw new Error(`Backend returned ${response.status}`);
    const health = await response.json();
    if (!health.model_loaded) throw new Error(`Backend is online but YOLO did not load${health.model_error ? `: ${health.model_error}` : ''}`);
    $('#detection-status').textContent = 'Backend connected · YOLO ready · connect camera feeds to start detection';
    pollDetectionsWithoutOverlap();
  } catch (error) {
    $('#detection-status').textContent = `Backend not reachable: ${error.message}`;
  }
});
function renderDetectionCounts() {
  $('#surface-count').textContent = liveCounts.surface;
  $('#underwater-count').textContent = liveCounts.underwater;
  $('#event-count').textContent = liveCounts.surface + liveCounts.underwater;
}
function recordDetections(camera, detections, source='Live') {
  const signature = `${camera}:${detections.map(d=>`${d.class}:${Math.round(d.confidence*100)}`).sort().join('|')}`;
  if (signature === lastHistorySignature[camera]) return;
  lastHistorySignature[camera] = signature;
  const time = new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'}).format(new Date());
  for (const d of detections) detectionHistory.unshift({camera, item:d.class, confidence:d.confidence, time, source});
  detectionHistory.splice(20);
  renderDetectionHistory();
}
function renderDetectionHistory() {
  const list=$('#detection-history'); if(!list)return;
  list.replaceChildren();
  if (!detectionHistory.length) { const empty=document.createElement('span'); empty.textContent='No detections recorded yet'; list.append(empty); return; }
  for (const entry of detectionHistory) {
    const row=document.createElement('span');
    row.textContent=`${entry.source}: ${entry.item} · ${entry.camera} · ${Math.round(entry.confidence*100)}% · ${entry.time}`;
    list.append(row);
  }
}
function paintCameraBoxes(camera, detections) {
  const scene = $(`#${camera}-view .water-scene`); if (!scene) return;
  scene.querySelectorAll('.detection-box').forEach(box=>box.remove());
  detections.forEach((d,index)=>{
    const box=document.createElement('div'); box.className=`detection-box detection-${index%2?'b':'a'}`;
    const [x,y,w,h] = d.box;
    Object.assign(box.style,{left:`${x*100}%`,top:`${y*100}%`,width:`${w*100}%`,height:`${h*100}%`});
    const label=document.createElement('span');
    label.textContent=`${d.class} · ${Math.round(d.confidence*100)}%${d.depth_m == null ? '' : ` · ${Number(d.depth_m).toFixed(2)} m`}`;
    box.append(label); scene.append(box);
  });
}
function setDemoBoxes() {
  if ($('#demo-mode')?.checked) {
    for (const camera of ['surface','underwater']) liveCounts[camera] = cameraDemo[camera].length;
    for (const camera of ['surface','underwater']) {
      const items=cameraDemo[camera].map(d=>({class:d.label.split(' · ')[0],confidence:Number(d.label.split(' · ')[1].replace('%',''))/100,box:d.box.map(n=>n/100)}));
      paintCameraBoxes(camera,items); recordDetections(camera,items,'Demo');
    }
    $('#detection-status').textContent='Demo boxes are simulated · no YOLO service connected';
  } else {
    liveCounts.surface=0; liveCounts.underwater=0;
    paintCameraBoxes('surface',[]); paintCameraBoxes('underwater',[]);
    $('#detection-status').textContent='Waiting for live inference backend · no detections available';
  }
  renderDetectionCounts();
}
$('#demo-mode')?.addEventListener('change',setDemoBoxes);
async function pollLiveDetections() {
  if ($('#demo-mode')?.checked) return;
  const base = backendBase();
  if (!base) {
    $('#detection-status').textContent = 'Set the public or local backend URL below to enable live YOLO detection';
    return;
  }
  let received = false;
  const errors = [];
  try {
    const healthResponse=await fetch(`${base}/api/health`,{cache:'no-store'});
    if(healthResponse.ok){
      const health=await healthResponse.json();
      for(const camera of ['surface','underwater']){
        const url=localStorage.getItem(`lakeclean.${camera}Url`);
        if(url && !health.cameras?.[camera]){
          const configured=await fetch(`${base}/api/cameras/config`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({camera,url})});
          if(!configured.ok)errors.push(`${camera}: could not register stream with backend`);
        }
      }
    }
  } catch { errors.push('YOLO backend unavailable: start LakeClean Backend.bat'); }
  for (const camera of ['surface','underwater']) {
    try {
      const response = await fetch(`${base}/api/detections?camera=${camera}`, { cache:'no-store' });
      if (!response.ok) {
        let detail = `${response.status} ${response.statusText}`;
        try { const body = await response.json(); if (body.detail) detail = body.detail; } catch {}
        errors.push(`${camera}: ${detail}`);
        continue;
      }
      const payload = await response.json();
      if (!Array.isArray(payload.detections)) continue;
      const valid = payload.detections.filter(d=>typeof d.class==='string' && Number.isFinite(d.confidence) && Array.isArray(d.box) && d.box.length===4 && d.box.every(n=>Number.isFinite(n)&&n>=0&&n<=1));
      liveCounts[camera]=valid.length;
      paintCameraBoxes(camera,valid);
      recordDetections(camera,valid,'Live');
      if (camera==='underwater' && payload.depth_calibrated===true && Number.isFinite(payload.depth_m)) $('#depth-reading').textContent=`Calibrated depth: ${payload.depth_m.toFixed(2)} m`;
      received = true;
      renderDetectionCounts();
    } catch { /* Backend is optional until the YOLO service is started. */ }
  }
  $('#detection-status').textContent=received ? 'Live YOLO detections · boxes update from inference backend' : errors.length ? errors.join(' · ') : 'No YOLO backend detected · follow README setup to enable live detection';
}
let detectionPollInFlight = false;
async function pollDetectionsWithoutOverlap() {
  if (detectionPollInFlight) return;
  detectionPollInFlight = true;
  try { await pollLiveDetections(); } finally { detectionPollInFlight = false; }
}
setInterval(pollDetectionsWithoutOverlap,2500);
for (const camera of ['surface','underwater']) {
  const urlInput=$(`#${camera}-url`), image=$(`#${camera}-stream`), status=$(`#${camera}-state`);
  const key=`lakeclean.${camera}Url`;
  if (urlInput) {
    urlInput.value=localStorage.getItem(key)||'';
    const connectButton=$('button[type="submit"]',$(`[data-camera-form="${camera}"]`));
    if (urlInput.value) { image.src=urlInput.value; image.style.display='block'; status.textContent='● Connecting…'; }
    $(`[data-camera-form="${camera}"]`)?.addEventListener('submit',event=>{
      event.preventDefault(); const url=urlInput.value.trim();
      if (connectButton.dataset.connected==='true') {
        connectButton.dataset.connected='false'; connectButton.textContent='Connect';
        urlInput.value='';
        image.removeAttribute('src'); image.style.display='none'; status.textContent='● Disconnected'; status.classList.remove('connected');
        localStorage.removeItem(key); paintCameraBoxes(camera,[]); liveCounts[camera]=0; renderDetectionCounts();
        const base=backendBase();
        if (base) fetch(`${base}/api/cameras/config`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({camera,url:''})}).catch(()=>{});
        return;
      }
      if (!url) { status.textContent='● Enter camera URL'; return; }
      if (!/^https?:\/\//i.test(url)) { status.textContent='● Use http:// or https:// URL'; return; }
      const base=backendBase();
      if (!base) { status.textContent='● Set backend URL below'; $('#detection-status').textContent='Set the public or local backend URL below before connecting a camera'; return; }
      localStorage.setItem(key,url); image.src=url; image.style.display='block'; status.textContent='● Connecting…';
      $('#demo-mode').checked=false; setDemoBoxes();
      fetch(`${base}/api/cameras/config`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({camera,url})})
        .then(async response=>{if(!response.ok)throw new Error((await response.json()).detail||'Backend rejected camera URL');connectButton.dataset.connected='true';connectButton.textContent='Disconnect';status.textContent='● Stream connected';status.classList.add('connected');$('#detection-status').textContent=`${camera} connected to YOLO · waiting for detections`;pollDetectionsWithoutOverlap();})
        .catch(error=>{$('#detection-status').textContent=`Camera stream is visible, but the inference backend could not register it: ${error.message}`;});
    });
    image?.addEventListener('load',()=>{status.textContent='● Stream connected';status.classList.add('connected');connectButton.dataset.connected='true';connectButton.textContent='Disconnect';});
    image?.addEventListener('error',()=>{status.textContent='● Stream unavailable';status.classList.remove('connected');});
  }
}
setDemoBoxes();




