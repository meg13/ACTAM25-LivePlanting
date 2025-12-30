"""
🌱 Live Planting - Audio Controller con HTTP + WebSocket
=========================================================

Architettura:
- Audio: sounddevice (qualità perfetta, esce dalle casse del PC)
- Comandi: HTTP REST API (bottoni web → flag booleane)
- Visualizzazione: WebSocket (solo dati decimati per canvas)

Endpoints HTTP:
- POST /start        → Avvia audio + invia note di test
- POST /stop         → Ferma audio
- POST /start_rec    → Inizia registrazione loop
- POST /stop_rec     → Ferma registrazione loop
- POST /clear_loops  → Cancella tutti i loop
- POST /clear_ambient → Cancella voci ambient

WebSocket (ws://localhost:8765):
- Invia: Float32Array decimato (256 campioni) per visualizzazione
- Riceve: niente (comandi vanno via HTTP)
"""

import time, math, threading, asyncio, queue
import numpy as np
import sounddevice as sd
import serial
from collections import deque
from aiohttp import web
import websockets
import json

# -----------------------------
# VARIABILI GLOBALI
# -----------------------------
MAX_LOOPS = 10

# Recording state
is_recording = False
rec_start_t = 0.0
rec_events = []
recording_lock = threading.Lock()

# Loops storage
loops = []
loops_lock = threading.Lock()

# Audio playing state (controllato da HTTP)
is_audio_playing = False
audio_state_lock = threading.Lock()

# -----------------------------
# UTIL / MUSICA
# -----------------------------
def midi_to_freq(m):
    return 440.0 * (2.0 ** ((m - 69) / 12.0))

def midi_from_adc_semitones(adc, base_root=24, semis_max=60):
    adc = max(0, min(1023, int(adc)))
    semis = int(round((adc / 1023.0) * semis_max))
    return base_root + semis, semis

MAJOR_DEGREES = [0, 2, 4, 5, 7, 9, 11]

def quantize_to_major(semis: int, semis_max=60) -> int:
    semis = max(0, min(semis_max, int(semis)))
    octave = semis // 12
    degree = semis % 12
    nearest = min(MAJOR_DEGREES, key=lambda d: abs(d - degree))
    q = octave * 12 + nearest
    return min(q, semis_max)

def build_major_offsets_3_octaves(max_semitones=36):
    offs = []
    for octv in range(0, 4):
        for d in MAJOR_DEGREES:
            s = octv * 12 + d
            if s <= max_semitones:
                offs.append(s)
    return sorted(set(offs))

MAJOR_OFFSETS = build_major_offsets_3_octaves(36)

def humidity_to_note(h: float, base_root: int, h_min=200.0, h_max=400.0):
    if h <= h_min:
        semis = 0
    elif h >= h_max:
        semis = 36
    else:
        x = (h - h_min) / (h_max - h_min)
        semis = int(round(x * 36))
    nearest = min(MAJOR_OFFSETS, key=lambda o: abs(o - semis))
    return base_root + nearest, nearest

# -----------------------------
# PULSE tools
# -----------------------------
def hann_env(t, dur, fade_in_ratio=0.15, fade_out_ratio=0.25):
    """Inviluppo super morbido con fade-in/out separati per eliminare click."""
    env = np.zeros_like(t, dtype=np.float32)
    m = (t >= 0.0) & (t <= dur)

    fade_in_dur = dur * fade_in_ratio
    m_in = (t >= 0.0) & (t <= fade_in_dur)
    if fade_in_dur > 0:
        x_in = (t[m_in] / fade_in_dur).astype(np.float32)
        env[m_in] = (x_in * x_in).astype(np.float32)

    fade_out_start = dur * (1.0 - fade_out_ratio)
    m_sustain = (t > fade_in_dur) & (t < fade_out_start)
    env[m_sustain] = 1.0

    m_out = (t >= fade_out_start) & (t <= dur)
    if fade_out_ratio > 0:
        x_out = ((t[m_out] - fade_out_start) / (dur - fade_out_start)).astype(np.float32)
        env[m_out] = (0.5 + 0.5 * np.cos(np.pi * x_out)).astype(np.float32)

    return env

def softclip(x, drive=1.08):
    """Dolcezza: riduce harshness senza distorcere."""
    return np.tanh(drive * x).astype(np.float32)

