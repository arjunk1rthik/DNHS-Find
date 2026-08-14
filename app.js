const appState = {
  userLocation: null,
  userHeading: null,
  geolocationWatch: null,
  orientationListener: null,
  permissionsGranted: { location: false, notification: false },
  currentPanel: 'schedulePanel',
  schedule: getSchedule(),
  meetingSpots: getMeetingSpots(),
  tasks: getTasks(),
  homework: getHomework(),
  pendingCalibration: null,
  friends: [],
  cameraStream: null,
  mapCenter: null
};

let canvas;
let ctx;
let gpsStatusEl;
let permissionsBannerEl;

window.addEventListener('DOMContentLoaded', init);

function init() {
  canvas = document.getElementById('mapCanvas');
  ctx = canvas.getContext('2d');
  gpsStatusEl = document.getElementById('gps-status');
  permissionsBannerEl = document.getElementById('permissionsBanner');

  bindEvents();
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  showPanel('schedulePanel');
  updateUI();
  renderMap();

  checkPermissions().finally(() => {
    if (appState.permissionsGranted.location) {
      initializeLocationTracking();
    } else {
      showPermissionsBanner();
    }
  });

  setInterval(updateSchedulePanel, 30000);
}

function bindEvents() {
  document.getElementById('permissionBtn').addEventListener('click', requestPermissions);
  document.getElementById('cameraBtn').addEventListener('click', takeCameraPhoto);
  document.getElementById('centerBtn').addEventListener('click', centerMap);
  document.getElementById('addClassBtn').addEventListener('click', addCustomClass);
  document.getElementById('addSpotBtn').addEventListener('click', addMeetingSpot);
  document.getElementById('addTaskBtn').addEventListener('click', addTask);
  document.getElementById('markLocationBtn').addEventListener('click', markCurrentLocation);
  document.getElementById('saveCalibrationBtn').addEventListener('click', saveCalibration);
  document.getElementById('clearCalibrationBtn').addEventListener('click', clearAllCalibration);
  document.getElementById('closeCameraBtn').addEventListener('click', closeCameraModal);
  document.getElementById('capturePhotoBtn').addEventListener('click', capturePhoto);

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => showPanel(btn.dataset.panel));
  });

  window.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeCameraModal();
  });
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderMap();
}

async function checkPermissions() {
  try {
    if ('permissions' in navigator) {
      const geo = await navigator.permissions.query({ name: 'geolocation' });
      appState.permissionsGranted.location = geo.state === 'granted';
      geo.addEventListener?.('change', () => {
        appState.permissionsGranted.location = geo.state === 'granted';
        updatePermissionStatus();
      });
    }

    if ('Notification' in window) {
      appState.permissionsGranted.notification = Notification.permission === 'granted';
    }
  } catch {
    // The actual permission request below is authoritative.
  }
  updatePermissionStatus();
}

async function requestPermissions() {
  if (!navigator.geolocation) {
    alert('This browser does not support GPS location.');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    position => {
      appState.permissionsGranted.location = true;
      appState.userLocation = normalizePosition(position);
      updatePermissionStatus();
      initializeLocationTracking();
      hidePermissionsBanner();
      updateUI();
      renderMap();
    },
    error => {
      appState.permissionsGranted.location = false;
      updatePermissionStatus();
      alert(`Location permission failed: ${getGeolocationError(error)}`);
    },
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
  );

  if ('Notification' in window && Notification.permission === 'default') {
    try {
      const permission = await Notification.requestPermission();
      appState.permissionsGranted.notification = permission === 'granted';
    } catch {}
  }
}

function normalizePosition(position) {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null
  };
}

function getGeolocationError(error) {
  if (error.code === 1) return 'Permission denied. Allow location access in browser settings.';
  if (error.code === 2) return 'Position unavailable.';
  if (error.code === 3) return 'GPS request timed out.';
  return error.message || 'Unknown location error.';
}

function hidePermissionsBanner() {
  permissionsBannerEl.style.display = 'none';
}

function showPermissionsBanner() {
  permissionsBannerEl.style.display = 'flex';
}

