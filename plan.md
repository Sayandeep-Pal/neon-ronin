Since you're likely building this as a portfolio + hackathon-quality project, I'd scope the **first version (MVP)** so that it is playable, impressive, and finishable in 4-6 weeks.

# Product Requirements Document (PRD)

## Neon Ronin

### Tagline

**Turn your smartphone into a cyber katana and defend Neo-Tokyo from rogue AI warriors.**

---

# 1. Overview

Neon Ronin is a browser-based action game where players use their smartphone as a motion-controlled katana.

The game runs on a desktop browser while the smartphone acts as a controller through gyroscope and accelerometer sensors.

Players scan a QR code, connect instantly, and physically swing their phone to slash incoming cyber enemies.

No installation required.

---

# 2. Goals

### Primary Goal

Create a highly immersive browser game that transforms a smartphone into a sword.

### Secondary Goals

* Showcase motion controls in web browsers
* Enable instant play via QR code
* Create a visually impressive portfolio project
* Support hackathon/demo presentations

---

# 3. Target Users

### Primary

* Gamers
* Tech enthusiasts
* Hackathon judges
* Friends testing projects

### Secondary

* Streamers
* Event attendees
* Students

---

# 4. User Journey

## Desktop User

1. Opens Neon Ronin website
2. Clicks "Start Game"
3. QR code appears
4. Waits for phone connection
5. Begins battle

## Mobile User

1. Scans QR code
2. Opens controller page
3. Grants motion permissions
4. Holds phone like a sword
5. Swings to attack

---

# 5. Core Gameplay

## Arena

Single arena with cyberpunk aesthetics.

Player stands in the center.

Enemies approach from:

* Left
* Right
* Front

---

## Objective

Survive as long as possible.

Earn score by defeating enemies.

---

## Health

Player starts with:

```text
100 HP
```

Enemy hits reduce health.

Game ends at:

```text
0 HP
```

---

# 6. Katana Mechanics

The phone acts as a sword.

## Supported Actions

### Horizontal Slash

```text
← →
```

Used against:

* Drones
* Standard enemies

---

### Vertical Slash

```text
↑ ↓
```

Used against:

* Shield enemies

---

### Diagonal Slash

```text
↘ ↖
```

Used against:

* Elite enemies

---

### Thrust

```text
Forward jab
```

Used against:

* Charging enemies

---

### Block

Phone held upright.

Used against:

* Incoming attacks

---

# 7. Enemy Types

## Drone

HP: 1

Weakness:

* Horizontal slash

Reward:

* 10 points

---

## Shield Bot

HP: 2

Weakness:

* Vertical slash

Reward:

* 25 points

---

## Cyber Ninja

HP: 3

Weakness:

* Diagonal slash

Reward:

* 50 points

---

## Kamikaze Drone

Rushes player.

Must be:

* Thrust attacked

Reward:

* 40 points

---

## AI Samurai

Mini boss.

Uses attack patterns.

Requires:

* Block
* Counter slash

Reward:

* 250 points

---

# 8. Wave System

### Wave 1

Only drones.

### Wave 2

Drones + Shield Bots.

### Wave 3

Cyber Ninjas.

### Wave 5

Mini Boss.

### Endless Mode

Difficulty scales forever.

---

# 9. Combo System

Consecutive hits create combos.

```text
3 Hits = x1.5
5 Hits = x2
10 Hits = x3
```

Combo resets on:

* Miss
* Taking damage

---

# 10. Perfect Slash System

A slash is evaluated based on:

### Direction Accuracy

Correct slash angle.

### Timing

Enemy hit zone.

### Swing Speed

Phone acceleration.

Rewards:

```text
GOOD
GREAT
PERFECT
```

Perfect grants bonus score.

---

# 11. Controller Features

## Motion Tracking

Use:

```javascript
DeviceOrientationEvent
DeviceMotionEvent
```

Data:

* alpha
* beta
* gamma
* acceleration

---

## Vibration Feedback

Hit:

```text
50ms vibration
```

Perfect:

```text
150ms vibration
```

Damage:

```text
200ms vibration
```

---

## Battery Optimization

Send sensor data:

```text
20–30 times/sec
```

instead of 60.

---

# 12. Multiplayer (Future)

## Duel Mode

Two players.

Each uses a phone katana.

Players fight each other.

---

## Co-op Survival

2-4 players.

Defend arena together.

---

# 13. Art Direction

### Style

Cyberpunk + Japanese

### Colors

* Neon Blue
* Neon Pink
* Purple
* Black

### Visual Effects

* Slash trails
* Particle explosions
* Glitch effects
* Holographic UI

---

# 14. Sound Design

### Music

Synthwave

### Effects

* Sword swing
* Blade impact
* Drone explosions
* Warning alarms

---

# 15. Technical Architecture

## Frontend

### Game Client

