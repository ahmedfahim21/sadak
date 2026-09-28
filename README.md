<p align="center">
  <img src="game_engine/app/icon.png" alt="SADAK" width="56" height="56" />
</p>

<h1 align="center">SADAK</h1>

<p align="center">
  <b>Ten Indian cities. Nobody speaks English. Talk your way through.</b><br/>
  A voice-first 3D browser game where every NPC listens and replies in their own language.
</p>

<p align="center">
  <a href="https://playsadak.vercel.app"><b>Play now →</b></a>
</p>

<p align="center">
  <img src="game_engine/public/open-graph-img.jpg" alt="SADAK" width="100%" />
</p>

## About

SADAK drops you into real Indian neighbourhoods, rebuilt from OpenStreetMap, and gives you a job in each one: a stolen auto, a lost scooter, an errand at the local market. The only way through is to walk up to people and **speak to them** in Hindi, Tamil, Kannada, Bengali, Telugu, Malayalam, Marathi, Gujarati, Punjabi or Odia.

Every character is a live [Sarvam AI](https://www.sarvam.ai) voice agent with a persona, a mission rubric and a temper. Be polite and you get the clue. Offer the traffic constable a bribe and he throws you out. You leave each district knowing a few real sentences you didn't know before.

## Screenshots

<table>
  <tr>
    <td><img src="game_engine/public/covers/game/purani-sadak.jpg" alt="Chandni Chowk, Old Delhi" /></td>
    <td><img src="game_engine/public/covers/game/charminar-lane.jpg" alt="Charminar, Hyderabad" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Chandni Chowk, Old Delhi</sub></td>
    <td align="center"><sub>Charminar, Hyderabad</sub></td>
  </tr>
  <tr>
    <td><img src="game_engine/public/covers/game/dadar-chowk.jpg" alt="Dadar, Mumbai" /></td>
    <td><img src="game_engine/public/covers/game/fort-kochi-2.jpg" alt="Fort Kochi, Kochi" /></td>
  </tr>
  <tr>
    <td align="center"><sub>Dadar, Mumbai</sub></td>
    <td align="center"><sub>Fort Kochi, Kochi</sub></td>
  </tr>
</table>

<p align="center">
  <img src="docs/assets/dialogue-lesson-header.png" alt="A conversation with an NPC" width="80%" /><br/>
  <sub>Every line comes with script, romanisation and a gloss.</sub>
</p>

## Features

- **Talk, don't click.** Open-mic conversations over LiveKit, with push-to-talk as a fallback.
- **10 districts, 10 languages.** Each with its own characters, clue chain, phrasebook and city errand.
- **Missions judged by the model, not keywords.** A second call grades every turn against the mission's success criteria.
- **Characters with a line you shouldn't cross.** Rudeness, bribes and threats get you turned away, never bad grammar.
- **Real maps.** Street networks, landmarks and transit from OpenStreetMap, cel-shaded in three.js.

## How it works

```
mic → saaras:v4 (STT) → sarvam-105b (in-character reply) → bulbul:v3 (TTS) → audio + subtitles
                                  ↘ mission grading (separate call) ↗
```

| Part | Path | Stack |
| --- | --- | --- |
| Game | [`game_engine/`](game_engine/README.md) | Next.js, three.js, Supabase (auth + progress) |
| Voice worker | [`agent.py`](docs/VOICE_AGENT.md) | Python, LiveKit Agents, Sarvam STT / LLM / TTS |

## Quick start

**Prerequisites:** Node 18.18+, Python 3.10+, keys for [Sarvam AI](https://dashboard.sarvam.ai), [Supabase](https://supabase.com) and (for live voice) [LiveKit Cloud](https://cloud.livekit.io).

```bash
# 1. The game
cd game_engine
npm install
cp .env.example .env        # Sarvam, Supabase, LiveKit keys
npm run dev                 # http://localhost:3000

# 2. The NPC voice worker (optional, repo root, second terminal)
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # same LiveKit project + Sarvam key
python agent.py dev
```

Without the worker, or without LiveKit keys, conversations fall back to push-to-talk on their own. Supabase setup (migrations, auth redirect URLs) is in the [game README](game_engine/README.md); the worker's modes, wire protocol and troubleshooting are in [docs/VOICE_AGENT.md](docs/VOICE_AGENT.md).

## Docs

- [Game engine](game_engine/README.md): architecture, setup, design notes
- [Voice agent](docs/VOICE_AGENT.md): `agent.py` setup, run modes, what the game sends it
- [Deploy](docs/DEPLOY.md): Vercel and Supabase production setup
- [Handover](docs/HANDOVER.md): current state, latency measurements, logs

## Credits

Built by [ahmedfahim21](https://github.com/ahmedfahim21), [Parth Mittal](https://github.com/mittal-parth), Apoorva Agrawal, marcdhi and Mardav Gandhi.

- Speech, language and voices by [Sarvam AI](https://www.sarvam.ai): Saaras (STT), sarvam-105b (LLM), Bulbul (TTS).
- Real-time audio by [LiveKit](https://livekit.io).
- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors, available under the Open Database License (ODbL 1.0).
- The cel-shaded look is adapted from [sakura-crossing](https://github.com/Kenton-GMI/sakura-crossing) by Kenton Wang (MIT).
- Sibling to [kahani](https://github.com/harshagw/kahani), whose Sarvam TTS client is the basis for the one here.
