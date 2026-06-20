interface SwordVisualizerProps {
  hudRot: { beta: number; gamma: number };
}

export function SwordVisualizer({ hudRot }: SwordVisualizerProps) {
  // Sword CSS 3D transform (uses smoothed rotation, clamped to sane ranges)
  const clampedBeta  = Math.min(Math.max(hudRot.beta,  -90), 90);
  const clampedGamma = Math.min(Math.max(hudRot.gamma, -75), 75);
  const swordStyle   = {
    transform: `rotateX(${-clampedBeta}deg) rotateY(${clampedGamma}deg)`,
  };

  return (
    <div className="sword-visualizer">
      <div className="sword-wrapper" style={swordStyle}>
        <div className="cyber-katana" />
        <div className="cyber-katana-tsuba" />
        <div className="cyber-katana-hilt" />
      </div>
    </div>
  );
}