function updatePermissionStatus() {
  if (!gpsStatusEl) return;
  if (appState.userLocation) {
    gpsStatusEl.textContent = `GPS: ±${Math.round(appState.userLocation.accuracy || 0)}m`;
    gpsStatusEl.className = 'status-badge ready';
  } else if (appState.permissionsGranted.location) {
    gpsStatusEl.textContent = 'GPS: Ready';
    gpsStatusEl.className = 'status-badge ready';
  } else {
    gpsStatusEl.textContent = 'GPS: Need permission';
    gpsStatusEl.className = 'status-badge warning';
  }
}

function initializeLocationTracking() {
  if (!navigator.geolocation || appState.geolocationWatch !== null) return;

  appState.geolocationWatch = navigator.geolocation.watchPosition(
    position => {
      appState.userLocation = normalizePosition(position);
      updateGPSDisplay();
      updatePermissionStatus();
      updateSchedulePanel();
      renderMap();
    },
    error => {
      gpsStatusEl.textContent = `GPS: ${getGeolocationError(error)}`;
      gpsStatusEl.className = 'status-badge error';
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
  );

  setupOrientation();
}

async function setupOrientation() {
  if (!window.DeviceOrientationEvent) return;

  try {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission !== 'granted') return;
    }
  } catch {
    // Some browsers do not require/request this permission.
  }

  if (appState.orientationListener) return;

  appState.orientationListener = event => {
    const heading = event.webkitCompassHeading ?? (event.alpha == null ? null : 360 - event.alpha);
    if (heading != null && Number.isFinite(heading)) {
      appState.userHeading = (heading + 360) % 360;
      renderMap();
    }
  };

  window.addEventListener('deviceorientation', appState.orientationListener, true);
}

