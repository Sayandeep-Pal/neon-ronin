class SoundManager {
  private ctx: AudioContext | null = null;
  private synthInterval: any = null;
  public isMuted: boolean = false;

  initAudio() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.startSynthDrone();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  startSynthDrone() {
    if (this.isMuted || !this.ctx) return;
    try {
      const ctx = this.ctx;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc1.type = 'sawtooth';
      osc2.type = 'square';
      osc1.frequency.setValueAtTime(55, ctx.currentTime); // A1 note
      osc2.frequency.setValueAtTime(55.5, ctx.currentTime); // detune slightly

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(120, ctx.currentTime);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();

      // Moderate pitch sweep LFO
      if (this.synthInterval) clearInterval(this.synthInterval);
      this.synthInterval = setInterval(() => {
        if (ctx.state === 'running') {
          const cut = 100 + Math.sin(Date.now() / 2000) * 40;
          filter.frequency.setValueAtTime(cut, ctx.currentTime);
        }
      }, 50);
    } catch (e) {
      console.error(e);
    }
  }

  playSound(type: 'swing' | 'hit' | 'perfect' | 'damage' | 'alarm' | 'boss_charge') {
    if (this.isMuted || !this.ctx) return;
    try {
      const ctx = this.ctx;
      const now = ctx.currentTime;

      if (type === 'swing') {
        // Bandpass noise sweep for katana swing
        const bufferSize = ctx.sampleRate * 0.15; // 150ms
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.setValueAtTime(8, now);
        filter.frequency.setValueAtTime(800, now);
        filter.frequency.exponentialRampToValueAtTime(150, now + 0.15);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
      } 
      else if (type === 'hit') {
        // High impact laser blast with rapid pitch envelope
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.2);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.2);
      } 
      else if (type === 'perfect') {
        // Synthesizer metallic high clash + chord (Perfect rating!)
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc2.type = 'sawtooth';
        
        osc1.frequency.setValueAtTime(880, now); // A5
        osc2.frequency.setValueAtTime(1320, now); // E6

        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(); osc2.start();
        osc1.stop(now + 0.4); osc2.stop(now + 0.4);
      } 
      else if (type === 'damage') {
        // Low distorted explosion growl
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.linearRampToValueAtTime(30, now + 0.4);

        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.4);
      } 
      else if (type === 'alarm') {
        // Pitch sweep warning siren
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, now);
        osc.frequency.linearRampToValueAtTime(700, now + 0.25);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(now + 0.25);
      }
    } catch (e) {
      console.error(e);
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      if (this.synthInterval) {
        clearInterval(this.synthInterval);
        this.synthInterval = null;
      }
    } else {
      this.startSynthDrone();
    }
  }

  cleanup() {
    if (this.synthInterval) {
      clearInterval(this.synthInterval);
      this.synthInterval = null;
    }
  }
}

export const soundManager = new SoundManager();
