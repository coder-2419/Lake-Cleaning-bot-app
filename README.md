# LakeClean AI dashboard demo

A responsive, browser-only frontend prototype for the LakeClean AI lake-cleaning robot dashboard. All telemetry, camera views, detections, maps, water readings, docking, and emergency-input status are simulated. There is no backend or hardware connection.

## Run locally

Open `index.html` in a modern browser. No dependencies, install, or build step is required. For a local server, run `python -m http.server 8000` from this folder and visit `http://localhost:8000`.

## Interactions

- Switch between Overview, Missions, Analytics, and System using the sidebar or mobile bottom navigation.
- Change surface/underwater views and maps, operating modes, and onboard controls.
- Pause, resume, end, or create a simulated mission; dismiss the conveyor alert.
- Sensor values drift slightly while a mission is running.

The external DC emergency input is shown as on standby. Its intended location is the outer side of the right pontoon, above the waterline; the UI status does not imply a physical connection.