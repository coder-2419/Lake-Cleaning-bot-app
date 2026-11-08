const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const toast = $('#toast');
let toastTimer;
function notify(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

const pages = {
  overview: { name: 'Overview', title: 'Good morning, Arjun', subtitle: "Your lake is looking good today. Here's what's happening on the water.", target: '.welcome-row' },
  missions: { name: 'Missions', title: 'Mission control', subtitle: 'Track your current run or plan the next lake-cleaning mission.', target: '.mission-panel' },
  analytics: { name: 'Analytics', title: 'Lake insights', subtitle: 'A simulated snapshot of collection, waste hotspots and water conditions.', target: '.insight-panel' },
  system: { name: 'System', title: 'Robot systems', subtitle: 'Check onboard systems, protection settings and simulated power connections.', target: '.health-panel' }
};
$$('[data-page]').forEach(button => button.addEventListener('click', () => {
  const page = pages[button.dataset.page];
  if (!page) return;
  $$('#page-name').forEach(el => { el.textContent = page.name; });
  $('#page-title').textContent = page.title;
  $('#page-subtitle').textContent = page.subtitle;
  $$('.nav-link, .mobile-nav button').forEach(link => link.classList.toggle('active', link.dataset.page === button.dataset.page));
  if (button.dataset.page !== 'overview' && window.innerWidth < 850) $(page.target)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}));

const cameraView = $('#camera-view');
$$('[data-camera]').forEach(tab => tab.addEventListener('click', () => {
  $$('[data-camera]').forEach(item => item.classList.toggle('selected', item === tab));
  cameraView.classList.toggle('underwater', tab.dataset.camera === 'underwater');
  const isUnderwater = tab.dataset.camera === 'underwater';
  $('.camera-overlay-top span:first-child').innerHTML = `<i></i> CAM ${isUnderwater ? '02 · SONAR' : '01 · FRONT'}`;
  $('.camera-overlay-bottom span:first-child').textContent = isUnderwater ? '⌖ DEPTH 6.4 M · SONAR ACTIVE' : '⌾ 18.5204° N  73.8567° E';
  $('.detection-a span').textContent = isUnderwater ? 'SUBMERGED PLASTIC' : 'PLASTIC BOTTLE';
  $('.detection-b span').textContent = isUnderwater ? 'SNAGGED DEBRIS' : 'FLOATING DEBRIS';
  $('#bottle-count').textContent = isUnderwater ? '05' : '03';
  $('#organic-count').textContent = isUnderwater ? '02' : '08';
  $('#other-count').textContent = isUnderwater ? '04' : '02';
  notify(`${isUnderwater ? 'Underwater' : 'Surface'} camera feed · simulated`);
}));
$$('[data-map]').forEach(tab => tab.addEventListener('click', () => {
  $$('[data-map]').forEach(item => item.classList.toggle('active', item === tab));
  const underwater = tab.dataset.map === 'underwater';
  $('.hotspots').style.filter = underwater ? 'hue-rotate(125deg) saturate(.85)' : '';
  $('.map-labels text:nth-child(1)').textContent = underwater ? 'NORTH BED' : 'NORTH COVE';
  $('.map-labels text:nth-child(2)').textContent = underwater ? 'REEF EDGE' : 'WILLOW POINT';
  $('.map-labels text:nth-child(3)').textContent = underwater ? 'DEEP BASIN' : 'SOUTH BASIN';
  $('.map-footer b').textContent = underwater ? '3 hotspots' : '4 hotspots';
  notify(`${underwater ? 'Underwater' : 'Surface'} waste density · simulated`);
}));

$('#alert-banner .alert-close').addEventListener('click', () => $('#alert-banner').remove());
$$('[data-action="inspect"]').forEach(button => button.addEventListener('click', () => {
  document.querySelector('.controls-panel').scrollIntoView({ behavior: 'smooth', block: 'center' });
  notify('Conveyor telemetry is simulated; inspect the collection control.');
}));

const switches = Object.fromEntries($$('.toggle-row').map(row => [row.dataset.toggle, row.querySelector('.switch')]));
const modeSelect = $('#mode-select');
function setSwitch(key, enabled) {
  switches[key].classList.toggle('on', enabled);
  const descriptions = {
    collection: enabled ? 'Running · obstruction watch' : 'Paused · manual override',
    sonar: enabled ? 'Active · 20m range' : 'Paused · safety fallback active',
    eco: enabled ? 'Enabled · 5m buffer' : 'Disabled · demonstration override'
  };
  $(`#${key === 'collection' ? 'conveyor' : key}-status`).textContent = descriptions[key];
}
$$('.toggle-row').forEach(row => row.addEventListener('click', () => {
  const key = row.dataset.toggle;
  const enabled = !switches[key].classList.contains('on');
  setSwitch(key, enabled);
  notify(`${row.querySelector('b').textContent} ${enabled ? 'enabled' : 'disabled'} · simulated`);
}));

function setMode(mode, announce = true) {
  $('#robot-status').textContent = mode;
  const status = mode === 'Emergency-Safe' ? 'Safety hold' : mode === 'Return-to-Dock' ? 'Returning' : mode === 'Survey' ? 'Surveying' : mode === 'Low-Power Patrol' ? 'Low-power' : 'Cleaning';
  $('#mode-value').textContent = status;
  const lowPower = mode === 'Low-Power Patrol';
  if (lowPower) {
    setSwitch('collection', false);
    setSwitch('sonar', true);
    $('#sonar-status').textContent = 'Reduced duty · safety active';
    setSwitch('eco', true);
  } else if (mode === 'Emergency-Safe') {
    setSwitch('collection', false);
    setSwitch('sonar', true);
    setSwitch('eco', true);
  } else if (mode === 'Survey') {
    setSwitch('collection', false);
    setSwitch('sonar', true);
    setSwitch('eco', true);
  } else if (mode === 'Return-to-Dock') {
    setSwitch('collection', false);
    setSwitch('sonar', true);
    setSwitch('eco', true);
  } else {
    setSwitch('collection', true);
    setSwitch('sonar', true);
    setSwitch('eco', true);
  }
  if (announce) notify(`${mode} mode selected · simulated`);
}
modeSelect.addEventListener('change', () => setMode(modeSelect.value));

let mission = 'running';
function updateMissionState() {
  const state = $('#mission-state');
  const pause = $('#pause-mission');
  if (mission === 'running') {
    state.innerHTML = '<i></i> IN PROGRESS';
    pause.innerHTML = 'Ⅱ <span>Pause</span>';
    $('#mode-value').textContent = modeSelect.value === 'Cleaning' ? 'Active' : modeSelect.value;
    $('#robot-status').textContent = modeSelect.value;
  } else if (mission === 'paused') {
    state.innerHTML = 'Ⅱ PAUSED';
    pause.innerHTML = '▶ <span>Resume</span>';
    $('#mode-value').textContent = 'Paused';
    $('#robot-status').textContent = 'Paused';
  } else {
    state.textContent = 'MISSION ENDED';
    pause.disabled = true;
    pause.style.opacity = '.45';
    $('#mode-value').textContent = 'Standby';
    $('#robot-status').textContent = 'Standby';
    $('#progress-label').textContent = '—';
    $('#mission-progress').style.width = '0%';
    $('#time-remaining').innerHTML = '— <em>min</em>';
  }
}
$('#start-mission').addEventListener('click', () => {
  mission = 'running';
  $('#pause-mission').disabled = false;
  $('#pause-mission').style.opacity = '1';
  updateMissionState();
  notify('Mission started · simulated');
});
$('#pause-mission').addEventListener('click', () => {
  if (mission === 'ended') return;
  mission = mission === 'running' ? 'paused' : 'running';
  updateMissionState();
  notify(mission === 'paused' ? 'Mission paused · simulated' : 'Mission resumed · simulated');
});
$('#stop-mission').addEventListener('click', () => {
  if (mission === 'ended') return;
  mission = 'ended';
  updateMissionState();
  modeSelect.value = 'Survey';
  setMode('Survey', false);
  $('#mode-value').textContent = 'Standby';
  notify('Mission ended; robot is in survey-safe state.');
});
$('#return-dock').addEventListener('click', () => {
  modeSelect.value = 'Return-to-Dock';
  setMode('Return-to-Dock', false);
  $('#mission-state').textContent = 'RETURNING TO DOCK';
  $('.dock-signal').innerHTML = '<i></i><i></i>';
  $('.dock-status small').textContent = 'Returning · 42m away';
  notify('Return-to-Dock engaged · simulated navigation');
});

let missionArea = '2.0';
const modal = $('#modal');
function closeModal() { modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); }
$('#plan-mission').addEventListener('click', () => { modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); $('#mission-name-input').focus(); });
$('.modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') closeModal(); });
$('#create-mission').addEventListener('click', () => {
  const name = $('#mission-name-input').value.trim() || 'New cleaning mission';
  const selectedMode = $('#plan-mode').value;
  const [areaName, areaSize] = $('#plan-area').value.split('|');
  missionArea = areaSize;
  const title = $('.mission-panel h2');
  const missionId = document.createElement('span');
  missionId.className = 'mission-id';
  missionId.textContent = `#MS-${Math.floor(2100 + Math.random() * 800)}`;
  title.replaceChildren(document.createTextNode(name + ' '), missionId);
  $('.mission-route b').textContent = `Route: ${areaName}`;
  mission = 'running';
  $('#progress-label').textContent = '0%';
  $('#mission-progress').style.width = '0%';
  $('#area-value').innerHTML = `0.00 <em>/ ${missionArea} ha</em>`;
  $('#time-remaining').innerHTML = '60:00 <em>min</em>';
  $('#pause-mission').disabled = false;
  $('#pause-mission').style.opacity = '1';
  modeSelect.value = selectedMode;
  setMode(selectedMode, false);
  updateMissionState();
  closeModal();
  notify('New simulated mission created.');
}));

