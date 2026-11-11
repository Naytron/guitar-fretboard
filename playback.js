/*
 * Playback — tiny Web Audio synth so scales, modes, and chords can be heard.
 * No samples, no dependencies; every pitch comes from the same pitch classes the
 * diagrams draw. Audio only starts from a user gesture.
 */
const Playback = (() => {
  'use strict';

  let context;
  let activeStop = null;
  const MIDI_C3 = 48;

  function audioContext() {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    context ??= new Ctor();
    if (context.state === 'suspended') context.resume();
    return context;
  }

  const frequency = midi => 440 * 2 ** ((midi - 69) / 12);

  /* Pitch classes → ascending MIDI numbers starting at the tonic in the C3 octave. */
  function scaleMidis(rootPc, steps) {
    const tonic = MIDI_C3 + rootPc;
    return [...steps.map(step => tonic + step), tonic + 12];
  }

  function chordMidis(rootPc, steps) {
    const root = MIDI_C3 + rootPc;
    return steps.map(step => root + step);
  }

  function pluck(ac, destination, midi, at, duration, peak) {
    const osc = ac.createOscillator();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    osc.type = 'triangle';
    osc.frequency.value = frequency(midi);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2400, at);
    filter.frequency.exponentialRampToValueAtTime(600, at + duration);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    osc.connect(filter).connect(gain).connect(destination);
    osc.start(at);
    osc.stop(at + duration + 0.05);
    return osc;
  }

  function stop() {
    if (activeStop) activeStop();
    activeStop = null;
  }

  /*
   * events: [{ midis: number[], at: seconds, duration: seconds }]
   * Notes inside one event are strummed slightly apart so chords sound plucked.
   */
  function schedule(events, onDone) {
    const ac = audioContext();
    if (!ac) return false;
    stop();
    const master = ac.createGain();
    master.gain.value = 0.9;
    master.connect(ac.destination);
    const start = ac.currentTime + 0.03;
    const oscillators = [];
    let end = start;
    for (const event of events) {
      event.midis.forEach((midi, index) => {
        const at = start + event.at + index * 0.035;
        oscillators.push(pluck(ac, master, midi, at, event.duration, 0.22 / Math.sqrt(event.midis.length)));
        end = Math.max(end, at + event.duration);
      });
    }
    const timer = setTimeout(() => { activeStop = null; onDone?.(); }, (end - ac.currentTime) * 1000 + 80);
    activeStop = () => {
      clearTimeout(timer);
      for (const osc of oscillators) { try { osc.stop(); } catch { /* already stopped */ } }
      master.disconnect();
      onDone?.();
    };
    return true;
  }

  function playMelody(midis, onDone, tempo = 0.3) {
    return schedule(midis.map((midi, index) => ({ midis: [midi], at: index * tempo, duration: tempo * 1.6 })), onDone);
  }

  function playChord(midis, onDone) {
    return schedule([{ midis, at: 0, duration: 1.6 }], onDone);
  }

  function playProgression(chords, onDone, beat = 0.9) {
    return schedule(chords.map((midis, index) => ({ midis, at: index * beat, duration: beat * 1.1 })), onDone);
  }

  /* A labelled play button that toggles to Stop while audio is running. */
  function button(label, play, className = 'play-button') {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = className;
    const icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = '▶';
    const text = document.createElement('span');
    text.textContent = label;
    element.append(icon, text);
    element.setAttribute('aria-pressed', 'false');
    let playing = false;
    const done = () => {
      playing = false;
      icon.textContent = '▶';
      element.setAttribute('aria-pressed', 'false');
    };
    element.addEventListener('click', () => {
      if (playing) { stop(); return; }
      if (!play(done)) {
        text.textContent = 'Audio unavailable';
        element.disabled = true;
        return;
      }
      playing = true;
      icon.textContent = '■';
      element.setAttribute('aria-pressed', 'true');
    });
    return element;
  }

  return { scaleMidis, chordMidis, playMelody, playChord, playProgression, stop, button };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Playback;
