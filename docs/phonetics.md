# Pronunciation notation

The practice cards show American-English learning transcriptions beside the Japanese meaning. The user's textbook screenshots guide the notation: slashes, acute vowel accents for primary stress, grave accents for secondary stress, /i u/ for the short vowels, /ei ou/ for diphthongs, and /əːr/ for the stressed rhotic vowel. Unicode combining accents are normalized to NFC; an IPA-capable serif font is used.

`dist/phonetics.js` contains a manually edited transcription for every active entry in Lessons 1–10. This is an instructional approximation in the observed notation, not a verbatim transcription of unseen textbook pages. Phrase entries show a clear citation reading, retain placeholder ellipses/A/B, and do not attempt to encode every connected-speech reduction or sentence-stress pattern. Proper names such as Japow are approximate. Entries match the app's singular/base forms; optional plural endings from the screenshots are omitted where the displayed word is singular.

The Japanese-meaning toggle only hides the translation. Pronunciation remains visible. Challenge prompts and the speech scoring algorithm are unchanged. The mapping is local and requires no dictionary API or network request at runtime.

Notation references checked during implementation:
- Sanseido, pronunciation and accent: https://dictionary.sanseido-publ.co.jp/vod/ac4_ej/data/ACE4_ws04.pdf
- Sanseido, pronunciation overview: https://dictionary.sanseido-publ.co.jp/vod/gcentury_ej4/

The exact notation and preferred variants should be reconciled with the textbook's pronunciation key if it becomes available.
