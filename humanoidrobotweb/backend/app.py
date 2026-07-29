from flask import Flask, jsonify, request, send_from_directory, session, g
from flask_cors import CORS
from functools import wraps
from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timezone
from werkzeug.utils import secure_filename
import json
import os
import time
import whisper

# google imports
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from dotenv import load_dotenv

load_dotenv()
GOOGLE_CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]
ADMIN_EMAILS = [
    e.strip().lower()
    for e in os.environ.get("ADMIN_EMAILS", "").split(",")
    if e.strip()
]

whisper_model = whisper.load_model("base")

app = Flask(__name__)
app.secret_key = os.environ["FLASK_SECRET_KEY"]
CORS(app)

# MongoDB connection
client = MongoClient("mongodb://localhost:27017/")
db = client["humanoidfarming"]
videos_collection = db["videos"]
pipeline1_collection = db["pipeline1"]
pipeline2_collection = db["pipeline2"]
comments_collection = db["comments"]
users_collection = db["users"]

# Data is included in the repo under backend/data/
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
TASKS_DIR = os.path.join(DATA_DIR, "tasks_with_timestamps")
PIPELINE2_DIR = os.path.join(DATA_DIR, "pipeline2_blocks")
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def load_data():
    """Load pipeline data into MongoDB if collections are empty."""

    # Load tasks_with_timestamps (videos + tasks + subtasks)
    if videos_collection.count_documents({}) == 0:
        count = 0
        for filename in os.listdir(TASKS_DIR):
            if filename.endswith(".json"):
                with open(os.path.join(TASKS_DIR, filename), "r") as f:
                    try:
                        data = json.load(f)
                        data["video_id"] = data.pop("index", filename.replace(".json", ""))
                        videos_collection.insert_one(data)
                        count += 1
                    except json.JSONDecodeError:
                        pass
        print(f"Loaded {count} videos into MongoDB.")
    else:
        print(f"Videos collection already has {videos_collection.count_documents({})} entries.")

    # Load pipeline2 blocks (missions / sub-missions)
    if pipeline2_collection.count_documents({}) == 0:
        count = 0
        for filename in os.listdir(PIPELINE2_DIR):
            if filename.endswith(".json"):
                with open(os.path.join(PIPELINE2_DIR, filename), "r") as f:
                    try:
                        data = json.load(f)
                        data["video_id"] = data.pop("index", filename.replace(".json", ""))
                        pipeline2_collection.insert_one(data)
                        count += 1
                    except json.JSONDecodeError:
                        pass
        print(f"Loaded {count} pipeline2 entries into MongoDB.")
    else:
        print(f"Pipeline2 collection already has {pipeline2_collection.count_documents({})} entries.")

def require_role(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            sub = session.get("sub")
            if not sub:
                return jsonify({"error": "Not logged in"}), 401
            user = users_collection.find_one({"sub": sub})
            if not user:
                return jsonify({"error": "Not logged in"}), 401
            
            if roles and user["role"] not in roles:
                return jsonify({"error": "Forbidden"}), 403
            g.current_user = user
            return fn(*args, **kwargs)
        return wrapper
    return decorator

@app.route("/api/auth/google", methods=["POST"])
def google_auth():
    token = request.json.get("credential")
    if not token:
        return jsonify({"error": "Missing credential"}), 400
    
    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID
        )
    except ValueError as e:
        print(f"Token verification failed: {e}")
        return jsonify({"error": "invalid token"}), 401
    
    sub = idinfo["sub"]
    email = idinfo["email"].lower()
    now = datetime.now(timezone.utc).isoformat()
    
    existing = users_collection.find_one({"sub": sub})
    
    if existing is None:
        # first time user
        role = "admin" if email in ADMIN_EMAILS else "user"
        users_collection.insert_one({
            "sub": sub,
            "email": email,
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
            "role": role,
            "created_at": now,
            "last_login": now
        })
    else:
        # returning user: refresh profile, don't update role
        users_collection.update_one(
            {"sub": sub},
            {"$set": {
                "email": email,
                "name": idinfo.get("name"),
                "picture": idinfo.get("picture"),
                "last_login": now,
            }}
        )
        
    user = users_collection.find_one({"sub": sub}, {"_id": 0})
    session["sub"] = sub
    session.permanent = True
    return jsonify(user)

@app.route("/api/auth/me", methods=["GET"])
def auth_me():
    sub = session.get("sub")
    if not sub:
        return jsonify({"user": None})
    return jsonify({"user":
        users_collection.find_one({"sub": sub}, {"_id": 0})})
    
@app.route("/api/auth/logout", methods=["POST"])
def auth_logout():
    session.clear()
    return jsonify({"ok": True})

