// Global state
let appState = {
  userLocation: null,
  userHeading: 0,
  geolocationWatch: null,
  deviceOrientationWatch: null,
  permissionsGranted: {
    location: false,
    notification: false
  },
  currentPanel: 'schedulePanel',
  schedule: getSchedule(),
  meetingSpots: getMeetingSpots(),
  tasks: getTasks(),
  homework: getHomework(),
  pendingCalibration: null,
  friends: [] // Will be populated from backend/sync
};

// DOM elements
let canvas, ctx, gpsStatusEl, permissionsBannerEl;

// Initialize app on load
window.addEventListener('DOMContentLoaded', () => {
  canvas = document.getElementById('mapCanvas');
  ctx = canvas.getContext('2d');
  gpsStatusEl = document.getElementById('gps-status');
  permissionsBannerEl = document.getElementById('permissionsBanner');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Check existing permissions
  checkPermissions();

  // Request permissions on startup
  if (!appState.permissionsGranted.location) {
    showPermissionsBanner();
  } else {
    initializeLocationTracking();
  }

  // Initial render
  updateUI();
  renderMap();
});

// Resize canvas to fit container
function resizeCanvas() {
  const container = document.querySelector('.map-container');
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  renderMap();
}

// Check permissions using Permissions API
async function checkPermissions() {
  try {
    // Check geolocation
    const geoStatus = await navigator.permissions.query({ name: 'geolocation' });
    appState.permissionsGranted.location = geoStatus.state === 'granted';

    // Check notifications
    const notifStatus = await navigator.permissions.query({ name: 'notifications' });
    appState.permissionsGranted.notification = notifStatus.state === 'granted';

    updatePermissionStatus();
  } catch (e) {
    console.log('Permissions API not supported, will request inline');
  }
}

// Show permissions banner
function showPermissionsBanner() {
  if (permissionsBannerEl) {
    permissionsBannerEl.style.display = 'block';
  }
}

function hidPermissionsBanner() {
  if (permissionsBannerEl) {
    permissionsBannerEl.style.display = 'none';
  }
}

// Request all permissions
async function requestPermissions() {
  // Request geolocation
  if (!appState.permissionsGranted.location) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Location permission granted');
        appState.permissionsGranted.location = true;
        updatePermissionStatus();
        initializeLocationTracking();
        hidPermissionsBanner();
      },
      (error) => {
        console.error('Location permission denied:', error);
        alert('Location permission is required for navigation to work.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        appState.permissionsGranted.notification = true;
        console.log('Notification permission granted');
      }
    });
  }

  updatePermissionStatus();
}

// Update permission status display
function updatePermissionStatus() {
  const statusText = appState.permissionsGranted.location ? 'GPS: Ready' : 'GPS: Need permission';
  gpsStatusEl.textContent = statusText;
  gpsStatusEl.className = appState.permissionsGranted.location ? 'status-badge ready' : 'status-badge warning';
}

// Initialize real GPS tracking
function initializeLocationTracking() {
  if (!appState.permissionsGranted.location) {
    console.warn('Location permission not granted');
    return;
  }

  // Get high-accuracy position
  appState.geolocationWatch = navigator.geolocation.watchPosition(
    (position) => {
      appState.userLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      updateGPSDisplay();
      renderMap();
    },
    (error) => {
      console.error('Geolocation error:', error);
      gpsStatusEl.textContent = 'GPS: Error - ' + error.message;
      gpsStatusEl.className = 'status-badge error';
    },
    {
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 0
    }
  );

  // Device orientation for compass heading
  if (window.DeviceOrientationEvent) {
    window.addEventListener('deviceorientation', (event) => {
      // webkitCompassHeading for iOS, alpha for others
      appState.userHeading = event.webkitCompassHeading !== undefined 
        ? event.webkitCompassHeading 
        : event.alpha;
      renderMap();
    });
  }
}

// Update GPS display
function updateGPSDisplay() {
  if (appState.userLocation) {
    const coords = `${appState.userLocation.lat.toFixed(6)}, ${appState.userLocation.lng.toFixed(6)}`;
    const accuracy = appState.userLocation.accuracy ? `±${Math.round(appState.userLocation.accuracy)}m` : 'Unknown';
    document.getElementById('currentCoords').textContent = `${coords} (${accuracy})`;
  }
}

