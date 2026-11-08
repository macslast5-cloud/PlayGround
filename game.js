(() => {
  const $ = (id) => document.getElementById(id);
  const state = {
    running: false, ended: false, elapsed: 0, power: 100, cameraOpen: false, selectedCam: 'stage',
    doors: { west: false, east: false }, lights: { west: false, east: false },
    threats: [
      { name: 'Marlow', side: 'west', route: ['stage', 'dining', 'west', 'door'], step: 0, nextMove: 13, hold: 0 },
      { name: 'Pip', side: 'east', route: ['stage', 'storage', 'east', 'door'], step: 0, nextMove: 19, hold: 0 }
    ],
    lastTick: 0, powerOutAt: null, toastTimer: null
  };
  const locations = {
    stage: { label: 'SHOW STAGE', number: '01' }, dining: { label: 'DINING ROOM', number: '02' },
    west: { label: 'WEST HALL', number: '03' }, east: { label: 'EAST HALL', number: '04' }, storage: { label: 'BACK STORAGE', number: '05' }
  };
  const camNodes = [...document.querySelectorAll('.cam-node')];
  const monitor = $('monitor');

  function toast(message) {
    const el = $('toast'); el.textContent = message; el.classList.add('show');
    clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.remove('show'), 1700);
  }
  function updatePower() {
    const value = Math.max(0, Math.ceil(state.power));
    $('power').textContent = value;
    $('backup').textContent = `${value}%`;
    $('powerBar').style.width = `${value}%`;
    $('powerBar').style.background = value < 20 ? '#d34f43' : value < 45 ? '#d1a353' : '#c9a763';
    if (value <= 0 && state.powerOutAt === null) blackout();
  }
  function redrawDoors() {
    for (const side of ['west', 'east']) {
      const button = $(side === 'west' ? 'leftDoor' : 'rightDoor');
      const shutter = $(side === 'west' ? 'leftShutter' : 'rightShutter');
      const status = $(side === 'west' ? 'leftState' : 'rightState');
      button.classList.toggle('active', state.doors[side]);
      shutter.classList.toggle('closed', state.doors[side]);
      status.textContent = state.doors[side] ? 'CLOSED' : 'OPEN';
      status.classList.toggle('closed', state.doors[side]);
    }
  }
  function setLight(side, value) {
    if (!state.running || state.ended || state.power <= 0) return;
    state.lights[side] = value;
    const button = $(side === 'west' ? 'leftLight' : 'rightLight');
    button.classList.toggle('active', value);
    $('lightWash').classList.toggle('on', state.lights.west || state.lights.east);
    $('lightWash').style.background = state.lights.west && state.lights.east
      ? 'radial-gradient(ellipse at 8% 54%,#e0c59677,transparent 31%),radial-gradient(ellipse at 92% 54%,#e0c59677,transparent 31%)'
      : state.lights.east ? 'radial-gradient(ellipse at 92% 54%,#e0c59677,transparent 31%)' : 'radial-gradient(ellipse at 8% 54%,#e0c59677,transparent 31%)';
    refreshThreat();
  }
  function toggleDoor(side) {
    if (!state.running || state.ended || state.power <= 0) return;
    state.doors[side] = !state.doors[side]; redrawDoors();
    if (state.doors[side]) toast(`${side.toUpperCase()} HALL SECURED`);
    else toast(`${side.toUpperCase()} DOOR OPEN`);
  }
  function openMonitor(open = !state.cameraOpen) {
    if (!state.running || state.ended || state.power <= 0) return;
    state.cameraOpen = open;
    monitor.classList.toggle('open', open);
    $('monitorToggle').classList.toggle('active', open);
    if (open) { state.lights.west = state.lights.east = false; $('leftLight').classList.remove('active'); $('rightLight').classList.remove('active'); $('lightWash').classList.remove('on'); }
    refreshCamera();
  }
  function selectCamera(cam) {
    state.selectedCam = cam;
    camNodes.forEach(node => node.classList.toggle('active', node.dataset.cam === cam));
    refreshCamera();
  }
  function refreshCamera() {
    const room = $('feedRoom');
    room.className = `feed-room cam-${state.selectedCam}`;
    $('feedLabel').textContent = locations[state.selectedCam].label;
    const hr = Math.min(5, Math.floor(state.elapsed / 25));
    const min = Math.floor((state.elapsed % 25) * 2.4);
    $('feedTimestamp').textContent = `CAM ${locations[state.selectedCam].number} • ${hr === 0 ? 12 : hr} : ${String(min).padStart(2, '0')} AM`;
    const isHere = state.threats.some(threat => threat.route[threat.step] === state.selectedCam || (state.selectedCam === 'west' && threat.side === 'west' && threat.route[threat.step] === 'door') || (state.selectedCam === 'east' && threat.side === 'east' && threat.route[threat.step] === 'door'));
    $('feedCharacter').classList.toggle('hidden', !isHere);
    $('signalLost').classList.toggle('show', state.power <= 0);
  }
  function refreshThreat() {
    const threat = state.threats.find(item => item.route[item.step] === 'west' || item.route[item.step] === 'east' || item.route[item.step] === 'door');
    const inWest = state.threats.some(item => item.side === 'west' && ['west', 'door'].includes(item.route[item.step]));
    const inEast = state.threats.some(item => item.side === 'east' && ['east', 'door'].includes(item.route[item.step]));
    const visible = (inWest && state.lights.west) || (inEast && state.lights.east);
    $('threatFigure').classList.toggle('visible', visible);
    $('threatFigure').style.left = inWest && state.lights.west ? '7%' : 'auto';
    $('threatFigure').style.right = inEast && state.lights.east ? '7%' : 'auto';
    $('warningBanner').classList.toggle('show', inWest || inEast);
    if (state.cameraOpen) refreshCamera();
  }
  function blackout() {
    state.power = 0; state.powerOutAt = state.elapsed;
    state.doors.west = state.doors.east = false;
    state.lights.west = state.lights.east = false;
    $('lightWash').classList.remove('on'); $('leftLight').classList.remove('active'); $('rightLight').classList.remove('active');
    $('monitor').classList.remove('open'); $('warningBanner').classList.remove('show');
    state.cameraOpen = false; redrawDoors(); refreshCamera(); updatePower();
    toast('POWER FAILURE — YOU ARE IN THE DARK');
  }
  function lose(reason) {
    if (state.ended) return;
    state.ended = true; state.running = false; state.cameraOpen = false;
    monitor.classList.remove('open');
    $('endSymbol').textContent = reason === 'power' ? '⌁' : '✦';
    $('endKicker').textContent = reason === 'power' ? 'POWER FAILURE' : 'NIGHT SHIFT';
    $('endTitle').textContent = reason === 'power' ? 'TOO LATE' : 'CAUGHT';
    $('endText').textContent = reason === 'power' ? 'The backup lights went out. Something found your office.' : 'The hall went quiet. Then it didn’t.';
    $('endOverlay').classList.remove('hidden');
  }
  function win() {
    state.ended = true; state.running = false; state.cameraOpen = false;
    monitor.classList.remove('open');
    $('endSymbol').textContent = '✦'; $('endKicker').textContent = 'SHIFT COMPLETE';
    $('endTitle').textContent = '6:00 AM'; $('endText').textContent = `You made it through the night with ${Math.ceil(state.power)}% power.`;
    $('endOverlay').classList.remove('hidden');
  }
  function start() {
    state.running = true; state.ended = false; state.elapsed = 0; state.power = 100; state.cameraOpen = false;
    state.powerOutAt = null; state.doors.west = state.doors.east = false;
    state.lights.west = state.lights.east = false;
    state.threats[0].step = 0; state.threats[0].nextMove = 13;
    state.threats[1].step = 0; state.threats[1].nextMove = 19;
    state.lastTick = performance.now();
    $('intro').classList.add('hidden'); $('endOverlay').classList.add('hidden');
    $('lightWash').classList.remove('on'); $('warningBanner').classList.remove('show');
    $('threatFigure').classList.remove('visible'); $('leftLight').classList.remove('active'); $('rightLight').classList.remove('active');
    $('clock').textContent = '12'; redrawDoors(); updatePower(); refreshCamera();
    requestAnimationFrame(tick);
  }
  function tick(now) {
    if (!state.running || state.ended) return;
    const dt = Math.min((now - state.lastTick) / 1000, .1); state.lastTick = now;
    state.elapsed += dt;
    const hour = Math.min(5, Math.floor(state.elapsed / 25));
    $('clock').textContent = hour === 0 ? '12' : String(hour);
    let drain = .20 + (state.cameraOpen ? .20 : 0) + (state.doors.west ? .54 : 0) + (state.doors.east ? .54 : 0) + (state.lights.west ? .28 : 0) + (state.lights.east ? .28 : 0);
    state.power = Math.max(0, state.power - drain * dt);
    updatePower();
    if (state.powerOutAt !== null) {
      if (state.elapsed - state.powerOutAt > 7.5) { lose('power'); return; }
    } else {
      for (const threat of state.threats) {
        threat.nextMove -= dt;
        if (threat.hold > 0) threat.hold -= dt;
        if (threat.nextMove <= 0 && threat.hold <= 0) {
          const loc = threat.route[threat.step];
          if (loc === 'door') {
            if (state.doors[threat.side]) {
              threat.step = Math.max(0, threat.step - 2);
              threat.nextMove = 3.2;
              threat.hold = 1.8;
              toast(`${threat.side.toUpperCase()} DOOR IMPACT`);
            } else { lose('caught'); return; }
          } else {
            threat.step = Math.min(threat.step + 1, threat.route.length - 1);
            threat.nextMove = Math.max(7, 15 + Math.random() * 8 - state.elapsed / 42);
            threat.hold = 0;
            const next = threat.route[threat.step];
            if (next === 'west' || next === 'east') threat.nextMove = 7 + Math.random() * 4;
          }
          refreshThreat();
        }
      }
      if (state.elapsed >= 150) { win(); return; }
    }
    if (state.cameraOpen) refreshCamera();
    requestAnimationFrame(tick);
  }

  $('startButton').addEventListener('click', start);
  $('restartButton').addEventListener('click', start);
  $('leftDoor').addEventListener('click', () => toggleDoor('west'));
  $('rightDoor').addEventListener('click', () => toggleDoor('east'));
  $('leftLight').addEventListener('click', () => setLight('west', !state.lights.west));
  $('rightLight').addEventListener('click', () => setLight('east', !state.lights.east));
  $('monitorToggle').addEventListener('click', () => openMonitor());
  $('closeMonitor').addEventListener('click', () => openMonitor(false));
  camNodes.forEach(node => node.addEventListener('click', () => selectCamera(node.dataset.cam)));
  document.addEventListener('keydown', event => {
    if (event.repeat) return;
    const key = event.key.toLowerCase();
    if (key === ' ' || key === 'escape') { event.preventDefault(); if (state.running) openMonitor(key === 'escape' ? false : !state.cameraOpen); }
    if (key === 'q') toggleDoor('west'); if (key === 'e') toggleDoor('east');
    if (key === 'a') setLight('west', !state.lights.west); if (key === 'd') setLight('east', !state.lights.east);
    if (key === '1') selectCamera('stage'); if (key === '2') selectCamera('dining'); if (key === '3') selectCamera('west'); if (key === '4') selectCamera('east'); if (key === '5') selectCamera('storage');
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.running) state.lastTick = performance.now(); });
  redrawDoors(); updatePower();
})();
