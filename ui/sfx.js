/**
 * Slopkit procedural audio — ambient idle + UI SFX.
 * Mute preference stored in localStorage key: slopkit-sfx
 */
(function (global) {
  var KEY = "slopkit-sfx";
  var ctx = null;
  var master = null;
  var ambientNodes = [];
  var ambientOn = false;
  var unlocked = false;
  var enabled = true;

  try {
    var saved = localStorage.getItem(KEY);
    if (saved === "0") enabled = false;
  } catch (e) {}

  function ensure() {
    if (ctx) return ctx;
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.55 : 0;
    master.connect(ctx.destination);
    return ctx;
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function tone(freq, dur, type, gain, when) {
    if (!enabled || !ensure()) return;
    var t0 = when != null ? when : now();
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.08, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur, gain) {
    if (!enabled || !ensure()) return;
    var n = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = ctx.createBufferSource();
    var g = ctx.createGain();
    var f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 1800;
    f.Q.value = 0.8;
    src.buffer = buf;
    g.gain.value = gain || 0.04;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
  }

  function startAmbient() {
    if (!enabled || ambientOn || !ensure()) return;
    ambientOn = true;
    var t0 = now();
    function drone(freq, type, vol) {
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      var lfo = ctx.createOscillator();
      var lg = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      lfo.frequency.value = 0.07 + Math.random() * 0.05;
      lg.gain.value = freq * 0.004;
      lfo.connect(lg);
      lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 2.5);
      o.connect(g);
      g.connect(master);
      o.start();
      lfo.start();
      ambientNodes.push(o, lfo, g);
    }
    drone(55, "sine", 0.035);
    drone(82.5, "triangle", 0.018);
    drone(110, "sine", 0.012);
    drone(164.8, "sawtooth", 0.006);
    // soft pulse tick for "idle alive"
    var pulse = ctx.createOscillator();
    var pg = ctx.createGain();
    pulse.type = "sine";
    pulse.frequency.value = 440;
    pg.gain.value = 0.0001;
    pulse.connect(pg);
    pg.connect(master);
    pulse.start();
    ambientNodes.push(pulse, pg);
    setInterval(function () {
      if (!enabled || !ambientOn || !ctx) return;
      var t = now();
      pg.gain.cancelScheduledValues(t);
      pg.gain.setValueAtTime(0.0001, t);
      pg.gain.exponentialRampToValueAtTime(0.015, t + 0.02);
      pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    }, 3200);
  }

  function stopAmbient() {
    ambientOn = false;
    for (var i = 0; i < ambientNodes.length; i++) {
      try { ambientNodes[i].stop && ambientNodes[i].stop(); } catch (e) {}
      try { ambientNodes[i].disconnect && ambientNodes[i].disconnect(); } catch (e) {}
    }
    ambientNodes = [];
  }

  function unlock() {
    if (!ensure()) return;
    if (ctx.state === "suspended") ctx.resume();
    unlocked = true;
    if (enabled) {
      master.gain.setTargetAtTime(0.55, now(), 0.05);
      startAmbient();
    }
  }

  var api = {
    enabled: function () { return enabled; },
    unlock: unlock,
    setEnabled: function (on) {
      enabled = !!on;
      try { localStorage.setItem(KEY, enabled ? "1" : "0"); } catch (e) {}
      if (!ensure()) return;
      if (enabled) {
        master.gain.setTargetAtTime(0.55, now(), 0.05);
        if (unlocked) startAmbient();
        api.click();
      } else {
        master.gain.setTargetAtTime(0.0001, now(), 0.05);
        stopAmbient();
      }
    },
    click: function () {
      if (!enabled) return;
      unlock();
      tone(520, 0.08, "square", 0.04);
      tone(780, 0.06, "triangle", 0.03, now() + 0.04);
      noiseBurst(0.04, 0.025);
    },
    hover: function () {
      if (!enabled || !unlocked) return;
      tone(640, 0.05, "sine", 0.02);
    },
    status: function () {
      if (!enabled) return;
      unlock();
      tone(360, 0.1, "triangle", 0.03);
      tone(540, 0.12, "sine", 0.025, now() + 0.06);
    },
    kural: function () {
      if (!enabled) return;
      unlock();
      tone(392, 0.18, "sine", 0.04);
      tone(494, 0.2, "sine", 0.03, now() + 0.12);
      tone(587, 0.28, "triangle", 0.025, now() + 0.24);
    },
    loading: function () {
      if (!enabled) return;
      unlock();
      var t = now();
      for (var i = 0; i < 6; i++) {
        tone(220 + i * 70, 0.12, "sawtooth", 0.03, t + i * 0.09);
      }
      noiseBurst(0.2, 0.03);
    },
    success: function () {
      if (!enabled) return;
      unlock();
      tone(523, 0.15, "sine", 0.05);
      tone(659, 0.18, "sine", 0.04, now() + 0.1);
      tone(784, 0.28, "triangle", 0.04, now() + 0.2);
    },
    idlePing: function () {
      if (!enabled || !unlocked) return;
      tone(180, 0.3, "sine", 0.015);
    }
  };

  global.SlopkitSFX = api;
})(window);
