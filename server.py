"""Local YOLO detection bridge for LakeClean's two IP camera streams."""
from __future__ import annotations
import os, threading, time
from typing import Any
import cv2
import requests
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from ultralytics import YOLO

app = FastAPI(title="LakeClean YOLO bridge")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["*"])
CAMERAS = {"surface": os.getenv("SURFACE_STREAM_URL", ""), "underwater": os.getenv("UNDERWATER_STREAM_URL", "")}
MODEL_PATH = os.getenv("YOLO_MODEL", "yolo11n.pt")
if not os.path.isabs(MODEL_PATH):
    MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), MODEL_PATH)
try:
    model = YOLO(MODEL_PATH)  # downloads the small pretrained model on first run
    model_load_error = None
except Exception as exc:  # Let health checks explain a missing/broken model clearly.
    model = None
    model_load_error = str(exc)
lock = threading.Lock()

class CameraConfig(BaseModel):
    camera: str
    url: str

@app.post("/api/cameras/config")
def configure_camera(config: CameraConfig):
    if config.camera not in CAMERAS:
        raise HTTPException(400, "camera must be surface or underwater")
    if config.url and not config.url.startswith(("http://", "https://")):
        raise HTTPException(400, "Use a valid http:// or https:// camera stream URL")
    if config.url:
        # Confirm the backend itself can read a frame. A browser preview alone
        # does not prove that this Python process can reach the phone stream.
        frame = read_frame(config.url)
        if frame is None:
            raise HTTPException(503, "Camera preview opened in the browser, but the backend could not decode a frame. Use an MJPEG /video URL and confirm the phone and backend computer share Wi-Fi.")
    CAMERAS[config.camera] = config.url
    return {"ok": True, "camera": config.camera, "connected": bool(config.url)}

def read_mjpeg_frame(url: str):
    """Read one JPEG from an MJPEG multipart HTTP stream."""
    try:
        response = requests.get(url, stream=True, timeout=(4, 10))
        response.raise_for_status()
        content_type = response.headers.get("content-type", "")
        if "image/jpeg" in content_type and "multipart" not in content_type:
            data = response.content
            return cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
        buffer = bytearray()
        for chunk in response.iter_content(chunk_size=8192):
            buffer.extend(chunk)
            start = buffer.find(b"\xff\xd8")
            end = buffer.find(b"\xff\xd9", start + 2) if start >= 0 else -1
            if start >= 0 and end >= 0:
                return cv2.imdecode(np.frombuffer(bytes(buffer[start:end+2]), dtype=np.uint8), cv2.IMREAD_COLOR)
            if len(buffer) > 4_000_000:
                buffer = buffer[-1_000_000:]
        raise RuntimeError(f"No JPEG frame received (content-type: {content_type or 'missing'})")
    finally:
        if "response" in locals(): response.close()

def read_frame(url: str):
    # Most phone IP camera apps publish MJPEG over HTTP. Read that first with
    # a network timeout; opening a fresh OpenCV stream for every poll can stall.
    mjpeg_error = None
    try:
        frame = read_mjpeg_frame(url)
        if frame is not None:
            return frame
    except Exception as exc:
        mjpeg_error = exc
    cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
    try:
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        ok, frame = cap.read()
        if ok and frame is not None: return frame
    finally: cap.release()
    detail = mjpeg_error or "no decodable frame received"
    raise HTTPException(503, f"Could not read camera frame: {detail}. Check that the URL is an MJPEG /video stream reachable from the backend computer.")

def infer(url: str) -> list[dict[str, Any]]:
    if model is None:
        raise HTTPException(503, f"YOLO model is not ready: {model_load_error or 'model could not be loaded'}")
    if not url: raise HTTPException(503, "Camera URL is not configured. Press Connect in the dashboard to send it to the backend.")
    frame = read_frame(url)
    if frame is None: raise HTTPException(503, "Camera returned data that is not a decodable image. Try the app's MJPEG /video URL.")
    try:
        with lock:
            result = model.predict(frame, imgsz=640, conf=0.25, verbose=False)[0]
    except Exception as exc:
        raise HTTPException(503, f"YOLO inference failed: {exc}") from exc
    height, width = frame.shape[:2]
    detections = []
    for box in result.boxes:
        x1,y1,x2,y2 = (float(v) for v in box.xyxy[0].tolist())
        detections.append({"class": model.names[int(box.cls[0])], "confidence": float(box.conf[0]), "box": [x1/width,y1/height,(x2-x1)/width,(y2-y1)/height], "timestamp": time.time()})
    return detections

@app.get("/api/detections")
def detections(camera: str):
    if camera not in CAMERAS: raise HTTPException(400, "camera must be surface or underwater")
    return {"camera":camera,"detections":infer(CAMERAS[camera]),"depth_m":None,"depth_calibrated":False}

@app.get("/api/health")
def health(): return {"ok":True,"model":MODEL_PATH,"model_loaded":model is not None,"model_error":model_load_error,"cameras":{k:bool(v) for k,v in CAMERAS.items()}}

# Serve only the dashboard assets; do not expose the project folder or model files.
ROOT = os.path.dirname(os.path.abspath(__file__))
@app.get("/")
@app.get("/index.html")
def dashboard(): return FileResponse(os.path.join(ROOT, "index.html"))

@app.get("/app.js")
def dashboard_script(): return FileResponse(os.path.join(ROOT, "app.js"), media_type="application/javascript")

@app.get("/styles.css")
def dashboard_styles(): return FileResponse(os.path.join(ROOT, "styles.css"), media_type="text/css")