// Mark current location for calibration
function markCurrentLocation() {
  if (!appState.userLocation) {
    alert('Waiting for GPS location...');
    return;
  }

  appState.pendingCalibration = {
    lat: appState.userLocation.lat,
    lng: appState.userLocation.lng,
    timestamp: new Date()
  };

  alert(`Location marked: ${appState.userLocation.lat.toFixed(6)}, ${appState.userLocation.lng.toFixed(6)}\n\nNow enter the room details below.`);
  document.getElementById('calibrateRoom').focus();
}

// Save calibration
function saveCalibration() {
  if (!appState.pendingCalibration) {
    alert('Mark a location first');
    return;
  }

  const room = document.getElementById('calibrateRoom').value.toUpperCase();
  const className = document.getElementById('calibrateClass').value;
  const teacher = document.getElementById('calibrateTeacher').value;

  if (!room) {
    alert('Room number is required');
    return;
  }

  CLASSROOM_LOCATIONS[room] = {
    lat: appState.pendingCalibration.lat,
    lng: appState.pendingCalibration.lng,
    className: className || 'Unknown',
    teacher: teacher || 'Unknown',
    calibratedAt: appState.pendingCalibration.timestamp
  };

  saveCalibratedLocations();
  appState.pendingCalibration = null;

  // Clear inputs
  document.getElementById('calibrateRoom').value = '';
  document.getElementById('calibrateClass').value = '';
  document.getElementById('calibrateTeacher').value = '';

  updateUI();
  renderMap();
}

