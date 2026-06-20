# Neon Ronin: Implementation Plan & Architectural Design

This document details the architecture, signal processing algorithms, and step-by-step roadmap for building **Neon Ronin**, a cyber-katana motion-controlled browser game.

---

## 1. Architecture Overview

Neon Ronin relies on a real-time, low-latency communication loop. The mobile phone acts as a telemetry streaming device (sensor client), and the desktop browser acts as the simulator and visualizer (game client), brokered by a Node.js signaling and room-pairing server.

### System Diagram

```mermaid
graph TD
    subgraph "Desktop Browser (Game Client)"
        G_UI[Game UI / React] <--> G_Engine[Phaser.js Game Engine]
        G_Engine --> G_Gesture[Gesture Recognition Engine]
        G_Conn[Socket.io Client] <--> G_UI
        G_Conn <--> G_Gesture
    end

    subgraph "Node.js Server"
        S_Express[Express HTTP Server] <--> S_WS[Socket.io WebSocket Server]
        S_Express --> S_Static[Static Asset Host]
    end

    subgraph "Mobile Device (Controller Client)"
        M_UI[Controller UI / React] <--> M_Sensors[DeviceMotion & Orientation API]
        M_Conn[Socket.io Client] <--> M_UI
        M_Sensors --> M_Conn
    end

    %% Communications
    M_Conn <--- WebSocket Link (Low Latency) ---> S_WS
    S_WS <--- WebSocket Link (Low Latency) ---> G_Conn
    S_Static -. Serves Code & Assets .-> M_UI
    S_Static -. Serves Code & Assets .-> G_UI
```

### Room Pairing Flow

1. **Desktop Client** connects to the server and requests a new room.
2. **Server** generates a unique 6-character alphanumeric Room ID (e.g., `CYBER7`) and registers a session mapping.
3. **Desktop Client** renders a QR Code encoding the URL: `https://<server-host>/controller?room=CYBER7`.
4. **Mobile Client** scans the QR code, opening the controller interface.
5. **Mobile Client** requests motion permissions (especially on iOS). Once granted, it connects to the server with `room=CYBER7`.
6. **Server** pairs the connections and notifies the Desktop Client: `CONTROLLER_CONNECTED`. Game begins.

---

## 2. Technical Stack

* **Monorepo / Unified Project Structure**:
  * Single Node.js package using **Vite** with multi-page entry points (Desktop Client at `/`, Mobile Controller at `/controller/`).
  * This keeps deployment to a single server instance simple and ensures zero-config coordination.
* **Backend Broker**: Express + `socket.io` (for automatic reconnection, buffering, and lower setup overhead).
* **Game Engine**: **Phaser.js** for 2D/2.5D graphics, particle systems, and collision detection, embedded inside a responsive React or HTML5 wrap.
* **Styling**: Cyberpunk theme with Vanilla CSS using CSS variables (dark background, neon pink `#ff007f`, neon blue `#00f0ff`, neon purple `#b026ff`).

---

## 3. The HTTPS Challenge (Crucial Dev Step)

Modern browsers (Safari, Chrome) **strictly block** `DeviceMotionEvent` and `DeviceOrientationEvent` on non-secure contexts (`http://`). 
* On `localhost` it works without HTTPS.
* Over a local IP (e.g. `http://192.168.1.5:3000`), it is blocked on mobile browsers.

### Our Solution
To allow local development and testing on physical mobile phones, the server will support a **Development Tunnel Mode**:
1. When running `npm run dev:tunnel`, the server starts and spawns a secure tunnel (using a library like `localtunnel` or `ngrok` client wrapper).
2. The generated QR code will display the public, secure `https://...localtunnel.me/controller?room=XXX` link.
3. This allows instant phone pairing over HTTPS without manual SSL setups or certificates.

---

## 4. Sensor Telemetry & Gesture Detection

To make the cyber-katana feel responsive, raw sensor data will be processed using a **hybrid client-server gesture engine**.

### Sensor Data Payload (Sent from Mobile at ~30Hz)
```json
{
  "timestamp": 1718919652000,
  "accel": { "x": 0.12, "y": -0.85, "z": 9.81 },       // Linear acceleration (m/s² excluding gravity)
  "rotation": { "alpha": 180.2, "beta": 45.1, "gamma": -1.2 }, // Euler angles (deg)
  "gyro": { "alpha": 0.0, "beta": 0.05, "gamma": -0.1 } // Angular velocity (rad/s)
}
```

### Gesture Recognition Logic (Run on Desktop for Visual Debugging)

We will implement a sliding-window buffer of size $N=10$ (~300ms of data) on the Desktop client to classify movements:

