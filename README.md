# LakeClean student prototype

The dashboard has separate surface and underwater IP camera panels. The optional Python backend reads each configured camera stream and runs Ultralytics YOLO inference. Demo boxes are simulated and are labeled as demo data.

## Run the full app on this computer

1. Install Python 3.12 and create/install the `.venv` once, if it is not already set up.
2. Double-click **Start LakeClean Backend.bat**. It launches the dashboard and backend together and opens `http://127.0.0.1:8001/` when ready. Leave its window open.
3. Put the two phones and this computer on the same Wi-Fi. Start each phone’s IP camera app.
4. In the dashboard, leave the backend URL as `http://127.0.0.1:8001`. Enter each phone’s HTTP MJPEG stream URL and select **Connect**. The backend checks it can read a frame before accepting the camera.
5. Uncheck **Demo detections** to show only real YOLO output. The starter `yolo11n.pt` is a general-purpose model; it may detect common objects but it is not trained specifically to identify lake litter. A waste-trained weights file can be selected with the `YOLO_MODEL` environment variable.

If Python dependencies still need installing, open PowerShell in this folder once and run:

```powershell
uv pip install --python .venv\Scripts\python.exe -r requirements.txt
```

The startup batch file does not install packages; it starts the already installed backend. The model file must be present locally or downloadable on first startup.

## GitHub Pages demo

GitHub Pages serves the static dashboard only; it cannot start Python or run YOLO. The dashboard now has an **Inference backend connection** section. For a Pages demo, put a publicly reachable HTTPS backend address there, save it, then connect cameras.

For phone cameras on your private Wi-Fi, run the backend on a computer on that same Wi-Fi and expose that computer’s port 8001 through a secure tunnel. The backend—not the GitHub browser page—must be able to access the phone stream URLs. Keep the backend computer and tunnel running for the duration of the demo. A public backend deployment on another network cannot access private phone IP addresses such as `192.168.x.x`.

This project includes **Start LakeClean Public Backend.bat** for a temporary Cloudflare Quick Tunnel. Install `cloudflared` once, then double-click that batch file. It opens the local backend and prints a temporary HTTPS URL. Copy that URL (without any path after the hostname) into **Inference backend connection** on the GitHub Pages dashboard and save it. Keep both command windows open while presenting. The temporary URL changes when the tunnel restarts.

Treat a public tunnel as access to your computer. Use it only for a short demo, avoid sharing the URL, and stop the tunnel afterward. For a permanent public deployment, add access controls and host the inference service near the camera network.

## Camera stream notes

- The phone camera app must provide an HTTP MJPEG `/video` endpoint (or another format supported by OpenCV). Some apps show video in a browser but block server-side access, require authentication, or use HLS/WebRTC instead; those formats need a compatible backend reader.
- A green browser preview only confirms the browser can display the feed. The dashboard also asks the backend to decode a frame before it marks the stream registered for inference. If that check fails, check the camera app’s actual stream URL, Wi-Fi isolation, and phone permissions.
- HTTP streams can be blocked when the page uses HTTPS. If the browser cannot display the stream, use HTTPS for the stream or run the local dashboard. Browser camera preview may also be blocked by camera CORS policy; backend inference can still work when the backend can read the stream.
- Do not submerge a Wi-Fi phone. Radio does not travel reliably through water. Keep it above water in a waterproof mount pointed below the surface, or use a tethered underwater camera.

## API and depth

- `GET /api/health` reports the model load status and configured cameras.
- `POST /api/cameras/config` registers or disconnects a camera and verifies that the backend can decode a frame.
- `GET /api/detections?camera=surface` and `?camera=underwater` return normalized bounding boxes `[x, y, width, height]`, class names and confidence.
- Underwater depth stays unavailable unless calibrated measurement data is provided. A single uncalibrated camera cannot reliably provide metric depth.

The backend binds to `127.0.0.1:8001` for local use. `yolo11n.pt` is a generic COCO model, so it can label objects such as bottles but may also label unrelated common objects. Reliable litter identification requires waste-trained model weights.