# -----------------------------
# REVERB (Schroeder: comb + allpass)
# -----------------------------
class Comb:
    def __init__(self, delay_samp: int, feedback: float):
        self.buf = np.zeros(delay_samp, dtype=np.float32)
        self.i = 0
        self.fb = float(feedback)

    def process(self, x: np.ndarray) -> np.ndarray:
        y = np.empty_like(x, dtype=np.float32)
        buf = self.buf
        i = self.i
        fb = self.fb
        n = buf.shape[0]
        for k in range(x.shape[0]):
            out = buf[i]
            buf[i] = float(x[k]) + fb * out
            y[k] = out
            i += 1
            if i >= n:
                i = 0
        self.i = i
        return y

class Allpass:
    def __init__(self, delay_samp: int, g: float):
        self.buf = np.zeros(delay_samp, dtype=np.float32)
        self.i = 0
        self.g = float(g)

    def process(self, x: np.ndarray) -> np.ndarray:
        y = np.empty_like(x, dtype=np.float32)
        buf = self.buf
        i = self.i
        g = self.g
        n = buf.shape[0]
        for k in range(x.shape[0]):
            b = buf[i]
            inp = float(x[k])
            out = -g * inp + b
            buf[i] = inp + g * out
            y[k] = out
            i += 1
            if i >= n:
                i = 0
        self.i = i
        return y

class SchroederReverb:
    def __init__(self, sr: int):
        def ms(x):
            return max(1, int(sr * (x / 1000.0)))

        self.combL = [Comb(ms(m), feedback=0.78) for m in (29.7, 37.1, 41.1, 43.7)]
        self.combR = [Comb(ms(m), feedback=0.78) for m in (30.7, 38.1, 42.1, 44.7)]
        self.apL = [Allpass(ms(m), g=0.70) for m in (5.0, 1.7)]
        self.apR = [Allpass(ms(m), g=0.70) for m in (5.3, 1.9)]

        self.wet = 0.42
        self.dry = 0.82
        self.pre_lp = 0.60
        self.zL = 0.0
        self.zR = 0.0

    def _lp(self, x: np.ndarray, z: float):
        a = float(self.pre_lp)
        y = np.empty_like(x, dtype=np.float32)
        y0 = float(z)
        b = 1.0 - a
        for i in range(x.shape[0]):
            y0 = a * y0 + b * float(x[i])
            y[i] = y0
        return y, y0

    def process(self, xL: np.ndarray, xR: np.ndarray):
        inL, self.zL = self._lp(xL, self.zL)
        inR, self.zR = self._lp(xR, self.zR)

        yL = np.zeros_like(inL, dtype=np.float32)
        yR = np.zeros_like(inR, dtype=np.float32)
        for c in self.combL:
            yL += c.process(inL)
        for c in self.combR:
            yR += c.process(inR)

        yL *= (1.0 / len(self.combL))
        yR *= (1.0 / len(self.combR))

        for ap in self.apL:
            yL = ap.process(yL)
        for ap in self.apR:
            yR = ap.process(yR)

        outL = self.dry * xL + self.wet * yL
        outR = self.dry * xR + self.wet * yR
        return outL.astype(np.float32), outR.astype(np.float32)


