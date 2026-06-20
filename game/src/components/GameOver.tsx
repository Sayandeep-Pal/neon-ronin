interface GameOverProps {
  score: number;
  maxCombo: number;
  startPlaying: () => void;
  exitToLobby: () => void;
}

export function GameOver({
  score,
  maxCombo,
  startPlaying,
  exitToLobby
}: GameOverProps) {
  return (
    <div className="game-over-screen">
      <h1 className="game-over-title">Dojo Fallen</h1>
      <div style={{ display: 'flex', gap: '30px', margin: '20px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="subtitle" style={{ fontSize: '0.75rem' }}>Final Score</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--neon-blue)', fontFamily: 'var(--font-display)' }}>{score}</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div className="subtitle" style={{ fontSize: '0.75rem' }}>Highest Combo</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--neon-pink)', fontFamily: 'var(--font-display)' }}>{maxCombo}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '20px' }}>
        <button className="cyber-btn pink" onClick={startPlaying}>
          Re-enter Dojo
        </button>
        <button className="cyber-btn" onClick={exitToLobby}>
          Dojo Lobby
        </button>
      </div>
    </div>
  );
}