* React
* Phaser.js
* TypeScript

### Controller

* React
* Motion APIs

---

## Communication

### MVP

WebSocket

```text
Phone
↔
Node.js Server
↔
Desktop
```

---

### V2

WebRTC

Lower latency.

---

## Backend

Node.js

Responsibilities:

* Room creation
* Pairing devices
* Session management

---

# 16. Room System

Desktop creates:

```text
ABCD12
```

Phone joins:

```text
ABCD12
```

Connection established.

Alternative:

QR contains room ID.

---

# 17. Analytics

Track:

* Session length
* Highest score
* Average combo
* Enemy kills

Optional for MVP.

---

# 18. MVP Scope

Must Have:

✅ QR pairing
✅ Motion controller
✅ Horizontal slash detection
✅ 3 enemy types
✅ Wave system
✅ Score system
✅ Vibration feedback
✅ Desktop browser gameplay

Avoid Initially:

❌ Accounts
❌ Multiplayer
❌ Leaderboards
❌ Inventory
❌ Character progression
❌ AI-generated content

---

# 19. Stretch Goals

### Bullet Deflection

Slash projectiles back.

### Ultimate Mode

Charge energy.

Perform:

```text
360° Spin Attack
```

to clear screen.

### Boss Fights

* Oni AI
* Shogun AI
* Dragon Mech

### Story Mode

Neo-Tokyo is controlled by an AI emperor.

The player is the last Ronin capable of fighting using ancient sword techniques enhanced with cybernetic implants.

---

# 20. Implementation Log