# -----------------------------
# SYNTH CON VISUALIZZAZIONE
# -----------------------------
class CombinedSynth:
    """
    Synth di alta qualità con sounddevice.
    Audio esce sempre dalle casse del PC.
    Invia dati decimati per visualizzazione via queue.
    """
    def __init__(self, samplerate=48000, blocksize=2048, max_ambient_voices=24, max_pulse_voices=24):
        self.sr = samplerate
        self.blocksize = blocksize

        self.max_ambient = max_ambient_voices
        self.max_pulse = max_pulse_voices

        self.ambient_voices = []
        self.pulse_voices = []
        self.lock = threading.Lock()

        self.master_gain = 0.30

        # Reverb per le PULSE
        self.pulse_reverb = SchroederReverb(self.sr)

        # Queue per visualizzazione (non-blocking)
        self.viz_queue = queue.Queue(maxsize=50)

        # Decimazione per viz: invia 1 chunk ogni N
        self.viz_decimation = 4
        self.viz_counter = 0

        # sounddevice stream
        self.stream = sd.OutputStream(
            samplerate=self.sr,
            channels=2,
            blocksize=self.blocksize,
            dtype="float32",
            callback=self._callback
        )

    def start(self):
        self.stream.start()

    def stop(self):
        self.stream.stop()
        self.stream.close()

    def clear_ambient(self):
        with self.lock:
            self.ambient_voices.clear()

    def clear_pulse(self):
        with self.lock:
            self.pulse_voices.clear()

    def add_ambient_voice(self, midi_note: int, volume=0.12, pan=0.5,
                          vibrato_hz=5.0, vibrato_cents=10.0,
                          tremolo_hz=0.20, tremolo_depth=0.10):
        v = {
            "freq_base": float(midi_to_freq(midi_note)),
            "phase": 0.0,
            "volume": float(volume),
            "pan": float(pan),
            "t": 0.0,
            "attack": 1.5,
            "h1": 1.0, "h2": 0.20, "h3": 0.06,
            "vib_rate_hz": float(vibrato_hz),
            "vib_depth_hz": 0.08,
            "vib_depth_min": 0.5,
            "vib_depth_max": float(vibrato_cents),
            "trem_hz": float(tremolo_hz),
            "trem_depth": float(tremolo_depth),
        }
        with self.lock:
            self.ambient_voices.append(v)
            if len(self.ambient_voices) > self.max_ambient:
                self.ambient_voices = self.ambient_voices[-self.max_ambient:]

    def add_ambient_voice_moving(self, midi_note: int, volume=0.12, pan=0.5):
        vib_rate = 4.8 + np.random.rand() * 0.8
        vib_max_cents = 8.0 + np.random.rand() * 6.0
        trem_hz = 0.10 + np.random.rand() * 0.20
        trem_depth = 0.06 + np.random.rand() * 0.10
        self.add_ambient_voice(
            midi_note,
            volume=volume,
            pan=pan,
            vibrato_hz=vib_rate,
            vibrato_cents=vib_max_cents,
            tremolo_hz=trem_hz,
            tremolo_depth=trem_depth
        )

    def add_pulse_voice(self, midi_note: int, volume=0.58, duration=0.35, pan=0.5):
        """Aggiunge una nota PULSE con inviluppo e reverb - VERSIONE ANTI-CLICK"""
        v = {
            "freq_base": float(midi_to_freq(midi_note)),
            "phase": 0.0,
            "t": 0.0,
            "duration": float(duration),
            "h1": 1.0,
            "h2": 0.16,
            "h3": 0.045,
            "vib_rate_hz": 5.2,
            "vib_cents": 7.0,
            "trem_hz": 0.35,
            "trem_depth": 0.12,
            "volume": float(volume)
        }
        with self.lock:
            if len(self.pulse_voices) >= self.max_pulse:
                self.pulse_voices.pop(0)
            self.pulse_voices.append(v)

    def _callback(self, outdata, frames, time_info, status):
        """Callback sounddevice - genera audio di alta qualità"""
        if status:
            print(f"[AUDIO] Status: {status}")

        # Se audio non è attivo, genera silenzio
        with audio_state_lock:
            if not is_audio_playing:
                outdata[:, 0] = np.zeros(frames, dtype=np.float32)
                outdata[:, 1] = np.zeros(frames, dtype=np.float32)
                return

        ambL = np.zeros(frames, dtype=np.float32)
        ambR = np.zeros(frames, dtype=np.float32)
        pulL = np.zeros(frames, dtype=np.float32)
        pulR = np.zeros(frames, dtype=np.float32)

        dt = 1.0 / self.sr
        t_block = np.arange(frames, dtype=np.float32) * dt

        with self.lock:
            # ---- AMBIENCE render (infinite) ----
            for v in self.ambient_voices:
                t_abs = v["t"] + t_block
                env = np.clip(t_abs / max(1e-6, v["attack"]), 0.0, 1.0).astype(np.float32)

                depth_lfo = (0.5 * (1.0 + np.sin(2.0 * np.pi * v["vib_depth_hz"] * t_abs))).astype(np.float32)
                vib_cents_inst = (v["vib_depth_min"] + (v["vib_depth_max"] - v["vib_depth_min"]) * depth_lfo).astype(np.float32)

                vib = np.sin(2.0 * np.pi * v["vib_rate_hz"] * t_abs).astype(np.float32)
                freq_mul = (2.0 ** ((vib_cents_inst * vib) / 1200.0)).astype(np.float32)
                freq_inst = (v["freq_base"] * freq_mul).astype(np.float32)

                phase = v["phase"] + np.cumsum((2.0 * np.pi * freq_inst) * dt).astype(np.float32)

                s = (
                    v["h1"] * np.sin(phase) +
                    v["h2"] * np.sin(2.0 * phase) +
                    v["h3"] * np.sin(3.0 * phase)
                ).astype(np.float32)

                trem = np.sin(2.0 * np.pi * v["trem_hz"] * t_abs).astype(np.float32)
                amp = (1.0 - v["trem_depth"]) + v["trem_depth"] * (0.5 * (trem + 1.0))
                wave = s * env * amp * v["volume"]

                lg = math.cos(v["pan"] * math.pi * 0.5)
                rg = math.sin(v["pan"] * math.pi * 0.5)

                ambL += wave * lg
                ambR += wave * rg

                v["phase"] = float(phase[-1] % (2.0 * math.pi))
                v["t"] = float(t_abs[-1])

            # ---- PULSE render ----
            new_pulse = []
            for v in self.pulse_voices:
                t_abs = v["t"] + t_block
                dur = float(v["duration"])

                env = hann_env(t_abs, dur)

                vib = np.sin(2.0 * np.pi * v["vib_rate_hz"] * t_abs).astype(np.float32)
                freq_mul = (2.0 ** ((v["vib_cents"] * vib) / 1200.0)).astype(np.float32)
                freq_inst = (v["freq_base"] * freq_mul).astype(np.float32)

                phase = v["phase"] + np.cumsum((2.0 * np.pi * freq_inst) * dt).astype(np.float32)

                s = (
                    v["h1"] * np.sin(phase) +
                    v["h2"] * np.sin(2.0 * phase) +
                    v["h3"] * np.sin(3.0 * phase)
                ).astype(np.float32)

                trem = np.sin(2.0 * np.pi * v["trem_hz"] * t_abs).astype(np.float32)
                amp = (1.0 - v["trem_depth"]) + v["trem_depth"] * (0.5 * (trem + 1.0))

                wave = s * env * amp * v["volume"]

                # Anti-click: micro-fade sui primi 5ms
                micro_fade_samples = min(int(0.005 * self.sr), len(wave))
                if v["t"] < 0.005 and micro_fade_samples > 0:
                    for i in range(micro_fade_samples):
                        t_sample = v["t"] + (i * dt)
                        if t_sample < 0.005:
                            fade_mult = (t_sample / 0.005) ** 1.5
                            if i < len(wave):
                                wave[i] *= fade_mult

                wave = softclip(wave, drive=1.05)

                pulL += wave
                pulR += 0.995 * wave

                v["phase"] = float(phase[-1] % (2.0 * math.pi))
                v["t"] = float(t_abs[-1])

                if env[-1] > 1e-4:
                    new_pulse.append(v)

            self.pulse_voices = new_pulse[-self.max_pulse:]

        # master gain separato
        ambL *= self.master_gain
        ambR *= self.master_gain
        pulL *= self.master_gain
        pulR *= self.master_gain

        # riverbero SOLO sulle pulse
        pulL, pulR = self.pulse_reverb.process(pulL, pulR)

        bufL = ambL + pulL
        bufR = ambR + pulR

        # limiter
        peak = max(float(np.max(np.abs(bufL))), float(np.max(np.abs(bufR))))
        if peak > 1.0:
            bufL /= peak
            bufR /= peak

        outdata[:, 0] = np.clip(bufL, -1.0, 1.0)
        outdata[:, 1] = np.clip(bufR, -1.0, 1.0)

        # ✅ Invia dati DECIMATI per visualizzazione (solo canale L, 1 ogni 8 campioni)
        self.viz_counter += 1
        if self.viz_counter >= self.viz_decimation:
            self.viz_counter = 0
            viz_data = bufL[::8].astype(np.float32)  # Decimazione 8x (~256 campioni da 2048)
            try:
                self.viz_queue.put_nowait(viz_data.tobytes())
            except queue.Full:
                pass  # Skip se la queue è piena


