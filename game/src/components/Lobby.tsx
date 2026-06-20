import { Swords, Smartphone } from 'lucide-react';

interface LobbyProps {
  roomId: string;
  backendUrl: string;
  setBackendUrl: (val: string) => void;
  controllerUrlBase: string;
  setControllerUrlBase: (val: string) => void;
  isSearchingHost: boolean;
  isControllerConnected: boolean;
  qrCodeUrl: string;
  hostGameSession: () => void;
  startPlaying: () => void;
}

export function Lobby({
  roomId,
  backendUrl,
  setBackendUrl,
  controllerUrlBase,
  setControllerUrlBase,
  isSearchingHost,
  isControllerConnected,
  qrCodeUrl,
  hostGameSession,
  startPlaying
}: LobbyProps) {
  return (
    <div className="lobby-screen">
      <h1 className="lobby-title">Neon Ronin</h1>
      <h2 className="lobby-subtitle">Cyber-Katana Motion Slasher</h2>

      <div className="lobby-panels">
        {/* Host Server configurations */}
        <div className="lobby-panel">
          <div className="subtitle" style={{ fontSize: '0.8rem', marginBottom: '20px' }}>Step 1: Configure Port Link</div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="subtitle" style={{ fontSize: '0.7rem', alignSelf: 'flex-start' }}>Backend Server URL</label>
              <input
                type="text"
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid var(--text-secondary)',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '10px',
                  fontSize: '0.9rem',
                  fontFamily: 'var(--font-display)',
                  outline: 'none'
                }}
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="subtitle" style={{ fontSize: '0.7rem', alignSelf: 'flex-start' }}>Controller client url base</label>
              <input
                type="text"
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid var(--text-secondary)',
                  borderRadius: '4px',
                  color: '#fff',
                  padding: '10px',
                  fontSize: '0.9rem',
                  fontFamily: 'var(--font-display)',
                  outline: 'none'
                }}
                value={controllerUrlBase}
                onChange={(e) => setControllerUrlBase(e.target.value)}
              />
            </div>
          </div>

          {!roomId ? (
            <button className="cyber-btn" style={{ width: '100%', marginTop: '30px' }} onClick={hostGameSession} disabled={isSearchingHost}>
              {isSearchingHost ? 'Pairing...' : 'Open Dojo Portal'}
            </button>
          ) : (
            <div style={{ width: '100%', textAlign: 'center', marginTop: '20px' }}>
              <span className="subtitle" style={{ fontSize: '0.65rem' }}>Dojo Portal Open</span>
              <div className="room-display">{roomId}</div>
            </div>
          )}
        </div>

        {/* QR Connection client pairing */}
        <div className={`lobby-panel paired ${isControllerConnected ? 'paired' : ''}`}>
          <div className="subtitle" style={{ fontSize: '0.8rem', marginBottom: '20px' }}>Step 2: Sync Cyber Katana</div>

          {qrCodeUrl && !isControllerConnected ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
              <div className="qr-placeholder">
                <img src={qrCodeUrl} alt="Scan to connect controller" style={{ width: '200px', height: '200px' }} />
              </div>
              <span className="subtitle" style={{ fontSize: '0.65rem', textAlign: 'center' }}>
                Scan with smartphone QR scanner or navigate to the controller URL to connect.
              </span>
            </div>
          ) : isControllerConnected ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, gap: '20px' }}>
              <Swords size={60} color="var(--neon-pink)" style={{ animation: 'sword-glow 1.5s infinite alternate' }} />
              <span className="subtitle" style={{ color: 'var(--neon-pink)', letterSpacing: '4px', fontWeight: 'bold' }}>
                KATANA SYNCED & ARMED
              </span>
              
              <button className="cyber-btn pink" style={{ marginTop: '20px', padding: '16px 50px' }} onClick={startPlaying}>
                Enter Dojo
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, color: 'var(--text-secondary)' }}>
              <Smartphone size={40} style={{ marginBottom: '10px' }} />
              <span style={{ fontSize: '0.8rem', letterSpacing: '1px' }}>Awaiting Dojo Portal initiation...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
