"""One-click local launcher for LakeClean dashboard + YOLO backend."""
import threading
import time
import webbrowser
import requests
import uvicorn

URL = "http://127.0.0.1:8001/"

def run_server():
    uvicorn.run("server:app", host="127.0.0.1", port=8001, log_level="info")

thread = threading.Thread(target=run_server, daemon=True)
thread.start()
for _ in range(180):
    try:
        if requests.get("http://127.0.0.1:8001/api/health", timeout=1).ok:
            webbrowser.open(URL)
            break
    except requests.RequestException:
        pass
    time.sleep(1)
else:
    raise SystemExit("LakeClean did not become ready. Review the startup error above.")
print("LakeClean is open. Keep this window running; close it to stop the local backend.")
thread.join()