# -----------------------------
# LOOP PLAYER
# -----------------------------
def loop_player_thread(synth):
    """Thread che riproduce i loop registrati"""
    runtime = []

    while True:
        now = time.time()
        with loops_lock:
            current_loops = list(loops)

        if len(runtime) != len(current_loops) or any(runtime[k]["loop_ref"] is not current_loops[k] for k in range(min(len(runtime), len(current_loops)))):
            runtime = []
            for lp in current_loops:
                if not lp["events"]:
                    continue
                runtime.append({
                    "loop_ref": lp,
                    "i": 0,
                    "t0": now,
                    "t_next": now + lp["events"][0][0]
                })

        soonest = None
        for st in runtime:
            lp = st["loop_ref"]
            if not lp["events"]:
                continue

            while now >= st["t_next"]:
                _, midi_note = lp["events"][st["i"]]
                synth.add_pulse_voice(midi_note)

                st["i"] += 1
                if st["i"] >= len(lp["events"]):
                    st["i"] = 0
                    st["t0"] += lp["dur"]

                st["t_next"] = st["t0"] + lp["events"][st["i"]][0]

            if soonest is None or st["t_next"] < soonest:
                soonest = st["t_next"]

        if soonest is None:
            time.sleep(0.01)
        else:
            time.sleep(max(0.001, min(0.02, soonest - time.time())))


