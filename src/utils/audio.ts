// Web Audio API Sound Synthesizer & Real Human Voice Engine for Ultrawoman Tactical Simulator

class UltraAudioEngine {
  private ctx: AudioContext | null = null;
  private timerOsc1: OscillatorNode | null = null;
  private timerOsc2: OscillatorNode | null = null;
  private timerGain: GainNode | null = null;
  private timerTimerId: number | null = null;
  private isMuted: boolean = false;
  private masterVol: number = 0.8;
  private timerVol: number = 0.7;
  private isHumanVoiceEnabled: boolean = true;
  private selectedVoiceIndex: number = 0;
  private availableVoices: SpeechSynthesisVoice[] = [];
  // 音量总线 / 限幅器 / 节流 / 设置持久化
  private masterGain: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private lastPlayedAt: Record<string, number> = {};
  private unlockBound = false;
  private static readonly SETTINGS_KEY = 'ultra_audio_settings_v1';

  constructor() {
    this.loadPersistedSettings();
    // Lazy init audio context and Web Speech voices
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.initVoices();
      window.speechSynthesis.onvoiceschanged = () => this.initVoices();
    }
  }

  private initVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const allVoices = window.speechSynthesis.getVoices();
    // Filter Chinese/Asian female voices first, then general Chinese, then all
    const zhVoices = allVoices.filter(v => v.lang.startsWith('zh') || v.lang.startsWith('cmn'));
    this.availableVoices = zhVoices.length > 0 ? zhVoices : allVoices;
  }

  private getBestFemaleVoice(): SpeechSynthesisVoice | null {
    if (this.availableVoices.length === 0) {
      this.initVoices();
    }
    if (this.availableVoices.length === 0) return null;

    if (this.selectedVoiceIndex < this.availableVoices.length) {
      const preferred = this.availableVoices[this.selectedVoiceIndex];
      if (preferred) return preferred;
    }

    // Try to find female Chinese voices
    const femaleKeywords = ['xiaoxiao', 'huihui', 'yaoyao', 'tingting', 'sin-ji', 'mei-jia', 'female', 'woman', '普通话', 'chinese'];
    for (const kw of femaleKeywords) {
      const found = this.availableVoices.find(v => v.name.toLowerCase().includes(kw));
      if (found) return found;
    }

    return this.availableVoices[0] || null;
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (this.availableVoices.length === 0) this.initVoices();
    return this.availableVoices;
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (!this.ctx) return;
    // 主音量总线 + 限幅器：所有音效统一走这里，音量可调且连击不爆音
    if (!this.masterGain) {
      try {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = Math.max(0, Math.min(1, this.masterVol));
        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -6;
        this.limiter.knee.value = 6;
        this.limiter.ratio.value = 12;
        this.limiter.attack.value = 0.003;
        this.limiter.release.value = 0.15;
        this.masterGain.connect(this.limiter);
        this.limiter.connect(this.ctx.destination);
      } catch (e) {
        this.masterGain = null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    // 首次用户手势解锁（浏览器自动播放策略），避免"第一声没声音"
    if (!this.unlockBound && typeof window !== 'undefined') {
      this.unlockBound = true;
      const unlock = () => {
        try {
          if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        } catch (e) {}
        window.removeEventListener('pointerdown', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('pointerdown', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
    }
  }

  /** 所有音效的输出节点（主音量总线）；未初始化时回退到 destination */
  private getOutput(): AudioNode | null {
    if (this.masterGain) return this.masterGain;
    return this.ctx ? this.ctx.destination : null;
  }

  /**
   * 统一守卫：静音 / 音量 / 上下文状态 / 节流。
   * 以前每个方法只检查 isMuted，连击或高频触发会叠成一团噪音。
   */
  private canPlay(key: string, minIntervalMs: number): boolean {
    if (this.isMuted) return false;
    if (this.masterVol <= 0.001) return false;
    this.initCtx();
    if (!this.ctx) return false;
    const now = Date.now();
    if (now - (this.lastPlayedAt[key] || 0) < minIntervalMs) return false;
    this.lastPlayedAt[key] = now;
    return true;
  }

  private loadPersistedSettings() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(UltraAudioEngine.SETTINGS_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.masterVolume === 'number') this.masterVol = Math.max(0, Math.min(1, s.masterVolume));
      if (typeof s.timerVolume === 'number') this.timerVol = Math.max(0, Math.min(1, s.timerVolume));
      if (typeof s.isMuted === 'boolean') this.isMuted = s.isMuted;
      if (typeof s.isHumanVoiceEnabled === 'boolean') this.isHumanVoiceEnabled = s.isHumanVoiceEnabled;
    } catch (e) {}
  }

  private persistSettings() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(UltraAudioEngine.SETTINGS_KEY, JSON.stringify(this.getSettings()));
    } catch (e) {}
  }

  public getSettings() {
    return {
      masterVolume: this.masterVol,
      timerVolume: this.timerVol,
      isMuted: this.isMuted,
      isHumanVoiceEnabled: this.isHumanVoiceEnabled,
      voiceIndex: this.selectedVoiceIndex,
    };
  }

  public setSettings(masterVol: number, timerVol: number, isMuted: boolean, isHumanVoiceEnabled: boolean = true, voiceIndex: number = 0) {
    this.masterVol = Math.max(0, Math.min(1, masterVol));
    this.timerVol = Math.max(0, Math.min(1, timerVol));
    this.isMuted = isMuted;
    this.isHumanVoiceEnabled = isHumanVoiceEnabled;
    this.selectedVoiceIndex = voiceIndex;
    if (this.masterGain && this.ctx) {
      try {
        this.masterGain.gain.setTargetAtTime(
          this.isMuted ? 0 : this.masterVol,
          this.ctx.currentTime,
          0.01
        );
      } catch (e) {}
    }
    if (this.timerGain && this.ctx) {
      this.timerGain.gain.setValueAtTime(isMuted ? 0 : this.masterVol * this.timerVol, this.ctx.currentTime);
    }
    this.persistSettings();
  }

  // 0. Speech Synthesis disabled per user request (only combat impact SFX enabled)
  public speakVoiceLine(text: string, pitchMult: number = 1.0) {
    // Disabled human voices - only weapon impact SFX are active
    return;
  }

  // Stop current human speech
  public stopSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  // 1. Play Iconic Color Timer Beep (魔能值警报音) - 已根据要求取消低能量滴滴声音
  public startColorTimerBeep(_energy: number, _pitchMult: number = 1.0) {
    this.stopColorTimerBeep();
  }

  public stopColorTimerBeep() {
    if (this.timerTimerId !== null) {
      clearInterval(this.timerTimerId);
      this.timerTimerId = null;
    }
  }

  // 2. Heavy Laser Blast (高能光线)
  public playLaserSFX() {
    if (!this.canPlay('laser', 80)) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.3);

    gain.gain.setValueAtTime(this.masterVol * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.connect(gain);
    gain.connect(this.getOutput() as AudioNode);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  // 3. High Voltage Electric Zap (高压电击火花)
  public playElectricZapSFX() {
    if (!this.canPlay('zap', 60)) return;

    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.35;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      // Crackle white noise with square pulse modulator
      const squareMod = Math.sin(i * 0.1) > 0 ? 1 : -0.5;
      data[i] = (Math.random() * 2 - 1) * squareMod;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2500, now);
    filter.Q.setValueAtTime(3, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.masterVol * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getOutput() as AudioNode);

    noise.start(now);
  }

  // 4. Energy Siphon Drain (魔能值吸能音)
  public playSiphonSFX() {
    if (!this.canPlay('siphon', 80)) return;

    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sawtooth';

    osc1.frequency.setValueAtTime(800, now);
    osc1.frequency.linearRampToValueAtTime(220, now + 0.4);

    osc2.frequency.setValueAtTime(400, now);
    osc2.frequency.linearRampToValueAtTime(110, now + 0.4);

    gain.gain.setValueAtTime(this.masterVol * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.getOutput() as AudioNode);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.4);
    osc2.stop(now + 0.4);
  }

  // 5. Heavy Impact / Armor Shatter (重击与铠甲碎裂)
  public playImpactSFX() {
    if (!this.canPlay('impact', 45)) return;

    const now = this.ctx.currentTime;

    // Sub bass thud
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(160, now);
    subOsc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
    subGain.gain.setValueAtTime(this.masterVol * 0.6, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);

    subOsc.connect(subGain);
    subGain.connect(this.getOutput() as AudioNode);
    subOsc.start(now);
    subOsc.stop(now + 0.25);

    // Crack noise
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(this.masterVol * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    noise.connect(gain);
    gain.connect(this.getOutput() as AudioNode);
    noise.start(now);
  }

  // 6. Psy Wave / Mind Attack (脑波冲击)
  public playPsyWaveSFX() {
    if (!this.canPlay('psy', 90)) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(15, now); // 15Hz tremolo
    lfoGain.gain.setValueAtTime(100, now);

    // lfo -> lfoGain -> osc.frequency: without the gain stage the tremolo depth was
    // only ±1Hz (lfoGain was never wired into the graph, i.e. dead code).
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(this.masterVol * 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);

    osc.connect(gain);
    gain.connect(this.getOutput() as AudioNode);

    lfo.start(now);
    osc.start(now);
    lfo.stop(now + 0.5);
    osc.stop(now + 0.5);
  }

  // 7. Chains Restraint (反重力锁链束缚)
  public playChainsSFX() {
    if (!this.canPlay('chains', 90)) return;

    const now = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const delay = i * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1800 - i * 300, now + delay);
      osc.frequency.exponentialRampToValueAtTime(400, now + delay + 0.1);

      gain.gain.setValueAtTime(this.masterVol * 0.3, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.1);

      osc.connect(gain);
      gain.connect(this.getOutput() as AudioNode);

      osc.start(now + delay);
      osc.stop(now + delay + 0.1);
    }
  }

  // 8. Human vocal reaction sound disabled per user request (only weapon impact SFX enabled)
  public playVoiceGruntSFX(pitchMult: number = 1.0, reactionType: 'small' | 'heavy' | 'broken' = 'small') {
    // Disabled human vocal sound effects
    return;
  }

  // 9. Alien Console UI Click
  public playUiClick() {
    if (!this.canPlay('uiClick', 50)) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(900, now);
    osc.frequency.exponentialRampToValueAtTime(1800, now + 0.04);

    gain.gain.setValueAtTime(this.masterVol * 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.getOutput() as AudioNode);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  // 10. Healing / Energy Recharge Gentle Chime Sound Effect
  public playChimeSFX() {
    if (!this.canPlay('chime', 250)) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const delay = idx * 0.06;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(this.masterVol * 0.25, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.3);

      osc.connect(gain);
      gain.connect(this.getOutput() as AudioNode);

      osc.start(now + delay);
      osc.stop(now + delay + 0.3);
    });
  }

  // 11. AI Interrogation API Response Received Chime
  public playApiReplyChime() {
    if (!this.canPlay('apiChime', 250)) return;

    const now = this.ctx.currentTime;
    // Distinct double chime (987Hz B5 -> 1318Hz E6)
    const tones = [987.77, 1318.51];
    tones.forEach((freq, idx) => {
      if (!this.ctx) return;
      const delay = idx * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(this.masterVol * 0.3, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.4);

      osc.connect(gain);
      gain.connect(this.getOutput() as AudioNode);

      osc.start(now + delay);
      osc.stop(now + delay + 0.4);
    });
  }

  // 12. Full Energy Recharge Dramatic Sound Effect
  public playRechargeSFX() {
    if (!this.canPlay('recharge', 150)) return;

    const now = this.ctx.currentTime;
    const arpeggio = [440, 554.37, 659.25, 880, 1108.73, 1318.51, 1760]; // A major glissando surge
    arpeggio.forEach((freq, idx) => {
      if (!this.ctx) return;
      const delay = idx * 0.05;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.2, now + delay + 0.2);

      gain.gain.setValueAtTime(this.masterVol * 0.35, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);

      osc.connect(gain);
      gain.connect(this.getOutput() as AudioNode);

      osc.start(now + delay);
      osc.stop(now + delay + 0.35);
    });
  }

  // 13. Power Up / Success SFX
  public playPowerUp() {
    if (!this.canPlay('powerUp', 150)) return;

    const now = this.ctx.currentTime;
    const notes = [440, 554.37, 659.25, 880];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const delay = idx * 0.05;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + delay);

      gain.gain.setValueAtTime(this.masterVol * 0.2, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.25);

      osc.connect(gain);
      gain.connect(this.getOutput() as AudioNode);

      osc.start(now + delay);
      osc.stop(now + delay + 0.25);
    });
  }
}

export const ultraAudio = new UltraAudioEngine();
