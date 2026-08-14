// Del Norte High School - calibration + local data layer.
// IMPORTANT: classroom coordinates are intentionally empty until you register them.

const SCHOOL_CENTER = {
  lat: 32.9156,
  lng: -117.1742,
  zoom: 18
};

const CLASSES = [
  { name: '3D Computer Animation 1', room: 'A148', teacher: 'Jason Askegreen', startTime: '08:30' },
  { name: 'Biology of Living Earth 1', room: 'E102', teacher: 'James Gusich', startTime: '09:45' },
  { name: 'Trigonometry', room: 'R402', teacher: 'Reanna Hightower', startTime: '11:00' },
  { name: 'ENS', room: 'D104', teacher: 'Brianna Kabaci', startTime: '12:30' },
  { name: 'HS English', room: 'J116', teacher: 'Robert Weeg', startTime: '14:00' },
  { name: 'HS English', room: 'D102', teacher: 'Jacob Mcneely', startTime: '15:15' }
];

let CLASSROOM_LOCATIONS = {};

function loadCalibratedLocations() {
  try {
    const saved = localStorage.getItem('classroomLocations');
    CLASSROOM_LOCATIONS = saved ? JSON.parse(saved) : {};
  } catch {
    CLASSROOM_LOCATIONS = {};
  }
}

function saveCalibratedLocations() {
  localStorage.setItem('classroomLocations', JSON.stringify(CLASSROOM_LOCATIONS));
}

function deleteCalibratedLocation(room) {
  delete CLASSROOM_LOCATIONS[room];
  saveCalibratedLocations();
}

function clearCalibratedLocations() {
  CLASSROOM_LOCATIONS = {};
  saveCalibratedLocations();
}

function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const dPhi = (lat2 - lat1) * Math.PI / 180;
  const dLambda = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;

  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function getBearing(lat1, lng1, lat2, lng2) {
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const lambda1 = lng1 * Math.PI / 180;
  const lambda2 = lng2 * Math.PI / 180;
  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) -
            Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function getSchedule() {
  try {
    const saved = localStorage.getItem('userSchedule');
    return saved ? JSON.parse(saved) : CLASSES.map(c => ({ ...c }));
  } catch {
    return CLASSES.map(c => ({ ...c }));
  }
}

function saveSchedule(schedule) {
  localStorage.setItem('userSchedule', JSON.stringify(schedule));
}

function getMeetingSpots() {
  try {
    return JSON.parse(localStorage.getItem('meetingSpots') || '[]');
  } catch {
    return [];
  }
}

function saveMeetingSpots(spots) {
  localStorage.setItem('meetingSpots', JSON.stringify(spots));
}

function getTasks() {
  try {
    return JSON.parse(localStorage.getItem('tasks') || '[]');
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function getHomework() {
  try {
    return JSON.parse(localStorage.getItem('homework') || '[]');
  } catch {
    return [];
  }
}

function saveHomework(homework) {
  localStorage.setItem('homework', JSON.stringify(homework));
}

loadCalibratedLocations();