# -----------------------------
# WEBSOCKET BROADCASTER
# -----------------------------
websocket_clients = set()
ws_clients_lock = threading.Lock()

async def websocket_handler(websocket):
    """Gestisce connessioni WebSocket per visualizzazione"""
    with ws_clients_lock:
        websocket_clients.add(websocket)

    print(f"[WS] Client connesso. Totale: {len(websocket_clients)}")

    try:
        # Rimani in ascolto (anche se non ci aspettiamo messaggi)
        async for message in websocket:
            pass
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        with ws_clients_lock:
            websocket_clients.discard(websocket)
        print(f"[WS] Client disconnesso. Totale: {len(websocket_clients)}")


async def viz_broadcaster(synth):
    """Invia dati di visualizzazione ai client WebSocket"""
    chunks_sent = 0

    while True:
        try:
            # Leggi dalla queue (con timeout)
            chunk = await asyncio.get_event_loop().run_in_executor(
                None, synth.viz_queue.get, True, 0.5
            )
        except queue.Empty:
            await asyncio.sleep(0.001)
            continue

        # Invia a tutti i client connessi
        with ws_clients_lock:
            clients = list(websocket_clients)

        if clients:
            for client in clients:
                try:
                    await asyncio.wait_for(client.send(chunk), timeout=0.2)
                except (asyncio.TimeoutError, Exception):
                    pass  # Ignora errori di invio

        chunks_sent += 1

        # Report ogni 500 chunk
        if chunks_sent % 500 == 0:
            queue_size = synth.viz_queue.qsize()
            print(f"[VIZ] Sent {chunks_sent} chunks | Queue: {queue_size}/50")


# -----------------------------
# HTTP SERVER (aiohttp)
# -----------------------------
async def handle_start(request):
    """POST /start - Avvia l'audio e invia 3 note di test"""
    global is_audio_playing

    with audio_state_lock:
        is_audio_playing = True

    # Invia 3 note di test per confermare che funziona
    synth = request.app['synth']
    synth.add_pulse_voice(60)  # C4
    await asyncio.sleep(0.3)
    synth.add_pulse_voice(64)  # E4
    await asyncio.sleep(0.3)
    synth.add_pulse_voice(67)  # G4

    print("[HTTP] ▶️  Audio START + note di test inviate")

    return web.json_response({
        'status': 'started',
        'message': 'Audio avviato sul PC (dovresti sentire 3 note di test!)'
    }, headers={'Access-Control-Allow-Origin': '*'})


async def handle_stop(request):
    """POST /stop - Ferma l'audio"""
    global is_audio_playing

    with audio_state_lock:
        is_audio_playing = False

    # Pulisci anche le voci attive
    synth = request.app['synth']
    synth.clear_ambient()
    synth.clear_pulse()

    print("[HTTP] ⏸️  Audio STOP")

    return web.json_response({
        'status': 'stopped',
        'message': 'Audio fermato'
    }, headers={'Access-Control-Allow-Origin': '*'})