@app.route("/api/videos", methods=["GET"])
def get_videos():
    """Return all videos with pipeline2 category data."""
    # Build a lookup of pipeline2 categories per video
    p2_lookup = {}
    for p2 in pipeline2_collection.find({}, {"_id": 0, "video_id": 1, "blocks": 1, "num_blocks": 1}):
        vid = p2.get("video_id")
        blocks = p2.get("blocks", [])
        # Get the most common dominant_category across blocks
        cat_counts = {}
        for block in blocks:
            cat = block.get("dominant_category", "unknown")
            cat_counts[cat] = cat_counts.get(cat, 0) + 1
        top_category = max(cat_counts, key=cat_counts.get) if cat_counts else "unknown"
        p2_lookup[vid] = {
            "category": top_category,
            "num_blocks": p2.get("num_blocks", len(blocks)),
        }

    videos = []
    for v in videos_collection.find({}, {"_id": 0, "video_id": 1, "title": 1, "url": 1, "tasks": 1}):
        vid = v.get("video_id")
        task_count = len(v.get("tasks", []))
        subtask_count = sum(len(t.get("subtasks", [])) for t in v.get("tasks", []))
        p2 = p2_lookup.get(vid, {})
        videos.append({
            "video_id": vid,
            "title": v.get("title", "Unknown Title"),
            "category": p2.get("category", "unknown"),
            "num_blocks": p2.get("num_blocks", 0),
            "url": v.get("url", ""),
            "task_count": task_count,
            "subtask_count": subtask_count,
        })
    return jsonify(videos)


@app.route("/api/videos/<video_id>", methods=["GET"])
def get_video(video_id):
    """Return a single video by ID with tasks and pipeline2 data."""
    video = videos_collection.find_one({"video_id": video_id}, {"_id": 0})
    if not video:
        return jsonify({"error": "Video not found"}), 404

    # include pipeline2 data for tree chart
    p2 = pipeline2_collection.find_one({"video_id": video_id}, {"_id": 0})
    if p2:
        video["mission_title"] = p2.get("mission_title", "")
        video["sub_missions"] = p2.get("sub_missions", [])
        video["blocks"] = p2.get("blocks", [])

    # include pipeline1 robot guidance data
    p1 = pipeline1_collection.find_one({"video_id": video_id}, {"_id": 0})
    if p1:
        video["pipeline1_tasks"] = p1.get("tasks", [])

    return jsonify(video)


