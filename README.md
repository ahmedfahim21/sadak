<p align="center">
  <img src="game_engine/public/open-graph-img.jpg" alt="SADAK" width="100%" />
</p>

<h1 align="center">SADAK</h1>

<p align="center">
  <b>Learn an Indian language by talking your way through its streets.</b><br />
  A voice-first 3D browser game where every NPC speaks, listens and replies only in their own language.
</p>

<p align="center">
  <a href="https://playsadak.vercel.app"><b>▶ Play now</b></a> ·
  <a href="game_engine/README.md">Game design</a> ·
  <a href="docs/VOICE_AGENT.md">Voice agent</a> ·
  <a href="docs/DEPLOY.md">Deploy</a>
</p>

---

## What it is

Ten districts across India, ten languages, and nobody speaks English. Walk up to a chaiwala, an auto driver or a havaldar, open your mic and *talk*. The conversation is the gameplay: finish errands, collect clues, and recover what was stolen.

- **Live voice NPCs** — each character is a Sarvam-powered persona holding a real-time conversation over LiveKit, with subtitles as they speak.
- **10 cities, 10 languages** — Hindi, Tamil, Kannada, Bengali, Telugu, Malayalam, Marathi, Gujarati, Punjabi and Odia.
- **Graded by meaning, not keywords** — an LLM judges whether you actually met each mission. Be rude or offer a bribe and your wanted level climbs.
- **Guided lessons** — native script, romanisation and a gloss for every line, word-level pronunciation feedback, and a phrasebook per district.
- **Learn from any language** — read instructions in English or any of the ten Indic languages.
- **Procedural world** — the whole city is generated in code with three.js; plays on desktop and mobile.

## Screenshots

<p align="center">
  <img src="docs/assets/dialogue-lesson-header.png" alt="Lesson dialogue with Vikram the kachori wallah" width="80%" />
</p>

<table>
  <tr>
    <td><img src="game_engine/public/covers/purani-sadak.png" alt="Purani Sadak, Delhi" /></td>
    <td><img src="game_engine/public/covers/marina-nagar.png" alt="Marina Nagar, Chennai" /></td>
    <td><img src="game_engine/public/covers/fort-kochi.jpg" alt="Fort Kochi, Kochi" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Purani Sadak · Delhi · Hindi</sub></td>
    <td align="center"><sub>Marina Nagar · Chennai · Tamil</sub></td>
    <td align="center"><sub>Fort Kochi · Kochi · Malayalam</sub></td>
  </tr>
</table>

## How it works

```
mic → saaras:v3 (STT) → sarvam-105b (in-character reply) → bulbul:v3 (TTS) → audio + subtitles
                                  ↘ mission + anger grading (separate call) ↗
```

The Next.js game in [`game_engine/`](game_engine) mints a LiveKit token carrying the NPC's persona, voice and mission rubric. The Python worker [`agent.py`](agent.py) joins the room and plays that character. If LiveKit is unavailable, the game falls back to push-to-talk over REST automatically.

## Quick start

```bash
# 1. The game
cd game_engine
npm install
cp .env.example .env        # Sarvam, Supabase and (optionally) LiveKit keys
npm run dev                 # http://localhost:3000

# 2. Live voice (optional, second terminal, repo root)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # LiveKit + Sarvam keys
python agent.py dev
```

Supabase needs a one-time setup for auth and district data. See the [game README](game_engine/README.md#setup).

## Tech stack

Next.js · React · three.js · Tailwind · Supabase · LiveKit Agents · Sarvam AI · PostHog · Vercel

## Credits

Built for the **Sarvam Epoch Buildathon** by

- [Ahmed Fahim](https://github.com/ahmedfahim21)
- [Parth Mittal](https://github.com/mittal-parth)
- [Mardav Gandhi](https://github.com/marcdhi)
- [Apoorva Agrawal](https://github.com/imApoorva36)

Powered by [Sarvam AI](https://www.sarvam.ai) (`saaras:v3`, `sarvam-105b`, `bulbul:v3`) and [LiveKit](https://livekit.io). Rendered with [three.js](https://threejs.org), Indic text set in [Noto Sans](https://fonts.google.com/noto). The Sarvam TTS client started life in our sibling project [kahani](https://github.com/harshagw/kahani).
