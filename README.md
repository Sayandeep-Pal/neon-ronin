# Neon Ronin ⚔️🌌
> **Turn your smartphone into a cyber-katana and defend Neo-Tokyo from rogue AI warriors.**

Neon Ronin is a real-time, motion-controlled cyberpunk browser action game. The desktop browser hosts the game canvas (Dojo) while your smartphone acts as a paired cyber-katana using browser motion sensor APIs (`DeviceOrientationEvent` and `DeviceMotionEvent`).

---

## 🏗️ Project Architecture

The project is modularized into three separate folders:
1. **`game/`**: Desktop browser client (React + Vite + HTML5 Isometric Canvas Engine + Web Audio Synthesizer).
2. **`controller/`**: Mobile controller client (React + Vite + DeviceMotion Sensor Throttling + CSS 3D sword preview).
3. **`backend/`**: Low-latency signal broker (Node.js + Express + Socket.io Room Pairing).

---

## ⚡ Quick Start

### 1. Install Dependencies
Install all packages across the root, backend, game, and controller in one command:
```bash
pnpm run install:all
```

### 2. Start Development Dojo
Start the Express server, Desktop Game, and Mobile Controller dev servers concurrently:
```bash
pnpm run dev
```

The servers will spin up on:
* **Backend**: `http://localhost:3001`
* **Desktop Game**: `http://localhost:5173`
* **Mobile Controller**: `http://localhost:5174`

---

## 🌐 Mobile Testing & Port Forwarding

Modern mobile browsers strictly block `DeviceMotionEvent` and `DeviceOrientationEvent` over plain, insecure HTTP (except for `localhost`). To test on your physical phone, you must use secure HTTPS tunnels.

### Using VS Code Devtunnels (Recommended)
1. Open the VS Code Port Forwarding tab.
2. Add the following ports:
   * **`5173`** (Game client) - Set Port Visibility to **Public**
   * **`5174`** (Controller client) - Set Port Visibility to **Public**
   * **`3001`** (Backend server) - Set Port Visibility to **Public**
3. Copy the **Forwarded Address** (e.g., `https://xxxx-3001.asse.devtunnels.ms`).

### Setting Up the Dojo Lobby
1. Open your forwarded address for the **Game** (`https://xxxx-5173.asse.devtunnels.ms`).
2. In the Dojo Lobby configuration panel:
   * Set **Backend Server URL** to your forwarded backend address: `https://xxxx-3001.asse.devtunnels.ms`
   * Set **Controller Client URL Base** to your forwarded controller client address: `https://xxxx-5174.asse.devtunnels.ms`
3. Click **Open Dojo Portal**.
4. Scan the generated QR Code with your smartphone. It will automatically load the controller, link to the backend, and pair the device.

---

## ⚔️ Combat Guide

### Controls & Calibration
1. **Calibrate**: Hold your phone straight in front of you (like a sword hilt, screen facing you) and tap **Calibrate** to set your baseline yaw, pitch, and roll.
2. **Horizontal Slash (← →)**: Swipe rapidly left or right. Destroys **Drones** (cyan hexagons).
3. **Vertical Slash (↑ ↓)**: Swing rapidly down. Destroys **Shield Bots** (purple cubes, shield blocks horizontal attacks).
4. **Diagonal Slash (↘ ↖)**: Swing rapidly at a 45-degree angle. Destroys **Cyber Ninjas** (pink diamonds).
5. **Thrust (Forward Stab)**: Thrust the phone straight forward. Destroys **Kamikaze Drones** (blinking orange triangles).
6. **Block Stance**: Hold your phone steady and upright (blade pointing to the ceiling). Activates a glowing shield. Necessary to parry **AI Samurai Boss** attacks and block incoming drone strikes.

---

## 🧬 Core Features (No Asset Overhead)

* **Low-Latency Telemetry**: Rate-limited sensor updates (30Hz) packed with linear acceleration and Euler orientation angles.
* **Haptic Sync**: Mobile triggers vibration feedback (`navigator.vibrate`) in sync with clashing steel (50ms), perfect attacks (150ms), and taking damage (200ms).
* **3D Controller Mirroring**: The controller UI features a 3D-CSS katana that mimics your physical phone's pitch, yaw, and roll in real-time.
* **Dynamic Isometric Render**: Complete 60fps HTML5 Canvas layout processing isometric projections ($30^\circ$ angles) for grids, enemies, and katanas.
* **Audio Synthesis (0-byte footprint)**: Leverages browser **Web Audio API** to generate real-time ambient synthwave drone tracks, katana swooshes, metal impact hits, and alarm sirens programmatically.
