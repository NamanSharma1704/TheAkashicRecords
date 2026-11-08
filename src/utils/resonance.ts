/**
 * THE RESONANCE SCALE: an opt-in note for each chapter read.
 *
 * Off unless the reader turns it on (the profile's Chapter sounds toggle; saved per device in
 * localStorage, like low-power effects). Each read climbs a pentatonic ladder, C5 D5 E5 G5 A5,
 * and from the sixth on rings the octave chime C6; ten seconds without a read and the ladder
 * starts again from the root. One note per READ, not per chapter: App plays it when a chapter
 * burst opens, the same moment the dais pulses, so a held stepper is one note, not a run of them.
 *
 * Synthesised with Web Audio, no files: a soft bell (a sine and two quieter overtones that fade
 * faster), a quick attack and an exponential fall, quiet. The context is created on first use,
 * which is always inside a tap or key press, so browsers allow it to sound. On iPhone the ring /
 * silent switch mutes it, as it should.
 */

const LADDER = [523.25, 587.33, 659.25, 783.99, 880.0]; // C5 D5 E5 G5 A5
const CHIME = 1046.5;                                      // C6
const RESET_MS = 10_000;
const KEY = 'akashic_sounds';

let ctx: AudioContext | null = null;
let step = 0;
let lastAt = -Infinity;

export const soundsEnabled = (): boolean => {
    try { return localStorage.getItem(KEY) === 'on'; } catch { return false; }
};

export const setSoundsEnabled = (on: boolean) => {
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* private mode: this session only */ }
};

const context = (): AudioContext | null => {
    if (ctx) return ctx;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch { return null; }
    return ctx;
};

/** One bell tone at `freq`, `length` seconds long. */
const bell = (freq: number, length: number, level: number) => {
    const ac = context();
    if (!ac) return;
    if (ac.state === 'suspended') void ac.resume();
    const t = ac.currentTime;
    const out = ac.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(level, t + 0.012);
    out.gain.exponentialRampToValueAtTime(0.0001, t + length);
    out.connect(ac.destination);
    // The fundamental and two overtones; the overtones fall away first, which is what makes it
    // a struck crystal rather than a beep.
    ([[1, 1, length], [2, 0.32, length * 0.55], [3, 0.12, length * 0.35]] as const).forEach(([mult, gain, len]) => {
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq * mult, t);
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len);
        osc.connect(g).connect(out);
        osc.start(t);
        osc.stop(t + length + 0.05);
    });
};

/** A chapter read: the next note of the ladder (or the chime past its top). */
export const playResonance = () => {
    const now = performance.now();
    if (now - lastAt > RESET_MS) step = 0;
    lastAt = now;
    const chime = step >= LADDER.length;
    bell(chime ? CHIME : LADDER[step], chime ? 1.3 : 0.55, chime ? 0.16 : 0.12);
    step += 1;
};

/** The preview played when the toggle is turned on: the root, without moving the ladder. */
export const previewResonance = () => bell(LADDER[0], 0.55, 0.12);
