# FTT Poomsae Scoring System

This project includes the Operator + Public Display workflow and the Remote Judges QR scoring interface.

## Remote Judges QR

- The number of Judge QR codes follows `judgeCount` from Competition Setup.
- Operator: **JUDGES QR** opens the QR management window.
- Each Judge QR is unique and can be changed or deleted independently.
- Each judge scans their QR on a phone and receives a dedicated scoring screen.
- Accuracy starts at **4.0** and supports `-0.3`, `-0.1`, `+0.1`, `+0.3`.
- Presentation has three parameters:
  - Speed & Power
  - Rhythm & Tempo
  - Expression of Energy
- Each presentation parameter is selectable from **0.5 to 2.0** in 0.1 steps.
- Presentation = sum of the three parameters.
- The judge sends Accuracy + Presentation to the Operator.
- The Operator sees connection/score status and uses **SHOW RESULTS** when all required scores are received.

## Hosting requirement

Remote phone-to-PC communication uses PeerJS/WebRTC signaling and therefore requires internet access. The application should be served through **HTTPS** (GitHub Pages or Netlify are suitable). Do not open `index.html` directly with `file://` when using Judge QR.

The public display continues to use the existing local synchronization workflow.
