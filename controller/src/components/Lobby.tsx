interface LobbyProps {
  roomId: string;
  setRoomId: (val: string) => void;
  backendUrl: string;
  setBackendUrl: (val: string) => void;
  isConnected: boolean;
  isConnecting: boolean;
  errorMsg: string;
  handleConnect: () => void;
}

export function Lobby({
  roomId,
  setRoomId,
  backendUrl,
  setBackendUrl,
  isConnected,
  isConnecting,
  errorMsg,
  handleConnect
}: LobbyProps) {
  return (
    <div className="connection-panel">
      <div className="status-badge">
        <div className={`status-dot ${isConnected ? 'connected' : isConnecting ? 'connecting' : ''}`} />
        {isConnected ? 'Server Connected' : isConnecting ? 'Connecting…' : 'Disconnected'}
      </div>

      <div className="room-input-container">
        <label className="subtitle" style={{ alignSelf: 'flex-start', fontSize: '0.75rem' }}>Room ID</label>
        <input
          type="text"
          className="room-input"
          placeholder="CYBER7"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          maxLength={6}
        />
      </div>

      <div className="room-input-container">
        <label className="subtitle" style={{ alignSelf: 'flex-start', fontSize: '0.75rem' }}>Backend Socket URL</label>
        <input
          type="text"
          className="room-input"
          style={{ fontSize: '0.9rem', letterSpacing: '0.5px' }}
          placeholder="http://host:3001"
          value={backendUrl}
          onChange={(e) => setBackendUrl(e.target.value.trim())}
        />
      </div>

      {errorMsg && (
        <div style={{ color: '#ff3355', fontSize: '0.85rem', textAlign: 'center' }}>
          {errorMsg}
        </div>
      )}

      <button className="neon-btn" onClick={handleConnect} disabled={isConnecting}
        style={{ width: '100%', marginTop: '12px', opacity: isConnecting ? 0.6 : 1 }}>
        {isConnecting ? 'Linking…' : 'Initialize Link'}
      </button>
    </div>
  );
}
