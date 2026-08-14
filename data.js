// Del Norte High School - Campus coordinates (latitude, longitude)
// Address: 16601 Nighthawk Lane, San Diego, CA 92127
const SCHOOL_CENTER = {
  lat: 32.9156,
  lng: -117.1742,
  zoom: 18
};

// Exact classes from user specification
const CLASSES = [
  {
    name: '3D Computer Animation 1',
    room: 'A148',
    teacher: 'Jason Askegreen',
    startTime: '08:30'
  },
  {
    name: 'Biology of Living Earth 1',
    room: 'E102',
    teacher: 'James Gusich',
    startTime: '09:45'
  },
  {
    name: 'Trigonometry',
    room: 'R402',
    teacher: 'Reanna Hightower',
    startTime: '11:00'
  },
  {
    name: 'ENS',
    room: 'D104',
    teacher: 'Brianna Kabaci',
    startTime: '12:30'
  },
  {
    name: 'HS English',
    room: 'J116',
    teacher: 'Robert Weeg',
    startTime: '14:00'
  },
  {
    name: 'HS English',
    room: 'D102',
    teacher: 'Jacob Mcneely',
    startTime: '15:15'
  }
];

// Classroom locations - TO BE CALIBRATED BY USER
// This will be filled in as user walks around and marks locations
let CLASSROOM_LOCATIONS = {};

// Load calibrated locations from localStorage
function loadCalibratedLocations() {
  const saved = localStorage.getItem('classroomLocations');
  if (saved) {
    CLASSROOM_LOCATIONS = JSON.parse(saved);
  }
}

// Save calibrated locations to localStorage
function saveCalibratedLocations() {
  localStorage.setItem('classroomLocations', JSON.stringify(CLASSROOM_LOCATIONS));
}

// Get distance between two GPS coordinates (in meters)
function getDistance(lat1, lng1, lat2, lng2) {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = lat1 * Math.PI / 180;
  const phi2 = lat2 * Math.PI / 180;
  const deltaLat = (lat2 - lat1) * Math.PI / 180;
  const deltaLng = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(deltaLat/2) * Math.sin(deltaLat/2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLng/2) * Math.sin(deltaLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  return Math.round(distance);
}

// Get bearing between two coordinates
function getBearing(lat1, lng1, lat2, lng2) {
  const deltaLng = lng2 - lng1;
  const y = Math.sin(deltaLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(deltaLng);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360; // Normalize to 0-360
}

// Local storage helpers
function getSchedule() {
  const saved = localStorage.getItem('userSchedule');
  return saved ? JSON.parse(saved) : [...CLASSES];
}

function saveSchedule(schedule) {
  localStorage.setItem('userSchedule', JSON.stringify(schedule));
}

function getMeetingSpots() {
  const saved = localStorage.getItem('meetingSpots');
  return saved ? JSON.parse(saved) : [];
}

function saveMeetingSpots(spots) {
  localStorage.setItem('meetingSpots', JSON.stringify(spots));
}

function getTasks() {
  const saved = localStorage.getItem('tasks');
  return saved ? JSON.parse(saved) : [];
}

function saveTasks(tasks) {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function getHomework() {
  const saved = localStorage.getItem('homework');
  return saved ? JSON.parse(saved) : [];
}

function saveHomework(homework) {
  localStorage.setItem('homework', JSON.stringify(homework));
}

// Initialize on load
loadCalibratedLocations();