// Drift small sensor readings to make it clear this page is a live-feeling simulation.
setInterval(() => {
  if (mission !== 'running') return;
  const battery = Math.max(78, Math.min(88, Number($('#battery-value').textContent) + (Math.random() > .61 ? -1 : 0)));
  const solar = Math.max(145, Math.min(218, 186 + Math.round((Math.random() - .5) * 34)));
  $('#battery-value').textContent = battery;
  $('#solar-value').textContent = solar;
}, 8000);

let mapZoom = 1;
$$('.map-zoom button').forEach((button, index) => button.addEventListener('click', () => {
  mapZoom = Math.max(1, Math.min(1.8, mapZoom + (index === 0 ? .2 : -.2)));
  $('.lake-shape').style.transform = `scale(${mapZoom})`;
  notify(`Waste map zoom · ${Math.round(mapZoom * 100)}%`);
}));
$('.map-expand').addEventListener('click', () => {
  const map = $('#lake-map');
  const expanded = map.classList.toggle('expanded');
  document.body.classList.toggle('map-screen', expanded);
  $('.map-expand').textContent = expanded ? '×' : '⛶';
  $('.map-expand').setAttribute('aria-label', expanded ? 'Close expanded map' : 'Expand map');
  notify(expanded ? 'Expanded lake map · simulated detections' : 'Returned to dashboard view');
});
const mapRanges = [{ label: 'Last 24 hours', count: '4 hotspots' }, { label: 'Last 7 days', count: '7 hotspots' }, { label: 'Last 30 days', count: '11 hotspots' }];
let mapRangeIndex = 0;
$('.map-filter').addEventListener('click', () => {
  mapRangeIndex = (mapRangeIndex + 1) % mapRanges.length;
  const range = mapRanges[mapRangeIndex];
  $('.map-filter').innerHTML = `${range.label} <span>⌄</span>`;
  $('.map-footer b').textContent = range.count;
  notify(`Waste map filtered to ${range.label.toLowerCase()} · simulated`);
});
$('.camera-res').addEventListener('click', () => {
  const resolutions = ['1080p', '720p', '480p'];
  const current = $('.camera-res').dataset.resolution || '1080p';
  const next = resolutions[(resolutions.indexOf(current) + 1) % resolutions.length];
  $('.camera-res').dataset.resolution = next;
  $('.camera-res').innerHTML = `${next} <span>⌄</span>`;
  notify(`Camera quality set to ${next} · simulated`);
});
$('.profile').addEventListener('click', () => notify('Signed in as Arjun Sharma · Field operator'));
$$('.more-button').forEach(button => button.addEventListener('click', () => notify(`${button.getAttribute('aria-label')} · simulated options`)));
$$('.mission-details, .view-detections').forEach(button => button.addEventListener('click', () => notify('Mission and detection records are simulated.')));
$('.notification-button').addEventListener('click', () => notify('1 active alert · Conveyor obstruction detected'));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && $('#lake-map').classList.contains('expanded')) $('.map-expand').click();
});
