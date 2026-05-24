from flask import Flask, jsonify
from flask_cors import CORS
from pymongo import MongoClient
import json
import os

app = Flask(__name__)
CORS(app)

# MongoDB connection
client = MongoClient("mongodb://localhost:27017/")
db = client["humanoidfarming"]
videos_collection = db["videos"]


def load_sample_data():
    """Load sample JSON files into MongoDB if the collection is empty."""
    if videos_collection.count_documents({}) == 0:
        data_dir = os.path.join(os.path.dirname(__file__), "data")
        for filename in os.listdir(data_dir):
            if filename.endswith(".json"):
                with open(os.path.join(data_dir, filename), "r") as f:
                    video_data = json.load(f)
                    # Rename 'index' to 'video_id' for clarity
                    video_data["video_id"] = video_data.pop("index", filename.replace(".json", ""))
                    videos_collection.insert_one(video_data)
        print(f"Loaded {videos_collection.count_documents({})} videos into MongoDB.")
    else:
        print(f"MongoDB already has {videos_collection.count_documents({})} videos.")


@app.route("/api/videos", methods=["GET"])
def get_videos():
    """Return all videos."""
    videos = list(videos_collection.find({}, {"_id": 0}))
    return jsonify(videos)


@app.route("/api/videos/<video_id>", methods=["GET"])
def get_video(video_id):
    """Return a single video by ID."""
    video = videos_collection.find_one({"video_id": video_id}, {"_id": 0})
    if video:
        return jsonify(video)
    return jsonify({"error": "Video not found"}), 404


if __name__ == "__main__":
    load_sample_data()
    app.run(debug=True, port=5000)
