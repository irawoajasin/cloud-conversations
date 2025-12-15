# sever
from flask import Flask, request, jsonify
import pyttsx3 # tts
from flask_cors import CORS
import threading

# testing for audio out
#import os
#import platform
#import subprocess

# init flask 
app = Flask(__name__)
CORS(app)

engine = pyttsx3.init()


def speak(text, rate=150):
    def _speak():
        engine.setProperty('rate', rate)
        engine.say(text)
        engine.runAndWait()
    threading.Thread(target=_speak).start()

# post request (what is returned)
@app.route("/speak", methods=["POST"])
def speak_route():
    data = request.get_json()
    text = data.get("text", "")
    windSpeed = data.get("windSpeed", 8)

    print("\n--- RECEIVED TEXT ---")
    print(text[:200], "...")
    print("--- TEXT LENGTH:", len(text))

    rate = int(150 + (windSpeed * 5))

    #output_file = "output.wav"

    # saving voice to a file
    #engine.save_to_file(text, output_file)
    engine.say(text)
    engine.runAndWait()

    #speak(text, rate)

    # autoplay (will delete this later)
    #play_audio(output_file)
    #threading.Thread(target=tts_thread, args=(text, wind)).start()

    #return jsonify({"status": "ok", "file": output_file})
    return jsonify({'status': 'ok', 'rate': rate, 'text': text})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5002, threaded=True)