## Tech Stack (Confirmed)
- **Game client**: React + Vite + HTML5 Canvas (Isometric 2.5D) + Web Audio API
- **Controller client**: React + Vite + DeviceMotion/DeviceOrientation APIs
- **Backend broker**: Node.js + Express + Socket.io
- **Styling**: Vanilla CSS (Cyberpunk palette: neon blue #00f0ff, pink #ff007f, purple #b026ff)
- **Visual style**: Pseudo-3D isometric arena

## Folder Structure
```
neon ronin/
├── game/          # Desktop game client (Vite + React)
├── controller/    # Mobile controller client (Vite + React)
├── backend/       # Express + Socket.io signal broker
├── plan.md
├── package.json   # Root orchestrator (concurrently dev runner)
└── README.md
```

## Controller Stability Improvements (v2)

### Problem
Raw sensor events from `DeviceMotionEvent` produce extremely noisy acceleration and rotation data. Without filtering:
- Small involuntary hand tremors were being misclassified as slashes
- Calibration offset was stacking instead of snapping
- No visible cooldown caused phantom double-registrations
- Block stance could flicker rapidly and confuse the player

### Solution: On-Device Gesture Classification + Low-Pass Filter Pipeline

**Architecture change**: The controller now runs its own full gesture classifier on-device (not on the desktop). It emits authoritative `controller-gesture` events directly. The desktop only listens to `motion-data` for the 3D katana visual mirror.

**Signal processing pipeline**:
```
DeviceMotion event (60fps raw)
        ↓
  Low-Pass Filter (α=0.18)  ← Smooths jitter without killing swing peak
        ↓
  Sliding window check       ← Uses RAW peaks (not smoothed) to detect spikes
        ↓
  Gesture Cooldown Gate      ← 350ms lock-out window prevents double-fires
        ↓
  Classification:
    - |Z| dominant & Z < -8      → THRUST
    - |X| > |Y| × 1.5            → HORIZONTAL
    - |Y| > |X| × 1.5            → VERTICAL
    - both |X| and |Y| over 60%  → DIAGONAL
  Block Stance (no swing):
    - beta ∈ [55°, 115°]         → Phone upright
    - |gamma| < 28°              → Not rolling
    - total accel < 2.5 m/s²     → Holding still
        → Emit BLOCK
```

**Calibration fix**: Calibration now snapshots the current raw angles as the new origin by back-computing and updating `calibRef`. The smoothed buffer is reset to zero instantly, avoiding a rubber-band snap animation.

**UI improvements**:
- Gesture display banner with colour-coded label + enemy hint text
- 350ms cooldown bar animation shows when the controller is ready again
- "Techniques" cheat sheet always visible during gameplay
- Mini telemetry row shows Pitch, Roll, and total acceleration magnitude
- Calibration button turns to "✓ Re-Calibrate" after first successful calibration
- Connection state shows "Connecting…" spinner intermediate state

## Socket Event Protocol (v2)
| Event | Direction | Description |
|---|---|---|
| `host-room` | Desktop → Server | Create new room |
| `join-room` | Controller → Server | Join a room by ID |
| `controller-joined` | Server → Desktop | A controller has paired |
| `controller-data` | Controller → Server → Desktop | Smoothed sensor telemetry (30Hz) for katana visual |
| `controller-gesture` | Controller → Server → Desktop | **Authoritative classified gesture** |
| `game-event` | Desktop → Server → Controller | Trigger vibration / haptic feedback |
| `host-disconnected` | Server → Controller | Game host left |
| `controller-disconnected` | Server → Desktop | Controller left |

## Code Quality & Modular Refactoring (v3)

### Goal
The monolithic `App.tsx` files in both `game` and `controller` grew large and complex. To improve scalability, maintainability, and compilation speed, they were refactored into modular components, utilities, and managers.

### Controller Refactoring
We extracted the following modules and components from `/controller/src/App.tsx`:
- [types.ts](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/controller/src/types.ts): Holds type definitions for `Vec3`, `Rotation`, `SensorData`, `GestureType`, and `FeedbackFlash`.
- [constants.ts](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/controller/src/constants.ts): Centralizes sensor parameters, thresholds, and `GESTURE_META` mapping.
- [utils/math.ts](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/controller/src/utils/math.ts): Holds math utilities including low-pass filter calculations.
- [components/Lobby.tsx](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/controller/src/components/Lobby.tsx): UI component for roomId inputs and backend connection handling.
- [components/SwordVisualizer.tsx](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/controller/src/components/SwordVisualizer.tsx): Renders the 3D-effect CSS-styled Katana.
- [components/GameplayHUD.tsx](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/controller/src/components/GameplayHUD.tsx): Renders active gesture banners, telemetry stats, and combat technique guides.
- [App.tsx](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/controller/src/App.tsx): Act as a clean state orchestrator managing web services and gesture classified polling loop.

### Game Refactoring
We extracted the following modules and components from `/game/src/App.tsx`:
- [types.ts](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/game/src/types.ts): Defines types for `SensorData`, `Enemy`, and `Particle`.
- [audio/SoundManager.ts](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/game/src/audio/SoundManager.ts): Singleton class abstracting audio context creation, low frequency background drone LFO, and custom synthesizer sound effect triggers.
- [components/Lobby.tsx](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/game/src/components/Lobby.tsx): Portal configurations, server state status, and paired sword QR display.
- [components/GameOver.tsx](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/game/src/components/GameOver.tsx): The scoreboard and session controls.
- [components/GameHUD.tsx](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/game/src/components/GameHUD.tsx): High-frequency telemetry inspector overlay and health/combos panel.
- [App.tsx](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/game/src/App.tsx): Core hosting orchestrator and isometric canvas rendering frame update tick loop.

Both applications build cleanly under TypeScript verbatim module compliance.

## Sword Movement & Calibration Stability (v4)

### Problem
- **Yaw wrap-around jump**: The controller originally returned yaw (`alpha`) inside a `[0, 360)` modulo range. When the phone was held at the calibration point ($0^\circ$), shifting even slightly left wrapped the angle to $359^\circ$. This caused the game's matrix rotations to spin the 3D blade nearly $360^\circ$ and interpolate through all intermediate degrees, making it look like a spinning propeller.
- **Unfiltered yaw jitter**: Yaw wasn't low-pass filtered, leading to twitchy rotation rendering.
- **Calibrated block stance breakdown**: Block stance detection was checking if the calibrated `beta` (pitch) was vertical ($\approx 90^\circ$). But after calibration, the vertical holding position became $0^\circ$, breaking block detection.

### Solution
- **Yaw Normalization to $[-180, 180]$**: Raw orientation values are tracked directly, and relative difference matrices are computed inside the tick loop. Yaw is normalized to $[-180, 180]$ degrees relative to the calibration point, avoiding any wrap-around spikes at neutral coordinates.
- **Smooth Yaw LPF**: The calibrated yaw difference is now low-pass filtered ($\alpha = 0.22$) similarly to pitch and roll, creating fluid and jitter-free sword rotations in the game.
- **Absolute Stance Blocking**: Physical stance metrics (upright check) are evaluated using uncalibrated absolute orientation relative to gravity, ensuring blocks register reliably regardless of the user's calibrated facing direction.

## In-Game Calibration Check Screen (v5)

### Goal
Before starting the high-intensity combat game loop, players need a risk-free screen to verify that their smartphone's gyroscopic stream is mirroring the 3D blade correctly and check that all slash directions and block stances trigger properly.

### Implementation
- **New state**: Added `'calibration'` state to the desktop game client.
- **Dojo Arena Preview**: When in the calibration state, the game canvas starts the isometric render loop, showing the player's circular pedestal and the 3D-projected glowing Katana mirroring their phone rotations.
- **Calibration Checklist Overlay**: Added an HTML HUD component [CalibrationCheck.tsx](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/game/src/components/CalibrationCheck.tsx) that shows a checklist of available techniques:
  - Horizontal Slash (← →)
  - Vertical Slash (↑ ↓)
  - Diagonal Slash (↘ ↖)
  - Forward Thrust (▶)
  - Defense Block (⛊)
- **Interactive Triggers**: As the player practices and performs slashes/blocks, corresponding socket gesture packets dynamically tick off and illuminate checklist items with cybernetic styling.
- **Validation-Locked Start**: The player can exit back to the lobby or proceed to the Dojo Arena once they are satisfied with their sword calibration.

## Three.js 3D Cyber-Samurai Integration (v6)

### Goal
Replace the 2D projected line canvas engine with a true hardware-accelerated 3D WebGL renderer. Make the player's character appear as an armored cyberpunk Samurai holding the glowing Katana, and translate 2D coordinate projections into a fully spatial 3D arena.

### Implementation
- **WebGL Renderer**: Installed `three` and integrated a `THREE.WebGLRenderer` rendering to a container `div` mount, with dynamic aspect-ratio resizing.
- **Cyber-Samurai Mesh Factory**: Built a low-poly character model inside [samuraiModel.ts](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/game/src/engine/samuraiModel.ts) using Three.js group geometries:
  - Dark metal plates with neon pink accent breastplates.
  - Head spheres with glowing neon blue visors and gold crest horns (Kuwagata helm).
  - An arm pivot joint holding the Katana that rotates in 3D using phone orientation.
  - A glowing 3D Katana blade with emissive neon materials that change color dynamically (blue for attack, purple for active blocks).
- **Holographic After-Image Trail**: Swapped the 2D ribbon trail for spatial blade ghost meshes that duplicate the Katana's world matrix dynamically and fade away using opacity intervals.
- **Armored 3D Swarms**: Refactored enemies into solid 3D shapes:
  - Drones: Hovering hexagonal hulls with spinning rotor meshes.
  - Shieldbots: Armored cubes with glowing purple front-shields.
  - Cyber Ninjas: Orbiting pink octahedrons.
  - Kamikazes: Aggressive pointed cones.
  - Mini Boss Samurai: Giant scarlet armored cylinder with dual gold helm crests.
- **GPU Point Particle System**: Programmed a high-performance particle engine using a single `THREE.Points` draw call with memory-safe `THREE.BufferGeometry` attributes (reused across all enemy explosion bursts).

## Standalone Practice Range / Decoupled Calibration (v7)

### Goal
Decouple the calibration verification process from the main game startup sequence. Create a dedicated calibration practice range accessible directly from the Lobby, allowing users to sync and test their movement gestures without initiating the wave system.

### Implementation
- **Lobby Redesign**: The Lobby [Lobby.tsx](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/game/src/components/Lobby.tsx) now renders two separate actions when paired:
  - **Enter Dojo Arena**: Directly starts the game (`gameState = 'playing'`).
  - **Practice & Calibrate**: Opens the standalone practice range (`gameState = 'calibration'`).
- **Independent Practice Range**: The Calibration Check screen [CalibrationCheck.tsx](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/game/src/components/CalibrationCheck.tsx) has been updated to remove the "Enter Arena" action. It now acts as a dedicated sandbox where players can test moves and calibrate indefinitely, exiting back to the Lobby when finished.

## Custom 3D GLB Samurai Model Integration (v8)

### Goal
Replace the abstract low-poly geometric placeholder player mesh with a high-fidelity custom GLB 3D model (`iron_man_-_iron_samurai.glb`) without affecting the dynamic 3D Katana blade, hilt, forearm, and pulsing shield functionality or introducing blocking asset load times.

### Implementation
- **Vite Asset Serving**: Placed the 29MB `iron_man_-_iron_samurai.glb` model in the `game/public/` folder, enabling the browser-side code to download it asynchronously via `/iron_man_-_iron_samurai.glb`.
- **GLTFLoader Integration**: Integrated the loader in [App.tsx](file:///home/sayandeep/my-projects/personal-project/neon%20ronin/game/src/App.tsx) inside the main rendering `useEffect` setup.
- **Cyberpunk Material Enhancements**: Traversed the loaded GLB mesh hierarchy to override standard values, setting `metalness = 0.85` and `roughness = 0.25` for a shiny, reflective cyberpunk aesthetic.
- **Weapon-Mesh De-duplication**: Hid model-internal static sword/weapon meshes by scanning child names for keywords (`sword`, `katana`, `blade`, `hilt`, `weapon`, `sheath`, `scabbard`), preventing conflict and overlaps with our dynamic orientation-responsive katana hilt/blade.
- **Bounding Box Normalization**: Standardized the scale factor based on the computed bounding box height, setting the target height to 22 units (the exact height of the placeholder character) and centering the model's pivot at `y = 0` on the arena pedestal.
- **Smooth Placeholder Swap**: Kept the lightweight geometry placeholder meshes visible initially to avoid black screens during load time, swapping them to invisible once the GLB loaded successfully.






