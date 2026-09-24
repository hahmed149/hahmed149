// Tiny synthesized engine and impact sounds. Off until the visitor turns them on.
export function createAudio() {
  let ctx, engine, gain, filter, on = false;
  function init() {
    ctx = new AudioContext();
    engine = ctx.createOscillator(); engine.type = 'sawtooth';
    const sub = ctx.createOscillator(); sub.type = 'square';
    filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 400;
    gain = ctx.createGain(); gain.gain.value = 0;
    const subGain = ctx.createGain(); subGain.gain.value = 0.4;
    engine.connect(filter); sub.connect(subGain).connect(filter); filter.connect(gain).connect(ctx.destination);
    engine.start(); sub.start();
    engine.sub = sub;
  }
  return {
    get on() { return on; },
    toggle() {
      if (!ctx) init();
      on = !on;
      if (on) ctx.resume(); else gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      return on;
    },
    engine(speed) {
      if (!on) return;
      const f = 38 + Math.abs(speed) * 3.2;
      engine.frequency.setTargetAtTime(f, ctx.currentTime, 0.05);
      engine.sub.frequency.setTargetAtTime(f / 2, ctx.currentTime, 0.05);
      filter.frequency.setTargetAtTime(300 + Math.abs(speed) * 25, ctx.currentTime, 0.05);
      gain.gain.setTargetAtTime(0.05 + Math.min(Math.abs(speed), 40) * 0.0025, ctx.currentTime, 0.1);
    },
    hit(strength = 1) {
      if (!on) return;
      const len = 0.25;
      const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900 + strength * 600;
      const g = ctx.createGain(); g.gain.value = 0.25 * strength;
      src.connect(f).connect(g).connect(ctx.destination);
      src.start();
    },
  };
}
