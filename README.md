# CoBeat

**A WeChat Mini Program for rhythm practice and musical improvisation**

## About the project

I developed CoBeat after leading Orff-inspired music activities with autistic children. In our in-person sessions, we practiced listening to and imitating rhythms, following changes in tempo, and responding to musical cues. But families also needed simple ways to continue these activities between lessons, without depending on a scheduled class or specialist.

CoBeat brings structured rhythm practice and open-ended music creation to a familiar, free platform. I wanted children to be able to practice at home while having room to experiment with sounds of their own.

## What the app does

**Rhythm training.** Children follow and reproduce rhythmic patterns through interactive tapping exercises. The app provides immediate feedback and records performance measures such as rhythmic accuracy and timing error. Difficulty can be adjusted to support different levels of experience.

**Musical improvisation.** A grid-based composition interface allows children to place and arrange notes, change their timing or pitch, and listen to their creations through playback. They can revise and save their work. Unlike the rhythm exercises, this module does not judge their musical choices as right or wrong.

**Designed for repeated use at home.** Feedback from parents and volunteers informed changes to activity length, difficulty levels, and the distinction between independent practice and caregiver-guided sessions.

## Development and iterations

I preserved both major versions and smaller revisions of the mini-program. The archive uses a simple naming convention:

- **A date alone** (for example, `0309`) identifies the main saved version for that date.
- **A date followed by a number in parentheses** (for example, `0309 (1)` or `0309 (2)`) identifies a smaller revision saved around that date. These include intermediate changes rather than separate major releases.

The saved development history includes **27 snapshots**:

| Date (MMDD) | Saved snapshots | Type |
| --- | --- | --- |
| February 12 | `0212` | Main version |
| February 28 | `0228 (1)`–`0228 (6)` | Minor revisions |
| March 3 | `0303` | Main version |
| March 9 | `0309 (1)`–`0309 (5)`; `0309` | Minor revisions and main version |
| March 19 | `0319 (1)`–`0319 (2)` | Minor revisions |
| April 10 | `0410 (1)`–`0410 (4)` | Minor revisions |
| April 14 | `0414 (1)`–`0414 (4)` | Minor revisions |
| April 26 | `0426` | Main version |
| April 28 | `0428` | Main version |
| April 30 | `0430` | Main version |

I kept the intermediate snapshots to make the development process visible, including changes made between the primary versions. The filenames indicate how I organized the archive; they do not, by themselves, establish the exact feature changes in each snapshot.

## Technical details

- **Platform:** WeChat Mini Program
- **Languages:** JavaScript, WXML, WXSS, and JSON
- **Key areas of the code:** Rhythm-training interface, musical improvisation interface, and supporting application pages

This repository shares development code, not participants' personal information or training records. Running an archived snapshot may require configuration in WeChat Developer Tools and access to services not included here.
