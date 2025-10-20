# Free BPM Tap Tool & Strudel Rhythm Generator

A free online BPM detector and rhythm generator that converts tapped beats into Strudel pattern sequences. Perfect for DJs, electronic music producers, and beat makers working in any environment.

## Features

- **BPM Detection**: Tap spacebar to detect tempo
- **Live Pattern Recording**: Tap rhythms with real-time visualization
- **Step Sequencer**: 16-step grid showing 8 measures (128 steps total)
- **Strudel Output**: Generates clean `[ bd ~ ~ ~ ]` style patterns
- **Pattern Rotation**: Align patterns with track timing using left/right arrows
- **Dark Theme**: Optimized for DJ booth environments
- **Visual Metronome**: Yellow highlight progresses through sequencer steps
- **Manual Editing**: Click cells to toggle beats on/off
- **Smart Sync**: Metronome and tap timing stay synchronized

## Usage

1. **Record BPM**: Click "Record BPM" and tap spacebar steadily to the beat
2. **Tap Rhythm**: Click "Tap rhythm" and tap your pattern (spacebar or touch)
3. **Adjust Timing**: Use ◀/▶ arrows to rotate pattern and align with track
4. **Copy Pattern**: Use the copy button to get your Strudel code

## Development

Run locally with any HTTP server:
```bash
python3 -m http.server 8000
# or
npx serve .
```

Then open http://localhost:8000

## Attribution

Originally inspired by "Cadence" by Kevin Kuo: https://github.com/imkevinkuo/imkevinkuo.github.io

This version has been substantially rewritten with new features including:
- Strudel pattern output format
- Real-time step sequencer visualization
- Pattern rotation capabilities
- Dark theme for DJ environments
- Enhanced metronome synchronization
- Live pattern editing
