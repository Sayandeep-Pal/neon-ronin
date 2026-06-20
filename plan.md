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
| `game-feedback` | Server → Controller | Visual flash + `navigator.vibrate()` |
| `host-disconnected` | Server → Controller | Game host left |
| `controller-disconnected` | Server → Desktop | Controller left |