function updateGPSDisplay() {
  const el = document.getElementById('currentCoords');
  if (!appState.userLocation) {
    el.textContent = 'Not available';
    return;
  }

  const { lat, lng, accuracy } = appState.userLocation;
  el.textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)} (±${Math.round(accuracy || 0)}m)`;
}

function markCurrentLocation() {
  if (!appState.userLocation) {
    alert('Wait for GPS to obtain a location first.');
    return;
  }

  appState.pendingCalibration = {
    lat: appState.userLocation.lat,
    lng: appState.userLocation.lng,
    accuracy: appState.userLocation.accuracy,
    timestamp: new Date().toISOString()
  };

  const box = document.getElementById('pendingCalibrationBox');
  document.getElementById('pendingCalibrationText').textContent =
    ` ${appState.pendingCalibration.lat.toFixed(6)}, ${appState.pendingCalibration.lng.toFixed(6)} ` +
    `(±${Math.round(appState.pendingCalibration.accuracy || 0)}m)`;
  box.hidden = false;
  document.getElementById('calibrateRoom').focus();
}

function saveCalibration() {
  if (!appState.pendingCalibration) {
    alert('Press "Mark current location" while standing at the classroom first.');
    return;
  }

  const room = document.getElementById('calibrateRoom').value.trim().toUpperCase();
  const className = document.getElementById('calibrateClass').value.trim();
  const teacher = document.getElementById('calibrateTeacher').value.trim();

  if (!room) {
    alert('Enter the room number.');
    return;
  }

  const existing = CLASSROOM_LOCATIONS[room];
  if (existing && !confirm(`Room ${room} already exists. Replace its coordinates?`)) return;

  CLASSROOM_LOCATIONS[room] = {
    lat: appState.pendingCalibration.lat,
    lng: appState.pendingCalibration.lng,
    accuracy: appState.pendingCalibration.accuracy,
    className: className || findClass(room)?.name || 'Unknown',
    teacher: teacher || findClass(room)?.teacher || 'Unknown',
    calibratedAt: appState.pendingCalibration.timestamp
  };

  saveCalibratedLocations();
  appState.pendingCalibration = null;
  document.getElementById('pendingCalibrationBox').hidden = true;
  document.getElementById('calibrateRoom').value = '';
  document.getElementById('calibrateClass').value = '';
  document.getElementById('calibrateTeacher').value = '';

  updateUI();
  renderMap();
}

function clearAllCalibration() {
  if (!Object.keys(CLASSROOM_LOCATIONS).length) return;
  if (!confirm('Delete every calibrated classroom from this device?')) return;
  clearCalibratedLocations();
  updateUI();
  renderMap();
}

function findClass(room) {
  return CLASSES.find(c => c.room.toUpperCase() === room.toUpperCase());
}

function renderMap() {
  if (!canvas || !ctx) return;

  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#eef2f5';
  ctx.fillRect(0, 0, width, height);

  // Deliberately simple coordinate plot for calibration/testing.
  // It is NOT the final walking-navigation renderer.
  const locations = Object.values(CLASSROOM_LOCATIONS);
  const points = appState.userLocation
    ? [appState.userLocation, ...locations]
    : locations;

  if (!points.length) {
    drawMapMessage('Calibrate classrooms to build the campus test map.');
    return;
  }

  const center = appState.mapCenter || appState.userLocation || locations[0];
  const scale = calculateMapScale(points, center, width, height);

  drawGrid(width, height);
  drawNorthArrow(width, height);

  Object.entries(CLASSROOM_LOCATIONS).forEach(([room, location]) => {
    const p = projectCoordinate(location, center, scale, width, height);
    drawClassroomMarker(p.x, p.y, room, location);
  });

  if (appState.userLocation) {
    const p = projectCoordinate(appState.userLocation, center, scale, width, height);
    drawUserMarker(p.x, p.y);
  }

  const hint = document.getElementById('mapHint');
  hint.textContent = Object.keys(CLASSROOM_LOCATIONS).length
    ? `${Object.keys(CLASSROOM_LOCATIONS).length} classroom(s) calibrated`
    : 'Calibration test map';
}

function calculateMapScale(points, center, width, height) {
  if (points.length < 2) return 1;

  let maxDistance = 1;
  for (const p of points) {
    maxDistance = Math.max(maxDistance, getDistance(center.lat, center.lng, p.lat, p.lng));
  }

  const usable = Math.min(width, height) * 0.38;
  return usable / maxDistance;
}

function projectCoordinate(location, center, scale, width, height) {
  const metersNorth = (location.lat - center.lat) * 111320;
  const metersEast = (location.lng - center.lng) * 111320 * Math.cos(center.lat * Math.PI / 180);
  return {
    x: width / 2 + metersEast * scale,
    y: height / 2 - metersNorth * scale
  };
}

function drawGrid(width, height) {
  ctx.strokeStyle = '#dce2e7';
  ctx.lineWidth = 1;
  const spacing = 40;
  for (let x = 0; x < width; x += spacing) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let y = 0; y < height; y += spacing) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
  }
}

function drawNorthArrow(width, height) {
  ctx.fillStyle = '#555';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('N ↑', width - 12, 18);
}

function drawClassroomMarker(x, y, room, location) {
  if (x < -30 || y < -30 || x > canvas.clientWidth + 30 || y > canvas.clientHeight + 30) return;

  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#222';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(room, x, y);

  ctx.font = '10px sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText(location.className || '', x, y + 22);
}

function drawUserMarker(x, y) {
  ctx.fillStyle = '#378add';
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fill();

  if (appState.userLocation?.accuracy) {
    const radius = Math.max(5, appState.userLocation.accuracy * calculateMapScale(
      [appState.userLocation], appState.mapCenter || appState.userLocation,
      canvas.clientWidth, canvas.clientHeight
    ));
    ctx.strokeStyle = 'rgba(55,138,221,.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, Math.min(radius, 80), 0, Math.PI * 2);
    ctx.stroke();
  }

  if (appState.userHeading != null) {
    const rad = (appState.userHeading - 90) * Math.PI / 180;
    ctx.strokeStyle = '#378add';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(rad) * 28, y + Math.sin(rad) * 28);
    ctx.stroke();
  }
}

function drawMapMessage(message) {
  ctx.fillStyle = '#666';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(message, canvas.clientWidth / 2, canvas.clientHeight / 2);
}

function centerMap() {
  if (!appState.userLocation) {
    alert('Waiting for GPS...');
    return;
  }
  appState.mapCenter = { ...appState.userLocation };
  renderMap();
}

function updateUI() {
  updateGPSDisplay();
  updateSchedulePanel();
  updateFriendsPanel();
  updateTasksPanel();
  updateCalibratePanel();
}

function getNextClass() {
  if (!appState.schedule.length) return null;

  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();

  const future = appState.schedule
    .map((cls, index) => ({ ...cls, index, minutes: timeToMinutes(cls.startTime) }))
    .filter(c => c.minutes >= minutesNow)
    .sort((a, b) => a.minutes - b.minutes);

  return future[0] || null;
}

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function formatTime(time) {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

function updateSchedulePanel() {
  const list = document.getElementById('scheduleList');
  const next = getNextClass();

  document.getElementById('nextClassTime').textContent = next ? formatTime(next.startTime) : '--:--';
  document.getElementById('nextClassLabel').textContent = next ? `Next: ${next.room}` : 'No more classes';

  if (next && appState.userLocation && CLASSROOM_LOCATIONS[next.room]) {
    const target = CLASSROOM_LOCATIONS[next.room];
    document.getElementById('nextClassDistance').textContent =
      `${getDistance(appState.userLocation.lat, appState.userLocation.lng, target.lat, target.lng)}m`;
  } else {
    document.getElementById('nextClassDistance').textContent =
      next ? (CLASSROOM_LOCATIONS[next.room] ? '--' : 'Not calibrated') : '--';
  }

  if (!appState.schedule.length) {
    list.innerHTML = '<p class="empty">No classes in your schedule.</p>';
    return;
  }

  list.innerHTML = [...appState.schedule]
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime))
    .map((cls, i) => {
      const calibrated = !!CLASSROOM_LOCATIONS[cls.room];
      return `
        <div class="schedule-item">
          <div class="schedule-time">${escapeHTML(formatTime(cls.startTime))}</div>
          <div class="schedule-class">
            <div class="schedule-name">${escapeHTML(cls.name)}</div>
            <div class="schedule-room">Room ${escapeHTML(cls.room)} • ${escapeHTML(cls.teacher)}</div>
            <div class="calibration-state ${calibrated ? 'ok' : ''}">
              ${calibrated ? '● Location registered' : '○ Location not registered'}
            </div>
          </div>
          <button class="btn-small" data-room="${escapeHTML(cls.room)}" data-action="navigate">Test</button>
        </div>
      `;
    }).join('');

  list.querySelectorAll('[data-action="navigate"]').forEach(btn => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.room));
  });
}

function navigateTo(room) {
  // Intentionally NOT the final navigation system.
  // This is the test/measurement mode that will later be replaced
  // after all classroom coordinates are supplied.
  const target = CLASSROOM_LOCATIONS[room];

  if (!target) {
    showPanel('calibratePanel');
    document.getElementById('calibrateRoom').value = room;
    alert(`Room ${room} has not been calibrated yet. Go there and register its coordinates.`);
    return;
  }

  if (!appState.userLocation) {
    alert('Waiting for GPS location...');
    return;
  }

  const distance = getDistance(
    appState.userLocation.lat, appState.userLocation.lng,
    target.lat, target.lng
  );
  const bearing = getBearing(
    appState.userLocation.lat, appState.userLocation.lng,
    target.lat, target.lng
  );

  const headingText = appState.userHeading == null
    ? 'Compass heading unavailable'
    : `Relative direction: ${relativeDirection(bearing, appState.userHeading)}`;

  alert(
    `TEST MODE — ${room}\n\n` +
    `${distance}m away\n` +
    `Bearing: ${Math.round(bearing)}°\n` +
    `${headingText}\n\n` +
    `Final walking navigation will be added after classroom coordinates are registered.`
  );
}

function relativeDirection(bearing, heading) {
  const delta = ((bearing - heading + 540) % 360) - 180;
  if (Math.abs(delta) < 20) return 'straight ahead';
  if (Math.abs(delta) > 160) return 'behind you';
  if (delta > 0 && delta < 90) return 'ahead/right';
  if (delta >= 90) return 'right';
  if (delta < 0 && delta > -90) return 'ahead/left';
  return 'left';
}

function updateFriendsPanel() {
  const friendsList = document.getElementById('friendsList');
  friendsList.innerHTML = '<p class="empty">Friends require a backend/sync service. Local meeting spots work now.</p>';

  const spotsList = document.getElementById('meetingSpotsList');
  if (!appState.meetingSpots.length) {
    spotsList.innerHTML = '<p class="empty">No meeting spots created.</p>';
    return;
  }

  spotsList.innerHTML = appState.meetingSpots.map((spot, i) => `
    <div class="meeting-spot-item">
      <div class="spot-name">${escapeHTML(spot.name)}</div>
      <div class="spot-type">${escapeHTML(spot.type)} • ${escapeHTML(spot.time)}</div>
      <button class="btn-small danger" data-delete-spot="${i}">Delete</button>
    </div>
  `).join('');

  spotsList.querySelectorAll('[data-delete-spot]').forEach(btn => {
    btn.addEventListener('click', () => deleteMeetingSpot(Number(btn.dataset.deleteSpot)));
  });
}

function addMeetingSpot() {
  const name = document.getElementById('spotName').value.trim();
  const type = document.getElementById('spotType').value;
  const time = document.getElementById('spotTime').value;

  if (!name || !time) {
    alert('Enter a spot name and time.');
    return;
  }

  appState.meetingSpots.push({ name, type, time });
  saveMeetingSpots(appState.meetingSpots);
  document.getElementById('spotName').value = '';
  document.getElementById('spotTime').value = '';
  updateFriendsPanel();
}

function deleteMeetingSpot(index) {
  appState.meetingSpots.splice(index, 1);
  saveMeetingSpots(appState.meetingSpots);
  updateFriendsPanel();
}

function updateTasksPanel() {
  const list = document.getElementById('tasksList');
  const feed = document.getElementById('homeworkFeed');

  feed.innerHTML = appState.homework.length
    ? appState.homework.map(item => `<div class="feed-item">${escapeHTML(item.text || '')}</div>`).join('')
    : '<p class="empty">No shared homework feed is connected yet.</p>';

  if (!appState.tasks.length) {
    list.innerHTML = '<p class="empty">No tasks yet.</p>';
    return;
  }

  list.innerHTML = appState.tasks.map((task, i) => `
    <div class="task-item ${task.done ? 'done' : ''}">
      <input type="checkbox" ${task.done ? 'checked' : ''} data-toggle-task="${i}">
      <div class="task-text">
        <div>${escapeHTML(task.text)}</div>
        <div class="task-meta">${escapeHTML(task.type)} • ${escapeHTML(task.due)}</div>
      </div>
      <button class="btn-small danger" data-delete-task="${i}">Delete</button>
    </div>
  `).join('');

  list.querySelectorAll('[data-toggle-task]').forEach(el => {
    el.addEventListener('change', () => toggleTask(Number(el.dataset.toggleTask)));
  });
  list.querySelectorAll('[data-delete-task]').forEach(el => {
    el.addEventListener('click', () => deleteTask(Number(el.dataset.deleteTask)));
  });
}

function addTask() {
  const text = document.getElementById('newTaskText').value.trim();
  const type = document.getElementById('newTaskType').value;
  const due = document.getElementById('newTaskDue').value;

  if (!text) {
    alert('Enter a task.');
    return;
  }

  appState.tasks.push({ text, type, due: due || 'No date', done: false });
  saveTasks(appState.tasks);
  document.getElementById('newTaskText').value = '';
  document.getElementById('newTaskDue').value = '';
  updateTasksPanel();
}

function deleteTask(index) {
  appState.tasks.splice(index, 1);
  saveTasks(appState.tasks);
  updateTasksPanel();
}

function toggleTask(index) {
  appState.tasks[index].done = !appState.tasks[index].done;
  saveTasks(appState.tasks);
  updateTasksPanel();
}

function updateCalibratePanel() {
  const list = document.getElementById('calibratedList');
  const rooms = Object.entries(CLASSROOM_LOCATIONS);

  if (!rooms.length) {
    list.innerHTML = '<p class="empty">No rooms calibrated yet.</p>';
    return;
  }

  list.innerHTML = rooms
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([room, loc]) => `
      <div class="calibrated-item">
        <div class="calibrated-room">${escapeHTML(room)}</div>
        <div class="calibrated-class">${escapeHTML(loc.className || 'Unknown')} • ${escapeHTML(loc.teacher || 'Unknown')}</div>
        <div class="calibrated-coords">${loc.lat.toFixed(6)}, ${loc.lng.toFixed(6)}</div>
        <div class="calibrated-meta">GPS accuracy when saved: ±${Math.round(loc.accuracy || 0)}m</div>
        <button class="btn-small danger" data-delete-room="${escapeHTML(room)}">Delete</button>
      </div>
    `).join('');

  list.querySelectorAll('[data-delete-room]').forEach(btn => {
    btn.addEventListener('click', () => {
      const room = btn.dataset.deleteRoom;
      if (!confirm(`Delete calibration for ${room}?`)) return;
      deleteCalibratedLocation(room);
      updateUI();
      renderMap();
    });
  });
}

function addCustomClass() {
  const name = document.getElementById('newClassName').value.trim();
  const room = document.getElementById('newClassRoom').value.trim().toUpperCase();
  const teacher = document.getElementById('newClassTeacher').value.trim();
  const time = document.getElementById('newClassTime').value;

  if (!name || !room || !teacher || !time) {
    alert('Fill in all class fields.');
    return;
  }

  appState.schedule.push({ name, room, teacher, startTime: time });
  saveSchedule(appState.schedule);

  ['newClassName', 'newClassRoom', 'newClassTeacher', 'newClassTime']
    .forEach(id => document.getElementById(id).value = '');

  updateSchedulePanel();
}

function showPanel(panelName) {
  document.querySelectorAll('.panel').forEach(panel => {
    panel.style.display = panel.id === panelName ? 'flex' : 'none';
  });

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.panel === panelName);
  });

  appState.currentPanel = panelName;
  renderMap();
}

function takeCameraPhoto() {
  if (!navigator.mediaDevices?.getUserMedia) {
    alert('Camera access is not supported by this browser.');
    return;
  }

  const modal = document.getElementById('cameraModal');
  const video = document.getElementById('cameraFeed');

  modal.classList.add('show');
  modal.setAttribute('aria-hidden', 'false');

  navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' } },
    audio: false
  }).then(stream => {
    appState.cameraStream = stream;
    video.srcObject = stream;
  }).catch(error => {
    alert(`Camera access denied: ${error.message}`);
    closeCameraModal();
  });
}

function capturePhoto() {
  const video = document.getElementById('cameraFeed');
  const photoCanvas = document.getElementById('photoCanvas');

  if (!video.videoWidth || !video.videoHeight) {
    alert('Camera is not ready yet.');
    return;
  }

  photoCanvas.width = video.videoWidth;
  photoCanvas.height = video.videoHeight;
  photoCanvas.getContext('2d').drawImage(video, 0, 0);

  // This is intentionally local-only for now. No photo is uploaded anywhere.
  const imageData = photoCanvas.toDataURL('image/jpeg', 0.85);
  console.log('Captured local camera image:', imageData.slice(0, 40) + '…');
  alert('Photo captured locally. Camera/location recognition is not connected yet.');
  closeCameraModal();
}

function closeCameraModal() {
  if (appState.cameraStream) {
    appState.cameraStream.getTracks().forEach(track => track.stop());
    appState.cameraStream = null;
  }
  const video = document.getElementById('cameraFeed');
  video.srcObject = null;

  const modal = document.getElementById('cameraModal');
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden', 'true');
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
}
