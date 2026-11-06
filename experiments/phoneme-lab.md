# Free acoustic phoneme experiment — 2026-11-06

The deployed experiment is `dist/phoneme-lab.html`. It is an optional, independent two-word comparison page. Existing word-recognition scores, certificates and histories are not modified.

## Method

hama-js 1.7.0 runs its unmodified 4.7 MB waveform acoustic model in a browser Web Worker. It outputs phoneme tokens directly, without a word grammar or expected-answer prompt. `comparePhones` compares these tokens against fixed American English target phones using token edit distance. It returns a reference similarity, not a calibrated pronunciation assessment. A complete phoneme match is required for 100%. No katakana-classification claim is made.

The upstream package's JSON imports are inlined for browser modules. Its acoustic weights are unchanged. Immutable model and WASM data are retained in same-origin Cache Storage when available; absence or eviction leads to another fetch. Total extra package transfer is about 5 MB. This does not depend on the existing Vosk 45 MB data.

## Initial synthetic-audio probe

Audio was synthesized locally using the installed macOS Samantha English and Kyoko Japanese voices, mono 16 kHz PCM WAV. These are synthetic examples, not student recordings. Browser AudioContext decoding/resampling and the actual Web Worker model were used.

| Word | English example | Japanese katakana example |
|---|---|---|
| sunglasses | `s ʌ ŋ g l æ s ɪ s` — 89% | `s ʌ m g ʊ d u s` — 33% |
| millimeter | `n o l ə m i t ɝ` — 75% | `m i d i m eɪ n θ ɔ d͡ʒ ə` — 18% |

The phoneme output visibly differs for these examples, so a free sound-based comparison is feasible to prototype. The English output also contains errors (`s` versus final `z`; `n o` versus initial `m ɪ`). This is evidence against deploying the raw reference percentages as official scores. No claim about human accents, children, iPad hardware or classroom noise is justified by these four synthetic samples.

A second browser fixture streamed these sample files through a MediaStreamDestination into the real microphone capture pipeline (without accessing the physical microphone). Four-second capture, waveform, automatic stop, worker inference and track/context cleanup were exercised. The English sunglasses stream yielded 100%; the Japanese stream yielded 33%. Repeated capture released both streams. The difference between the English file-only 89% and streamed 100% also shows sensitivity to framing/resampling/silence and is another reason not to treat these numbers as validated scores.

## Runtime and testing

- All inference is on the device; no recorded audio upload or per-call API charge.
- Each iPad still needs enough compute and memory. Fifty devices have no central inference queue, but initial downloads and microphone pickup in a classroom require real-world testing.
- User microphone capture uses a single stream for waveform and phoneme analysis, stops at four seconds or on request, and closes tracks/context on stop, error, navigation or backgrounding.
- This model is not trained or calibrated here to label a pronunciation as “katakana.” A phoneme mismatch can also be a model error. Human validation across different voices is needed before altering the main app's scores.

Sources: https://hamanlp.org/docs/apis/ and https://github.com/hamanlp/hama . License and exact npm source identity are in `dist/vendor/hama-1.7.0/NOTICE.txt`.
