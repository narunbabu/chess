"""
Generate chess game sound effects using Google Gemini Lyria RealTime.
Generates short musical clips for: capture, castle, victory, defeat, game-start.
Then converts WAV → MP3 and places files in chess-frontend/src/assets/sounds/.

Duration guidelines:
  - Move actions (capture, castle): 0.3-0.8s — snappy, instant feedback
  - Game start: 1.5s — brief anticipation
  - Victory: 4s — celebratory with crowd cheers
  - Defeat: 4s — somber, distinctly different from victory
"""

import asyncio
import wave
import os
import time
import subprocess

from google import genai
from google.genai import types

API_KEY = "AIzaSyBa_bXKZvhfaVO2S6XwXLVREDX04wD8hU4"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "chess-frontend", "src", "assets", "sounds")
TEMP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp_sounds")

# Audio specs: 16-bit PCM, 48kHz, stereo
SAMPLE_RATE = 48000
CHANNELS = 2
SAMPLE_WIDTH = 2  # 16-bit = 2 bytes

client = genai.Client(
    api_key=API_KEY,
    http_options={"api_version": "v1alpha"},
)


async def generate_music(
    prompt_text: str,
    output_name: str,
    bpm: int = 120,
    temperature: float = 0.8,
    duration: int = 8,
):
    """Generate music with Lyria RealTime and save to WAV."""

    audio_chunks = []
    total_bytes = 0
    start_time = time.time()

    async def receive_audio(session):
        nonlocal total_bytes
        target_bytes = SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH * duration

        while total_bytes < target_bytes:
            try:
                async for message in session.receive():
                    sc = message.server_content
                    if sc and sc.audio_chunks:
                        for chunk in sc.audio_chunks:
                            audio_chunks.append(chunk.data)
                            total_bytes += len(chunk.data)
                            elapsed = time.time() - start_time
                            audio_secs = total_bytes / (SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH)
                            print(
                                f"\r  Receiving: {audio_secs:.1f}s / {duration}s "
                                f"({total_bytes/1024:.0f} KB, {elapsed:.0f}s elapsed)",
                                end="", flush=True,
                            )
                            if total_bytes >= target_bytes:
                                return
                    await asyncio.sleep(1e-6)
            except Exception as e:
                if "cancelled" in str(e).lower():
                    return
                raise

    print(f"\n{'='*60}")
    print(f"Generating: '{prompt_text}'")
    print(f"BPM: {bpm}, Temp: {temperature}, Duration: {duration}s")
    print(f"{'='*60}")

    try:
        async with (
            client.aio.live.music.connect(model="models/lyria-realtime-exp") as session,
            asyncio.TaskGroup() as tg,
        ):
            tg.create_task(receive_audio(session))

            await session.set_weighted_prompts(
                prompts=[
                    types.WeightedPrompt(text=prompt_text, weight=1.0),
                ]
            )
            await session.set_music_generation_config(
                config=types.LiveMusicGenerationConfig(
                    bpm=bpm,
                    temperature=temperature,
                )
            )

            await session.play()

            target_bytes = SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH * duration
            while total_bytes < target_bytes:
                await asyncio.sleep(0.5)

            await session.pause()

    except* Exception as eg:
        for e in eg.exceptions:
            if "cancelled" not in str(e).lower():
                print(f"\n  Error: {e}")

    print()

    if not audio_chunks:
        print("  No audio received!")
        return None

    # Combine and trim to exact duration
    all_audio = b"".join(audio_chunks)
    target_bytes = SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH * duration
    all_audio = all_audio[:target_bytes]

    # Save as WAV
    os.makedirs(TEMP_DIR, exist_ok=True)
    wav_path = os.path.join(TEMP_DIR, f"{output_name}.wav")
    with wave.open(wav_path, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(SAMPLE_WIDTH)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(all_audio)

    audio_duration = len(all_audio) / (SAMPLE_RATE * CHANNELS * SAMPLE_WIDTH)
    file_size = os.path.getsize(wav_path)
    print(f"  Saved: {wav_path}")
    print(f"  Duration: {audio_duration:.1f}s, Size: {file_size/1024:.1f} KB")
    return wav_path


def convert_wav_to_mp3(wav_path, mp3_path, trim_end=None, fade_out=None):
    """Convert WAV to MP3 using ffmpeg, optionally trimming and fading."""
    cmd = ["ffmpeg", "-y", "-i", wav_path]
    filters = []
    if trim_end:
        cmd += ["-t", str(trim_end)]
    if fade_out and trim_end:
        # Apply fade out over last portion
        fade_start = max(0, trim_end - fade_out)
        filters.append(f"afade=t=out:st={fade_start}:d={fade_out}")
    if filters:
        cmd += ["-af", ",".join(filters)]
    # Compress to small MP3: mono, 64kbps, 44.1kHz
    cmd += ["-ac", "1", "-ar", "44100", "-b:a", "64k", mp3_path]
    print(f"  Converting: {os.path.basename(wav_path)} → {os.path.basename(mp3_path)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ffmpeg error: {result.stderr[:200]}")
        return False
    size = os.path.getsize(mp3_path)
    print(f"  Output: {size/1024:.1f} KB")
    return True


# Chess sound effect definitions — revised durations and prompts
SOUNDS = [
    {
        "name": "capture",
        "prompt": "single sharp percussive orchestral hit, timpani slam with short brass accent, powerful quick impact sound, cinematic chess piece capture, no melody just one dramatic hit",
        "bpm": 140,
        "temperature": 0.6,
        "duration": 3,
        "trim": 0.6,
        "fade_out": 0.2,
    },
    {
        "name": "castle",
        "prompt": "quick two-note brass fanfare going up, medieval castle horn, regal majestic, short and snappy royal announcement, chess castling",
        "bpm": 120,
        "temperature": 0.6,
        "duration": 3,
        "trim": 0.8,
        "fade_out": 0.2,
    },
    {
        "name": "victory",
        "prompt": "triumphant orchestral victory celebration with crowd cheering and applause, brass fanfare with human voices shouting in joy, major key uplifting, stadium crowd roar mixed with orchestra, epic winning moment, glorious celebration",
        "bpm": 140,
        "temperature": 0.9,
        "duration": 8,
        "trim": 4.0,
        "fade_out": 1.0,
    },
    {
        "name": "defeat",
        "prompt": "sad melancholic solo piano descending notes with deep cello, disappointed sighing strings, minor key, slow heartbreaking melody, somber game over, lonely and sorrowful, deep bass undertone, completely different from victory music",
        "bpm": 60,
        "temperature": 0.9,
        "duration": 8,
        "trim": 4.0,
        "fade_out": 1.0,
    },
    {
        "name": "game-start",
        "prompt": "short exciting drum roll building to orchestral hit, anticipation rising, competitive chess match beginning, dramatic tension release, energetic",
        "bpm": 120,
        "temperature": 0.7,
        "duration": 4,
        "trim": 1.5,
        "fade_out": 0.3,
    },
]


async def main():
    print("Chess Sound Effect Generator (Lyria RealTime)")
    print("=" * 60)
    print(f"Output directory: {OUTPUT_DIR}")
    print(f"Sounds to generate: {len(SOUNDS)}")

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(TEMP_DIR, exist_ok=True)

    generated = []

    for sound in SOUNDS:
        wav_path = await generate_music(
            prompt_text=sound["prompt"],
            output_name=sound["name"],
            bpm=sound["bpm"],
            temperature=sound["temperature"],
            duration=sound["duration"],
        )

        if wav_path:
            mp3_path = os.path.join(OUTPUT_DIR, f"{sound['name']}.mp3")
            if convert_wav_to_mp3(
                wav_path, mp3_path,
                trim_end=sound.get("trim"),
                fade_out=sound.get("fade_out"),
            ):
                generated.append(sound["name"])

    print(f"\n{'='*60}")
    print(f"Generated {len(generated)}/{len(SOUNDS)} sounds:")
    for name in generated:
        mp3_path = os.path.join(OUTPUT_DIR, f"{name}.mp3")
        size = os.path.getsize(mp3_path) if os.path.exists(mp3_path) else 0
        # Get duration
        try:
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", mp3_path],
                capture_output=True, text=True
            )
            dur = float(result.stdout.strip())
        except:
            dur = 0
        print(f"  {name}.mp3 — {dur:.1f}s ({size/1024:.1f} KB)")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
