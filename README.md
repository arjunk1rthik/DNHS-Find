# Del Norte Campus Navigator

A real-time campus navigation app with GPS positioning, classroom calibration, schedule management, and friend location sharing for Del Norte High School.

## Features

- **Real GPS positioning**: Uses device geolocation for accurate location tracking
- **Compass heading**: Device orientation for directional guidance
- **Classroom calibration**: Walk to each classroom and mark its GPS coordinates
- **Schedule management**: Pre-loaded with your classes, add custom classes
- **Navigation**: Turn-by-turn directions to classrooms with distance and bearing
- **Meeting spots**: Create and customize meeting locations by time/day
- **Tasks & homework**: Track assignments and tasks
- **Permission handling**: Proper permission requests for location and notifications
- **Photo capture**: Camera integration (ready for location detection)
- **Friend tracking**: Infrastructure for seeing friends' locations (requires backend)

## Setup

### 1. Download the files

You need these files in the same directory:
- `index.html` - Main app interface
- `app.js` - Core app logic
- `data.js` - Data management and class information
- `styles.css` - Styling

### 2. Run locally

Option A: Python (simpler)
```bash
cd /path/to/app
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

Option B: Node.js
```bash
npx http-server
```

### 3. Open on your phone

You MUST use HTTPS or localhost for the app to access GPS and camera.

**Local network:**
- Find your computer's IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
- On phone, open: `http://YOUR_IP:8000`

**Better: Use ngrok for HTTPS**
```bash
ngrok http 8000
```
Open the ngrok URL on your phone (it will be HTTPS).

### 4. Grant permissions

When you open the app:
1. Tap "Grant permissions"
2. Allow location access (required)
3. Allow camera access (for photo feature)
4. Allow notifications (optional)

## Classroom Calibration (Important)

The app starts with NO classroom locations. You need to walk around campus and calibrate each room:

1. Go to the **Calibrate** tab
2. Stand outside the classroom
3. Tap "Mark current location" - waits for GPS lock
4. Enter room number (e.g., `E102`), class name, teacher
5. Tap "Save location"
6. Repeat for each room

**Tips:**
- GPS needs clear sky view (outdoors is best)
- Wait 10-15 seconds after tapping for GPS to lock
- Mark rooms when you're directly in front of them
- Accuracy will improve with 5-10 calibrated rooms

## Your Classes (Pre-loaded)

These are already in the app:
- **3D Computer Animation 1** - Room A148 - Jason Askegreen
- **Biology of Living Earth 1** - Room E102 - James Gusich
- **Trigonometry** - Room R402 - Reanna Hightower
- **ENS** - Room D104 - Brianna Kabaci
- **HS English** - Room J116 - Robert Weeg
- **HS English** - Room D102 - Jacob Mcneely

## How to Use

### Navigation
1. Go to **Schedule** tab
2. Tap "Navigate" on any class
3. App shows distance and bearing to the room
4. Blue dot on map is your location
5. Blue arrow shows which way you're facing

### Meeting Spots
1. Go to **Friends** tab
2. Create a spot with name, time, and type (lunch/break/office)
3. Share the spot with friends (requires backend integration)

### Tasks
1. Go to **Tasks** tab
2. Add homework, study tasks, or office prep
3. Check them off when done
4. Tasks sync to your device only (local storage)

### Camera
1. Tap the camera button on the map
2. Take a photo of a building
3. App analyzes the photo for location detection (backend required)

## Data Storage

All data is stored locally on your device:
- Schedule (classes you add)
- Calibrated classroom locations
- Meeting spots
- Tasks
- Homework

Use browser dev tools to clear data if needed:
- Open DevTools (F12)
- Application → Local Storage → Delete

## Troubleshooting

**GPS not working:**
- Make sure you're outdoors
- Location permission is granted
- Wait 15-20 seconds for GPS lock
- Look at your GPS accuracy in Calibrate tab

**Classroom not found:**
- You need to calibrate that room first
- Tap Navigate → it will tell you if room isn't calibrated

**Camera not working:**
- Make sure you allowed camera permission
- App must be HTTPS or localhost
- Some browsers require user gesture before camera access

**Friends not showing:**
- Friend location feature requires backend integration
- Currently offline/local only

## Multi-user (Friends & Sync)

To enable real friend location sharing and homework sync:

1. Set up Firebase Realtime Database
2. Update `data.js` with Firebase config
3. Implement sync functions in `app.js`

This is a ~2 hour integration. Let me know if you want to add it.

## File Structure

```
/
├── index.html      (main UI)
├── app.js          (logic & interactions)
├── data.js         (classes, utilities, storage)
├── styles.css      (all styling)
└── README.md       (this file)
```

## Technical Details

**GPS Accuracy:**
- Outdoor accuracy: ±5-15 meters
- Requires high-accuracy mode
- Uses device compass for heading

**Map Rendering:**
- Canvas-based (no external map library)
- User position at center
- Classrooms drawn relative to user location
- Updates in real-time

**Storage:**
- Browser LocalStorage (5-10MB per domain)
- All data persists after app closes
- No cloud sync (yet)

## Next Steps

1. **Test on your phone** - Walk around calibrating rooms
2. **Let me know what's missing** - Any features you want?
3. **Add backend** - For real friend tracking and homework sync
4. **Deploy** - Host on Firebase/Vercel/Netlify for public access

## Questions?

- GPS not locking? Try outdoors with clear sky view
- Room doesn't show? Calibrate it first
- Photos not working? Make sure camera permission is granted