@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Return dashboard statistics."""
    # Video count
    total_videos = videos_collection.count_documents({})

    # Task and subtask counts
    pipeline = videos_collection.aggregate([
        {"$project": {
            "task_count": {"$size": {"$ifNull": ["$tasks", []]}},
            "subtask_count": {"$sum": {
                "$map": {
                    "input": {"$ifNull": ["$tasks", []]},
                    "as": "task",
                    "in": {"$size": {"$ifNull": ["$$task.subtasks", []]}}
                }
            }}
        }},
        {"$group": {
            "_id": None,
            "total_tasks": {"$sum": "$task_count"},
            "total_subtasks": {"$sum": "$subtask_count"}
        }}
    ])
    task_stats = list(pipeline)
    total_tasks = task_stats[0]["total_tasks"] if task_stats else 0
    total_subtasks = task_stats[0]["total_subtasks"] if task_stats else 0

    # Mission and sub-mission counts from pipeline2
    p2_pipeline = pipeline2_collection.aggregate([
        {"$project": {
            "block_count": {"$size": {"$ifNull": ["$blocks", []]}},
            "sub_missions": {
                "$size": {
                    "$setUnion": {
                        "$map": {
                            "input": {"$ifNull": ["$blocks", []]},
                            "as": "block",
                            "in": {"$ifNull": ["$$block.sub_mission_id", "unknown"]}
                        }
                    }
                }
            }
        }},
        {"$group": {
            "_id": None,
            "total_blocks": {"$sum": "$block_count"},
            "total_sub_missions": {"$sum": "$sub_missions"}
        }}
    ])
    p2_stats = list(p2_pipeline)
    total_blocks = p2_stats[0]["total_blocks"] if p2_stats else 0
    total_sub_missions = p2_stats[0]["total_sub_missions"] if p2_stats else 0

    # Category distribution from pipeline2
    cat_pipeline = pipeline2_collection.aggregate([
        {"$unwind": "$blocks"},
        {"$group": {
            "_id": "$blocks.dominant_category",
            "count": {"$sum": 1}
        }},
        {"$sort": {"count": -1}}
    ])
    categories = {doc["_id"]: doc["count"] for doc in cat_pipeline if doc["_id"]}

    # Pipeline 1 stats
    p1_videos = pipeline1_collection.count_documents({})
    p1_pipeline = pipeline1_collection.aggregate([
        {"$project": {
            "task_count": {"$size": {"$ifNull": ["$tasks", []]}},
            "subtask_count": {"$sum": {
                "$map": {
                    "input": {"$ifNull": ["$tasks", []]},
                    "as": "task",
                    "in": {"$size": {"$ifNull": ["$$task.subtasks", []]}}
                }
            }},
            "frame_count": {"$sum": {
                "$map": {
                    "input": {"$ifNull": ["$tasks", []]},
                    "as": "task",
                    "in": {"$sum": {
                        "$map": {
                            "input": {"$ifNull": ["$$task.subtasks", []]},
                            "as": "sub",
                            "in": {"$size": {"$ifNull": ["$$sub.frames", []]}}
                        }
                    }}
                }
            }}
        }},
        {"$group": {
            "_id": None,
            "total_tasks": {"$sum": "$task_count"},
            "total_subtasks": {"$sum": "$subtask_count"},
            "total_frames": {"$sum": "$frame_count"}
        }}
    ])
    p1_stats = list(p1_pipeline)

    # Pipeline 1 action type distribution
    p1_action_counts = {"navigation": 0, "perception": 0, "manipulation": 0, "communication": 0, "verification": 0}
    for doc in pipeline1_collection.find({}, {"tasks": 1}):
        for task in doc.get("tasks", []):
            for sub in task.get("subtasks", []):
                steps = sub.get("guidance", {}).get("ordered_robot_action_steps", "")
                for atype in p1_action_counts:
                    p1_action_counts[atype] += steps.count(f"type={atype}")

    return jsonify({
        "total_videos": total_videos,
        "total_tasks": total_tasks,
        "total_subtasks": total_subtasks,
        "total_blocks": total_blocks,
        "total_sub_missions": total_sub_missions,
        "categories": categories,
        "pipeline1": {
            "total_videos": p1_videos,
            "total_tasks": p1_stats[0]["total_tasks"] if p1_stats else 0,
            "total_subtasks": p1_stats[0]["total_subtasks"] if p1_stats else 0,
            "total_frames": p1_stats[0]["total_frames"] if p1_stats else 0,
            "action_types": p1_action_counts,
        }
    })


@app.route("/api/videos/<video_id>/comments", methods=["GET"])
def get_comments(video_id):
    raw = comments_collection.find({"video_id": video_id}).sort("created_at", -1)
    comments = []
    for c in raw:
        c["id"] = str(c.pop("_id"))
        comments.append(c)
    return jsonify(comments)


@app.route("/api/videos/<video_id>/comments", methods=["POST"])
@require_role()
def add_comment(video_id):
    user = g.current_user
    text = request.form.get("text", "").strip()
    comment_type = request.form.get("type", "text")

    filename = None
    transcript = None
    if "file" in request.files:
        f = request.files["file"]
        ext = f.filename.rsplit(".", 1)[-1] if "." in f.filename else "webm"
        filename = f"{video_id}_{int(time.time())}.{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        f.save(filepath)

        try:
            result = whisper_model.transcribe(filepath)
            transcript = result.get("text", "").strip()
        except Exception as e:
            print(f"Whisper transcription failed: {e}")

    comment = {
        "video_id": video_id,
        "sub": user["sub"],
        "name": user.get("name") or user["email"],
        "picture": user.get("picture"),
        "role": user["role"],
        "text": text,
        "type": comment_type,
        "filename": filename,
        "transcript": transcript,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    comments_collection.insert_one(comment)
    comment["id"] = str(comment.pop("_id"))
    return jsonify(comment), 201


@app.route("/api/comments/<comment_id>", methods=["DELETE"])
@require_role()
def delete_comment(comment_id):
    comment = comments_collection.find_one({"_id": ObjectId(comment_id)})
    if not comment:
        return jsonify({"error": "Comment not found"}), 404

    # admins can delete anything, everyone else only their own
    user = g.current_user
    if user["role"] != "admin" and comment.get("sub") != user["sub"]:
        return jsonify({"error": "Forbidden"}), 403

    if comment.get("filename"):
        filepath = os.path.join(UPLOAD_DIR, comment["filename"])
        if os.path.exists(filepath):
            os.remove(filepath)
    comments_collection.delete_one({"_id": ObjectId(comment_id)})
    return jsonify({"deleted": True})


@app.route("/api/uploads/<filename>", methods=["GET"])
def serve_upload(filename):
    return send_from_directory(UPLOAD_DIR, secure_filename(filename))


if __name__ == "__main__":
    load_data()
    app.run(debug=True, port=5000)
