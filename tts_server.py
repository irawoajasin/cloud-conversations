from flask import Flask, request, jsonify
from flask_cors import CORS
import subprocess
import threading

app = Flask(__name__)
CORS(app)

current_process = None
process_lock = threading.Lock()

def speak_macos(text, rate):
    global current_process

    mac_rate = int(rate)

    with process_lock:
        if current_process is not None:
            current_process.terminate()
            current_process = None

        current_process = subprocess.Popen(
            ["say", f"-r", str(mac_rate), text]
        )


@app.route("/speak", methods=["POST"])
def speak_route():
    data = request.get_json()
    text = data.get("text", "")
    windSpeed = float(data.get("windSpeed", 8))

    # map wind speed to speaking rate
    rate = 150 + (windSpeed * 5)

    print("\n--- NEW SPEAK REQUEST ---")
    print(text[:200], "...")

    # play the audio
    threading.Thread(target=speak_macos, args=(text, rate), daemon=True).start()

    return jsonify({"status": "speaking", "rate": rate})


if __name__ == "__main__":
    app.run(port=5002, threaded=True)