async def handle_start_rec(request):
    """POST /start_rec - Inizia registrazione loop"""
    global is_recording, rec_start_t, rec_events

    with recording_lock:
        if not is_recording:
            is_recording = True
            rec_start_t = time.time()
            rec_events = []
            print("[HTTP] 🔴 Recording START")

    return web.json_response({
        'status': 'recording',
        'recording': True
    }, headers={'Access-Control-Allow-Origin': '*'})


async def handle_stop_rec(request):
    """POST /stop_rec - Ferma registrazione loop"""
    global is_recording, rec_start_t, rec_events

    with recording_lock:
        if is_recording:
            is_recording = False
            now = time.time()
            dur = max(0.05, now - rec_start_t)
            rec_events_sorted = sorted(rec_events, key=lambda x: x[0])
            loop = {"events": rec_events_sorted, "dur": dur}

            with loops_lock:
                loops.append(loop)
                if len(loops) > MAX_LOOPS:
                    loops.pop(0)

            print(f"[HTTP] ⏹️  Recording STOP → Loop salvato (dur={dur:.2f}s, eventi={len(rec_events_sorted)})")

    return web.json_response({
        'status': 'stopped',
        'recording': False
    }, headers={'Access-Control-Allow-Origin': '*'})


async def handle_clear_loops(request):
    """POST /clear_loops - Cancella tutti i loop"""
    with loops_lock:
        loops.clear()

    print("[HTTP] 🗑️  Loops cleared")

    return web.json_response({
        'status': 'loops_cleared'
    }, headers={'Access-Control-Allow-Origin': '*'})


async def handle_clear_ambient(request):
    """POST /clear_ambient - Cancella voci ambient"""
    synth = request.app['synth']
    synth.clear_ambient()

    print("[HTTP] 🗑️  Ambient cleared")

    return web.json_response({
        'status': 'ambient_cleared'
    }, headers={'Access-Control-Allow-Origin': '*'})


async def handle_options(request):
    """OPTIONS - CORS preflight"""
    return web.Response(
        headers={
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        }
    )


# -----------------------------
# SERIAL READER (Arduino)
# -----------------------------
async def serial_reader(synth):
    """Legge dati da Arduino e genera audio"""
    global is_recording, rec_start_t, rec_events

    PORTA = "COM5"
    BAUD = 9600

    AMB_BASE_ROOT = 36  # C2
    H_MIN = 200
    H_MAX = 400
    AMB_WINDOW_SEC = 20.0

    PULSE_BASE_ROOT = 24
    PULSE_SEMIS_MAX = 60
    PULSE_MIN_SEMIS_TO_PLAY = 12
    PULSE_COOLDOWN = 0.2

    try:
        ser = serial.Serial(PORTA, BAUD, timeout=1)
        print(f"✅ Connesso ad Arduino su {PORTA}")
    except Exception as e:
        print(f"⚠️  ERRORE: impossibile connettersi ad Arduino su {PORTA}")
        print(f"   {e}")
        print("   Il programma continuerà senza Arduino (solo per test WebSocket)")
        ser = None

    hum_samples = []
    amb_window_start = time.time()
    zero_semis_streak = 0
    amb_stopped_due_zero = False
    last_pulse_trig = 0.0

    try:
        while True:
            if ser:
                line = ser.readline().decode("utf-8", errors="ignore").strip()
                if not line or line.startswith("#"):
                    await asyncio.sleep(0.001)
                    continue

                parts = line.split(",")
                if len(parts) < 2:
                    await asyncio.sleep(0.001)
                    continue

                try:
                    hum_raw = int(parts[0])
                    bio_raw = int(parts[1])
                except:
                    await asyncio.sleep(0.001)
                    continue

                now = time.time()

                # ---- AMBIENCE (solo se audio è attivo) ----
                with audio_state_lock:
                    if is_audio_playing:
                        _, hum_semis_now = humidity_to_note(hum_raw, base_root=AMB_BASE_ROOT, h_min=H_MIN, h_max=H_MAX)

                        if hum_semis_now == 0:
                            zero_semis_streak += 1
                        else:
                            zero_semis_streak = 0
                            amb_stopped_due_zero = False

                        if zero_semis_streak >= 2:
                            if not amb_stopped_due_zero:
                                synth.clear_ambient()
                                hum_samples.clear()
                                amb_window_start = now
                                amb_stopped_due_zero = True
                        else:
                            hum_samples.append(hum_raw)

                            if (now - amb_window_start) >= AMB_WINDOW_SEC and hum_samples:
                                avg_h = sum(hum_samples) / len(hum_samples)
                                amb_midi, _ = humidity_to_note(avg_h, base_root=AMB_BASE_ROOT, h_min=H_MIN, h_max=H_MAX)
                                synth.add_ambient_voice_moving(amb_midi, volume=0.12, pan=0.5)
                                hum_samples.clear()
                                amb_window_start = now

                        # ---- PULSE (solo se audio è attivo) ----
                        _, pulse_semis_raw = midi_from_adc_semitones(bio_raw, base_root=PULSE_BASE_ROOT, semis_max=PULSE_SEMIS_MAX)
                        pulse_semis = quantize_to_major(pulse_semis_raw, PULSE_SEMIS_MAX)
                        pulse_midi = PULSE_BASE_ROOT + pulse_semis

                        if (pulse_semis >= PULSE_MIN_SEMIS_TO_PLAY) and ((now - last_pulse_trig) >= PULSE_COOLDOWN):
                            synth.add_pulse_voice(pulse_midi)
                            last_pulse_trig = now

                            with recording_lock:
                                if is_recording:
                                    rec_events.append((now - rec_start_t, pulse_midi))

            await asyncio.sleep(0.001)

    except KeyboardInterrupt:
        pass
    finally:
        if ser:
            ser.close()


