export class SoundManager {
  ctx: AudioContext | null = null;
  bgmOsc: OscillatorNode | null = null;
  bgmGain: GainNode | null = null;
  isPlayingBgm = false;
  bgmInterval: any = null;

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playJump() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(600, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playDoubleJump() {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(500, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(900, this.ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  playCrash() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 0.5; // 0.5 seconds
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.5);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.5);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    noise.start();
  }

  playSwoosh() {
    if (!this.ctx) return;
    const bufferSize = this.ctx.sampleRate * 1.5; // 1.5 sec
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1500, this.ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 1.5);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.03, this.ctx.currentTime + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    noise.start();
  }

  playStep(isRunning: boolean) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isRunning ? 120 : 80, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.03, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playTenseBGM() {
    if (!this.ctx) return;
    if (this.isPlayingBgm) return;
    this.isPlayingBgm = true;

    // Create a continuous oscillating siren for tense BGM
    this.bgmOsc = this.ctx.createOscillator();
    this.bgmGain = this.ctx.createGain();
    
    // An LFO to modulate the frequency (creates a siren/tense effect)
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();

    lfo.type = 'sine';
    lfo.frequency.value = 2.5; // 2.5 Hz modulation
    
    // Siren pitch range
    lfoGain.gain.value = 40; // +/- 40 Hz
    this.bgmOsc.frequency.value = 200; // Base 200 Hz (very audible)
    
    lfo.connect(lfoGain);
    lfoGain.connect(this.bgmOsc.frequency);
    
    this.bgmOsc.type = 'sawtooth';
    
    this.bgmOsc.connect(this.bgmGain);
    this.bgmGain.connect(this.ctx.destination);
    
    this.bgmGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.bgmGain.gain.linearRampToValueAtTime(0.1, this.ctx.currentTime + 1); // Fade in
    
    this.bgmOsc.start();
    lfo.start();

    // Store LFO so we can stop it later
    (this.bgmOsc as any).lfo = lfo;
  }

  stopBGM() {
    this.isPlayingBgm = false;
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.bgmGain.gain.setValueAtTime(this.bgmGain.gain.value, this.ctx.currentTime);
      this.bgmGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
    }
    if (this.bgmOsc && this.ctx) {
      const osc = this.bgmOsc;
      const lfo = (osc as any).lfo;
      osc.stop(this.ctx.currentTime + 0.5);
      if (lfo) lfo.stop(this.ctx.currentTime + 0.5);
      this.bgmOsc = null;
    }
    if (this.bgmInterval) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

export const soundManager = new SoundManager();
