export class SoundManager {
  constructor(game) {
    this.game = game;
    this.ctx = null;
    this.windNode = null;
    this.slideNode = null;
    this.windGain = null;
    this.slideGain = null;
    this.initialized = false;
    this.footstepInterval = 0.45; // seconds between steps
    this.footstepTimer = 0;
  }

  init() {
    // We defer actual audio context creation to the first click to avoid autoplay warning
    document.addEventListener('click', () => this.initContext(), { once: true });
    document.addEventListener('keydown', () => this.initContext(), { once: true });
  }

  initContext() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.setupWindAmbience();
      this.setupSlideSound();
      this.initialized = true;
      console.log('Web Audio Context Initialized Successfully.');
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  // Helper to create a noise buffer
  createNoiseBuffer() {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  setupWindAmbience() {
    const buffer = this.createNoiseBuffer();
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    // Filter white noise to create wind blowing
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 1.5;

    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0.0; // start silent

    source.connect(filter);
    filter.connect(this.windGain);
    this.windGain.connect(this.ctx.destination);
    
    source.start(0);
    this.windNode = source;

    // Slowly modulate the wind filter frequency to simulate gustiness
    setInterval(() => {
      if (this.game.state === 'playing') {
        const time = this.ctx.currentTime;
        const currentWindForce = this.game.obstacles.getCurrentWindForce(this.game.playerController.position.z).x;
        const baseFreq = 400 + Math.abs(currentWindForce) * 500;
        filter.frequency.setValueAtTime(baseFreq, time);
        filter.frequency.exponentialRampToValueAtTime(baseFreq + (Math.random() * 300 - 150), time + 1);
        
        // Slightly increase wind volume when there is an active gust
        const targetVol = 0.05 + Math.min(0.12, Math.abs(currentWindForce) * 0.15);
        this.windGain.gain.linearRampToValueAtTime(targetVol, time + 0.5);
      }
    }, 1000);
  }

  setupSlideSound() {
    const buffer = this.createNoiseBuffer();
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 200; // low rumble of sliding egg

    this.slideGain = this.ctx.createGain();
    this.slideGain.gain.value = 0.0;

    source.connect(filter);
    filter.connect(this.slideGain);
    this.slideGain.connect(this.ctx.destination);
    source.start(0);
    this.slideNode = source;
  }

  setSlideIntensity(intensity) {
    if (!this.initialized || !this.slideGain) return;
    const time = this.ctx.currentTime;
    // Map slide intensity to volume and slightly change filter freq
    this.slideGain.gain.linearRampToValueAtTime(intensity * 0.22, time + 0.05);
  }

  playWindAmbience(play) {
    if (!this.initialized || !this.windGain) return;
    const time = this.ctx.currentTime;
    if (play) {
      this.windGain.gain.linearRampToValueAtTime(0.08, time + 1.0);
    } else {
      this.windGain.gain.linearRampToValueAtTime(0.0, time + 0.5);
    }
  }

  playFootstep(speedFactor = 1.0) {
    if (!this.initialized) return;
    
    const time = this.ctx.currentTime;
    
    // Procedural footstep (short filtered noise burst)
    const buffer = this.createNoiseBuffer();
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 180;
    filter.Q.value = 3;

    const gainNode = this.ctx.createGain();
    // randomize volume slightly
    gainNode.gain.setValueAtTime(0.02 + Math.random() * 0.015, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.12);

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.ctx.destination);

    source.start(time);
    source.stop(time + 0.15);
  }

  playClick() {
    if (!this.initialized) return;
    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, time); // C5
    osc.frequency.exponentialRampToValueAtTime(1046.5, time + 0.08); // C6

    gain.gain.setValueAtTime(0.08, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(time);
    osc.stop(time + 0.08);
  }

  playCrack() {
    if (!this.initialized) return;
    const time = this.ctx.currentTime;

    // Generate a sharp crack (dry snap) followed by squishy sound
    const osc = this.ctx.createOscillator();
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer();

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(time);
    noise.stop(time + 0.35);

    // low pitch wet sound
    const squishOsc = this.ctx.createOscillator();
    const squishGain = this.ctx.createGain();
    squishOsc.type = 'sine';
    squishOsc.frequency.setValueAtTime(120, time);
    squishOsc.frequency.linearRampToValueAtTime(40, time + 0.2);

    squishGain.gain.setValueAtTime(0.2, time);
    squishGain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

    squishOsc.connect(squishGain);
    squishGain.connect(this.ctx.destination);

    squishOsc.start(time);
    squishOsc.stop(time + 0.25);
  }

  playVictory() {
    if (!this.initialized) return;
    const time = this.ctx.currentTime;

    // Arpeggio C Major: C5 - E5 - G5 - C6
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const duration = 0.12;

    notes.forEach((freq, index) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time + index * duration);

      gain.gain.setValueAtTime(0.0, time + index * duration);
      gain.gain.linearRampToValueAtTime(0.08, time + index * duration + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, time + index * duration + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(time + index * duration);
      osc.stop(time + index * duration + 0.3);
    });

    // Chord sweep at the end
    setTimeout(() => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50, 1318.51].forEach((freq) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.03, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + 1.2);
      });
    }, duration * 4 * 1000);
  }

  updateFootsteps(dt, speed) {
    if (!this.initialized || speed < 0.1) {
      this.footstepTimer = 0;
      return;
    }
    
    // The faster you walk, the quicker the footsteps trigger
    const stepInterval = this.footstepInterval / Math.max(0.6, speed * 0.4);
    this.footstepTimer += dt;
    if (this.footstepTimer >= stepInterval) {
      this.playFootstep(speed);
      this.footstepTimer = 0;
    }
  }
}