# -----------------------------
# MAIN
# -----------------------------
async def main():
    global synth

    # Crea synth
    synth = CombinedSynth(max_ambient_voices=24, max_pulse_voices=24)
    synth.start()
    print("✅ Audio engine avviato (sounddevice)")

    # Avvia loop player
    threading.Thread(target=loop_player_thread, args=(synth,), daemon=True).start()
    print("✅ Loop player avviato")

    # Avvia WebSocket server
    ws_server = await websockets.serve(websocket_handler, "localhost", 8765)
    print("✅ WebSocket server avviato su ws://localhost:8765")

    # Avvia viz broadcaster
    asyncio.create_task(viz_broadcaster(synth))
    print("✅ Visualizzazione broadcaster avviato")

    # Configura HTTP server
    app = web.Application()
    app['synth'] = synth

    # Routes
    app.router.add_post('/start', handle_start)
    app.router.add_post('/stop', handle_stop)
    app.router.add_post('/start_rec', handle_start_rec)
    app.router.add_post('/stop_rec', handle_stop_rec)
    app.router.add_post('/clear_loops', handle_clear_loops)
    app.router.add_post('/clear_ambient', handle_clear_ambient)

    # CORS preflight
    app.router.add_options('/start', handle_options)
    app.router.add_options('/stop', handle_options)
    app.router.add_options('/start_rec', handle_options)
    app.router.add_options('/stop_rec', handle_options)
    app.router.add_options('/clear_loops', handle_options)
    app.router.add_options('/clear_ambient', handle_options)

    # Avvia HTTP server
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, 'localhost', 8080)
    await site.start()
    print("✅ HTTP server avviato su http://localhost:8080")

    print("\n🌱 LIVE PLANTING - Audio Controller")
    print("=" * 50)
    print("🔊 Audio: Casse del PC (sounddevice - HQ)")
    print("📡 Comandi: HTTP POST su localhost:8080")
    print("📊 Visualizzazione: WebSocket su localhost:8765")
    print(f"🎵 Max loops: {MAX_LOOPS}")
    print(f"🌿 Max ambient voices: 24")
    print("\n📋 Endpoints HTTP:")
    print("   POST /start        → Avvia audio + test")
    print("   POST /stop         → Ferma audio")
    print("   POST /start_rec    → Inizia recording")
    print("   POST /stop_rec     → Ferma recording")
    print("   POST /clear_loops  → Cancella loop")
    print("   POST /clear_ambient → Cancella ambient")
    print("\n⚠️  Premi Ctrl+C per uscire\n")

    # Avvia serial reader
    await serial_reader(synth)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Chiusura...")
        print("✅ Tutto chiuso. Arrivederci!")