```text
                     [ Raw Telemetry Stream ]
                                |
                   [ Sliding Window Buffer (300ms) ]
                                |
             +------------------+------------------+
             |                                     |
    [ Acceleration Peak? ]                [ Rotation Stability? ]
             |                                     |
    Spike > threshold_high?               Is stdDev(gyro) < threshold_low
             |                            & Orientation angle ~ vertical?
    +--------+--------+                            |
    |                 |                       [ BLOCK STATE ]
[ Linear Y/Z ]    [ Linear X ]
    |                 |
  Thrust          Slash Angle
               (dx/dy vector)
                      |
           Horizontal / Vertical / Diagonal
```

1. **Horizontal Slash ($X$-dominant)**:
   * $\max(|a_x|) > T_{slash}$ and $|a_x| > |a_y|$.
   * Angle derived from $\text{atan2}(a_y, a_x)$ to distinguish left-to-right from right-to-left.
2. **Vertical Slash ($Y$-dominant)**:
   * $\max(|a_y|) > T_{slash}$ and $|a_y| > |a_x|$.
   * Detects top-to-bottom or bottom-to-top slashes.
3. **Diagonal Slash**:
   * Both $a_x$ and $a_y$ exceed threshold $T_{diagonal}$ concurrently within a tolerance window.
4. **Thrust ($Z$-dominant)**:
   * High negative acceleration spike along the $Z$-axis (pushing forward) followed by a deceleration spike.
5. **Block**:
   * Low overall acceleration ($|a| < T_{idle}$) while maintaining Euler tilt angles within the "guard position" range (e.g. phone upright, screen facing player).

---

## 5. Phase-by-Phase Roadmap

### Phase 1: Broker Server & Room Lobby
* Set up Node.js server with Express and Socket.io.
* Create standard workspace layout.
* Implement Room generation logic (host room, join room, route clients).
* Build basic Desktop lobby screen with dynamic QR Code showing local IP / Tunnel URL.

### Phase 2: Mobile Controller & Sensor Streaming
* Build mobile controller client UI.
* Add "Request Motion Permission" workflow for iOS (using `DeviceMotionEvent.requestPermission`).
* Implement telemetry collection and rate-limited streaming (30Hz throttling).
* Add interactive calibration screen (e.g., "Hold phone straight and tap Calibrate").

### Phase 3: Telemetry Visualizer & Gesture Sandbox
* Create a developer debug screen on Desktop.
* Add real-time line charts showing streaming $X, Y, Z$ accelerations and orientation angles.
* Implement the Gesture Recognition algorithms and display classified gestures on-screen in real-time.
* Add calibration correction offsets.

### Phase 4: Core Phaser.js Game Arena
* Bootstrap Phaser.js arena scene on the Desktop client.
* Design a cyberpunk center-stage where the Player (Ronin) stands.
* Add a cyber-katana blade model or 2D sprite that dynamically matches the Euler rotation of the physical phone.
* Create neon slash trails following the blade movement.

### Phase 5: AI Rogue Warriors (Enemies)
* Program enemy pathing approaching from Left, Right, or Front.
* Implement enemy types:
  * **Drone** (requires Horizontal slash)
  * **Shield Bot** (requires Vertical slash)
  * **Cyber Ninja** (requires Diagonal slash)
  * **Kamikaze** (requires Thrust)
  * **AI Samurai** (Boss, requires Block then counter-slash)
* Add collision bounds and slash intersection checks.

### Phase 6: Wave System & Game Loop
* Implement escalating waves (Waves 1-5, then Endless).
* Add Score, Combos (3x, 5x, 10x), and HP indicator (100 HP).
* Implement the "Perfect Slash" assessment (judged on sensor acceleration speed and accuracy of the slash angle).

### Phase 7: Haptics, Audio & Polish
* Hook up mobile device vibration feedback (`navigator.vibrate`) for hits (50ms), perfect slashes (150ms), and taking damage (200ms).
* Integrate Synthwave audio tracks and sound effects (saber hums, clashing steel, explosions).
* Add visual "juice": screen shake, glitch effects, neon particle bursts.

---

## 6. Next Steps & User Confirmation

To get started, please review this roadmap. We can adapt any part of this stack. 

Here are the key questions to align on before building:
1. **Tech Stack Confirmation**: Are you happy with a single **Vite + Express (Monorepo)** template using **Phaser.js** for the desktop client and **Vanilla JS/HTML5** for the controller, or do you have other framework preferences (e.g. Next.js, pure Canvas)?
2. **Tunnel Preference**: For local mobile testing, are you fine with using `localtunnel` (built-in, free, zero config) or do you prefer using a custom local SSL certificate?
3. **Target Visual Style**: Should we build the game arena in **2D (side/front perspective)** or a pseudo-3D/isometric view?
