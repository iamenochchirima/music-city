# Multi-format browser upload and playback check

Checked 29 October 2026 on `http://localhost:3000` with the `SOW2 QA Listener` Sandbox account and the isolated `sow2_current_demo_test` database.

I generated six short 44.1 kHz stereo sine-wave files locally: PCM WAV, MP3, FLAC, OGG/Vorbis, M4A/AAC, and standalone AAC. I selected them together in the normal release editor and created the draft `SOW2 codec verification EP 2026-10-29`. All six tracks attached to the release and displayed **Audio ready**. The Tracks page listed each as **Ready** with a play control.

I played each recording in the browser. For every format, the audio element reached `readyState: 4`, reported a duration of about eight seconds, entered playback without a media error, and used a local playback-session media URL. Browser console errors were empty. MP3, FLAC, OGG/Vorbis, M4A/AAC, and standalone AAC were paused well before five seconds. The WAV check crossed the five-second stream threshold before it was paused, so that test may have added one stream to the local QA database only.

The codec EP remains an unpublished local QA draft. No production account, production storage, or production release was changed. This verifies the browser upload, local storage, ready-state, and playback paths for these generated samples; it does not establish physical-device picker behavior, long-file limits, audio quality for customer masters, or production upload readiness.