// Render map canvas
function renderMap() {
  if (!canvas || !ctx) return;

  // Clear canvas
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid for reference
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 0.5;
  for (let x = 0; x < canvas.width; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 50) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw user location if available
  if (appState.userLocation) {
    const userX = canvas.width / 2;
    const userY = canvas.height / 2;

    // User position circle
    ctx.fillStyle = '#378add';
    ctx.beginPath();
    ctx.arc(userX, userY, 8, 0, Math.PI * 2);
    ctx.fill();

    // Accuracy circle
    ctx.strokeStyle = 'rgba(55, 138, 221, 0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(userX, userY, 15, 0, Math.PI * 2);
    ctx.stroke();

    // Heading indicator
    const headingLength = 20;
    const headingRad = (appState.userHeading - 90) * Math.PI / 180;
    ctx.strokeStyle = '#378add';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(userX, userY);
    ctx.lineTo(
      userX + Math.cos(headingRad) * headingLength,
      userY + Math.sin(headingRad) * headingLength
    );
    ctx.stroke();
  }

  // Draw classroom markers
  const userX = canvas.width / 2;
  const userY = canvas.height / 2;

  Object.entries(CLASSROOM_LOCATIONS).forEach(([room, location]) => {
    // This will be calculated based on actual coordinates
    // For now, show them as fixed points for demo
    const offset = room.charCodeAt(0) % 20;
    const classX = userX + (Math.random() - 0.5) * 200;
    const classY = userY + (Math.random() - 0.5) * 200;

    // Draw classroom marker
    ctx.fillStyle = '#f0f0f0';
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(classX, classY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Room label
    ctx.fillStyle = '#333';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(room, classX, classY);

    // If user is near classroom, highlight it
    if (appState.userLocation && location.lat) {
      const dist = getDistance(appState.userLocation.lat, appState.userLocation.lng, location.lat, location.lng);
      if (dist < 50) {
        ctx.strokeStyle = '#28a745';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(classX, classY, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  });

  // Draw text overlay
  ctx.fillStyle = '#666';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(`Heading: ${Math.round(appState.userHeading)}°`, 10, 10);
  ctx.fillText(`Accuracy: ${appState.userLocation ? Math.round(appState.userLocation.accuracy) + 'm' : 'N/A'}`, 10, 25);
}

// Camera photo capture
function takeCameraPhoto() {
  const modal = document.getElementById('cameraModal');
  modal.style.display = 'flex';

  const video = document.getElementById('cameraFeed');
  
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
    audio: false
  })
  .then(stream => {
    video.srcObject = stream;
  })
  .catch(err => {
    alert('Camera access denied: ' + err.message);
    closeCameraModal();
  });
}

function capturePhoto() {
  const video = document.getElementById('cameraFeed');
  const canvas = document.getElementById('photoCanvas');
  const ctx = canvas.getContext('2d');

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);

  // Get image data
  const imageData = canvas.toDataURL('image/jpeg');

  // Here you would send to a backend for processing
  // For now, just log it
  console.log('Photo captured. Send to backend for location detection.');
  alert('Photo captured. Analyzing location...');

  closeCameraModal();
}

function closeCameraModal() {
  const modal = document.getElementById('cameraModal');
  const video = document.getElementById('cameraFeed');
  
  if (video.srcObject) {
    video.srcObject.getTracks().forEach(track => track.stop());
  }

  modal.style.display = 'none';
}

// UI update functions
function updateUI() {
  updateSchedulePanel();
  updateFriendsPanel();
  updateTasksPanel();
  updateCalibratePanel();
}

function updateSchedulePanel() {
  const scheduleList = document.getElementById('scheduleList');
  scheduleList.innerHTML = appState.schedule.map((cls, i) => `
    <div class="schedule-item">
      <div class="schedule-time">${cls.startTime}</div>
      <div class="schedule-class">
        <div class="schedule-name">${cls.name}</div>
        <div class="schedule-room">Room ${cls.room} • ${cls.teacher}</div>
      </div>
      <button class="btn-small" onclick="navigateTo('${cls.room}')">Navigate</button>
    </div>
  `).join('');

  // Update next class stats
  if (appState.schedule.length > 0) {
    document.getElementById('nextClassTime').textContent = appState.schedule[0].startTime;
    
    if (appState.userLocation && CLASSROOM_LOCATIONS[appState.schedule[0].room]) {
      const classroom = CLASSROOM_LOCATIONS[appState.schedule[0].room];
      const dist = getDistance(
        appState.userLocation.lat,
        appState.userLocation.lng,
        classroom.lat,
        classroom.lng
      );
      document.getElementById('nextClassDistance').textContent = dist + 'm';
    }
  }
}

function updateFriendsPanel() {
  const friendsList = document.getElementById('friendsList');
  if (appState.friends.length === 0) {
    friendsList.innerHTML = '<p style="color: var(--text-secondary);">No friends online</p>';
  } else {
    friendsList.innerHTML = appState.friends.map(friend => `
      <div class="friend-item">
        <div class="friend-name">${friend.name}</div>
        <div class="friend-distance">${friend.distance}m away</div>
        <button class="btn-small" onclick="meetFriend('${friend.id}')">Meet</button>
      </div>
    `).join('');
  }

  const spotsList = document.getElementById('meetingSpotsList');
  if (appState.meetingSpots.length === 0) {
    spotsList.innerHTML = '<p style="color: var(--text-secondary);">No meeting spots created</p>';
  } else {
    spotsList.innerHTML = appState.meetingSpots.map((spot, i) => `
      <div class="meeting-spot-item">
        <div class="spot-name">${spot.name}</div>
        <div class="spot-type">${spot.type} • ${spot.time}</div>
        <button class="btn-small" onclick="deleteMeetingSpot(${i})">Delete</button>
      </div>
    `).join('');
  }
}

function updateTasksPanel() {
  const tasksList = document.getElementById('tasksList');
  if (appState.tasks.length === 0) {
    tasksList.innerHTML = '<p style="color: var(--text-secondary);">No tasks yet</p>';
  } else {
    tasksList.innerHTML = appState.tasks.map((task, i) => `
      <div class="task-item">
        <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleTask(${i})">
        <div class="task-text">
          <div>${task.text}</div>
          <div class="task-meta">${task.type} • ${task.due}</div>
        </div>
        <button class="btn-small" onclick="deleteTask(${i})">Delete</button>
      </div>
    `).join('');
  }
}

function updateCalibratePanel() {
  const calibratedList = document.getElementById('calibratedList');
  const roomCount = Object.keys(CLASSROOM_LOCATIONS).length;
  
  if (roomCount === 0) {
    calibratedList.innerHTML = '<p style="color: var(--text-secondary);">No rooms calibrated yet</p>';
  } else {
    calibratedList.innerHTML = Object.entries(CLASSROOM_LOCATIONS).map(([room, loc]) => `
      <div class="calibrated-item">
        <div class="calibrated-room">${room}</div>
        <div class="calibrated-class">${loc.className} • ${loc.teacher}</div>
        <div class="calibrated-coords">${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}</div>
      </div>
    `).join('');
  }
}

// Panel switching
function switchPanel(panelName) {
  document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
  document.getElementById(panelName).style.display = 'block';
  
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-panel="${panelName}"]`).classList.add('active');
  
  appState.currentPanel = panelName;
  renderMap();
}

// Schedule management
function addCustomClass() {
  const name = document.getElementById('newClassName').value;
  const room = document.getElementById('newClassRoom').value.toUpperCase();
  const teacher = document.getElementById('newClassTeacher').value;
  const time = document.getElementById('newClassTime').value;

  if (!name || !room || !teacher || !time) {
    alert('Please fill in all fields');
    return;
  }

  appState.schedule.push({ name, room, teacher, startTime: time });
  saveSchedule(appState.schedule);

  document.getElementById('newClassName').value = '';
  document.getElementById('newClassRoom').value = '';
  document.getElementById('newClassTeacher').value = '';
  document.getElementById('newClassTime').value = '';

  updateSchedulePanel();
}

// Meeting spots
function addMeetingSpot() {
  const name = document.getElementById('spotName').value;
  const type = document.getElementById('spotType').value;
  const time = document.getElementById('spotTime').value;

  if (!name || !time) {
    alert('Please enter spot name and time');
    return;
  }

  appState.meetingSpots.push({ name, type, time });
  saveMeetingSpots(appState.meetingSpots);

  document.getElementById('spotName').value = '';
  document.getElementById('spotTime').value = '';

  updateFriendsPanel();
}

function deleteMeetingSpot(i) {
  appState.meetingSpots.splice(i, 1);
  saveMeetingSpots(appState.meetingSpots);
  updateFriendsPanel();
}

function meetFriend(friendId) {
  alert('Meeting friend feature coming soon');
}

// Tasks
function addTask() {
  const text = document.getElementById('newTaskText').value;
  const type = document.getElementById('newTaskType').value;
  const due = document.getElementById('newTaskDue').value;

  if (!text) {
    alert('Please enter a task');
    return;
  }

  appState.tasks.push({ text, type, due: due || 'No date', done: false });
  saveTasks(appState.tasks);

  document.getElementById('newTaskText').value = '';
  document.getElementById('newTaskDue').value = '';

  updateTasksPanel();
}

function deleteTask(i) {
  appState.tasks.splice(i, 1);
  saveTasks(appState.tasks);
  updateTasksPanel();
}

function toggleTask(i) {
  appState.tasks[i].done = !appState.tasks[i].done;
  saveTasks(appState.tasks);
  updateTasksPanel();
}

// Navigation
function navigateTo(room) {
  if (!appState.userLocation) {
    alert('Waiting for GPS location...');
    return;
  }

  if (!CLASSROOM_LOCATIONS[room]) {
    alert(`Room ${room} not yet calibrated. Please calibrate it first.`);
    return;
  }

  const classroom = CLASSROOM_LOCATIONS[room];
  const distance = getDistance(
    appState.userLocation.lat,
    appState.userLocation.lng,
    classroom.lat,
    classroom.lng
  );

  const bearing = getBearing(
    appState.userLocation.lat,
    appState.userLocation.lng,
    classroom.lat,
    classroom.lng
  );

  const relativeHeading = ((bearing - appState.userHeading) + 360) % 360;
  const direction = relativeHeading < 90 || relativeHeading > 270 ? 'forward' : 'behind';

  alert(`Room ${room} is ${distance}m ${direction} of you.\nHead ${Math.round(bearing)}°`);
}

function centerMap() {
  if (!appState.userLocation) {
    alert('Waiting for GPS...');
    return;
  }
  renderMap();
}
