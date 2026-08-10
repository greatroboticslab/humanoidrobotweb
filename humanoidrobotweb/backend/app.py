from flask import Flask, jsonify, request, send_from_directory, session, g
from flask_cors import CORS
from functools import wraps
from pymongo import MongoClient
from bson import ObjectId
from bson.errors import InvalidId
from datetime import datetime, timedelta, timezone
from werkzeug.utils import secure_filename
import json
import os
import re
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

# the three roles the site knows about, least to most privileged
ROLES = ("user", "developer", "admin")

whisper_model = whisper.load_model("base")

app = Flask(__name__)
app.secret_key = os.environ["FLASK_SECRET_KEY"]
app.config.update(
    PERMANENT_SESSION_LIFETIME=timedelta(days=14),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    # only send the cookie over https once this is deployed behind tls
    SESSION_COOKIE_SECURE=os.environ.get("COOKIE_SECURE", "0") == "1",
)

# the session cookie has to ride along on cross-origin requests, which it only
# does when both the server allows credentials and the origin is explicit
CORS(
    app,
    supports_credentials=True,
    origins=[
        o.strip()
        for o in os.environ.get("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
        if o.strip()
    ],
)

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
    """Gate a route behind a login, and optionally behind specific roles."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            sub = session.get("sub")
            if not sub:
                return jsonify({"error": "Not logged in"}), 401
            user = users_collection.find_one({"sub": sub})
            if not user:
                # session points at a user that no longer exists
                session.clear()
                return jsonify({"error": "Not logged in"}), 401

            if roles and user.get("role", "user") not in roles:
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
        # returning user: refresh profile, keep whatever role they were given
        updates = {
            "email": email,
            "name": idinfo.get("name"),
            "picture": idinfo.get("picture"),
            "last_login": now,
        }
        # ADMIN_EMAILS is the bootstrap escape hatch: adding an address there
        # promotes that person on their next login even if they signed up first.
        # It never demotes anyone, so admins granted in the UI are safe.
        if email in ADMIN_EMAILS and existing.get("role") != "admin":
            updates["role"] = "admin"
        elif existing.get("role") not in ROLES:
            updates["role"] = "user"
        users_collection.update_one({"sub": sub}, {"$set": updates})


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


@app.route("/api/users", methods=["GET"])
@require_role("admin")
def list_users():
    """Every account, newest sign-in first. Admin only."""
    users = list(
        users_collection.find({}, {"_id": 0}).sort("last_login", -1)
    )
    for u in users:
        u.setdefault("role", "user")
    return jsonify(users)


@app.route("/api/users/<sub>/role", methods=["PATCH"])
@require_role("admin")
def set_user_role(sub):
    """Promote or demote an account. Admin only."""
    role = (request.json or {}).get("role")
    if role not in ROLES:
        return jsonify({"error": f"Role must be one of {', '.join(ROLES)}"}), 400

    target = users_collection.find_one({"sub": sub})
    if not target:
        return jsonify({"error": "User not found"}), 404

    # don't let the last admin strand the site with nobody who can manage roles
    if target.get("role") == "admin" and role != "admin":
        if users_collection.count_documents({"role": "admin"}) <= 1:
            return jsonify({"error": "Cannot demote the last admin"}), 400
        if target["sub"] == g.current_user["sub"]:
            return jsonify({"error": "You cannot demote yourself"}), 400

    users_collection.update_one({"sub": sub}, {"$set": {"role": role}})
    return jsonify(users_collection.find_one({"sub": sub}, {"_id": 0}))


# data query interface (admin + developer)

# task/subtask counts that several sources need, expressed over a "tasks" array
_TASK_COUNT = {"$size": {"$ifNull": ["$tasks", []]}}
_SUBTASK_COUNT = {
    "$sum": {
        "$map": {
            "input": {"$ifNull": ["$tasks", []]},
            "as": "t",
            "in": {"$size": {"$ifNull": ["$$t.subtasks", []]}},
        }
    }
}

QUERY_SOURCES = {
    "videos": {
        "label": "Videos — extracted tasks",
        "collection": "videos",
        "description": "One document per processed video, with its task/subtask tree.",
        "admin_only": False,
        "add_fields": {"task_count": _TASK_COUNT, "subtask_count": _SUBTASK_COUNT},
        "fields": {
            "video_id": {"type": "string", "label": "Video ID"},
            "title": {"type": "string", "label": "Title"},
            "task_count": {"type": "number", "label": "Tasks"},
            "subtask_count": {"type": "number", "label": "Subtasks"},
            "url": {"type": "string", "label": "URL"},
        },
        "columns": ["video_id", "title", "task_count", "subtask_count", "url"],
        "default_sort": "video_id",
    },
    "pipeline1": {
        "label": "Pipeline 1 — robot guidance",
        "collection": "pipeline1",
        "description": "Generated robot instructions, frames and success criteria.",
        "admin_only": False,
        "add_fields": {
            "task_count": _TASK_COUNT,
            "subtask_count": _SUBTASK_COUNT,
            "frame_count": {
                "$sum": {
                    "$map": {
                        "input": {"$ifNull": ["$tasks", []]},
                        "as": "t",
                        "in": {
                            "$sum": {
                                "$map": {
                                    "input": {"$ifNull": ["$$t.subtasks", []]},
                                    "as": "s",
                                    "in": {"$size": {"$ifNull": ["$$s.frames", []]}},
                                }
                            }
                        },
                    }
                }
            },
        },
        "fields": {
            "video_id": {"type": "string", "label": "Video ID"},
            "task_count": {"type": "number", "label": "Tasks"},
            "subtask_count": {"type": "number", "label": "Subtasks"},
            "frame_count": {"type": "number", "label": "Frames"},
        },
        "columns": ["video_id", "task_count", "subtask_count", "frame_count"],
        "default_sort": "video_id",
    },
    "pipeline2": {
        "label": "Pipeline 2 — missions & blocks",
        "collection": "pipeline2",
        "description": "Mission / sub-mission structure and the classified blocks.",
        "admin_only": False,
        "add_fields": {
            "block_count": {"$size": {"$ifNull": ["$blocks", []]}},
            "sub_mission_count": {"$size": {"$ifNull": ["$sub_missions", []]}},
            "categories": {
                "$setUnion": [
                    {
                        "$map": {
                            "input": {"$ifNull": ["$blocks", []]},
                            "as": "b",
                            "in": "$$b.dominant_category",
                        }
                    },
                    [],
                ]
            },
        },
        "fields": {
            "video_id": {"type": "string", "label": "Video ID"},
            "mission_title": {"type": "string", "label": "Mission"},
            "block_count": {"type": "number", "label": "Blocks"},
            "sub_mission_count": {"type": "number", "label": "Sub-missions"},
            "categories": {
                "type": "enum",
                "label": "Contains category",
                "options": ["narration", "planning", "perception", "motion"],
            },
        },
        "columns": [
            "video_id",
            "mission_title",
            "sub_mission_count",
            "block_count",
            "categories",
        ],
        "default_sort": "video_id",
    },
    "comments": {
        "label": "Comments — reviewer feedback",
        "collection": "comments",
        "description": "Text, audio, video and screen feedback left on videos.",
        "admin_only": False,
        "add_fields": {
            "has_media": {"$ne": [{"$ifNull": ["$filename", None]}, None]},
        },
        "fields": {
            "video_id": {"type": "string", "label": "Video ID"},
            "name": {"type": "string", "label": "Author"},
            "role": {"type": "enum", "label": "Author role", "options": list(ROLES)},
            "type": {
                "type": "enum",
                "label": "Type",
                "options": ["text", "audio", "video", "screen"],
            },
            "text": {"type": "string", "label": "Text"},
            "transcript": {"type": "string", "label": "Transcript"},
            "has_media": {"type": "boolean", "label": "Has recording"},
            "created_at": {"type": "date", "label": "Posted"},
        },
        "columns": [
            "created_at",
            "video_id",
            "name",
            "role",
            "type",
            "text",
            "transcript",
        ],
        "default_sort": "-created_at",
    },
    "users": {
        "label": "Users — accounts",
        "collection": "users",
        "description": "Signed-in accounts. Admin only, since it contains emails.",
        "admin_only": True,
        "add_fields": {},
        "fields": {
            "email": {"type": "string", "label": "Email"},
            "name": {"type": "string", "label": "Name"},
            "role": {"type": "enum", "label": "Role", "options": list(ROLES)},
            "created_at": {"type": "date", "label": "Joined"},
            "last_login": {"type": "date", "label": "Last login"},
        },
        "columns": ["name", "email", "role", "created_at", "last_login"],
        "default_sort": "-last_login",
    },
}

# which operators make sense for which field type
QUERY_OPERATORS = {
    "eq": {"label": "is", "types": ["string", "number", "enum", "boolean", "date"]},
    "ne": {"label": "is not", "types": ["string", "number", "enum", "boolean", "date"]},
    "contains": {"label": "contains", "types": ["string"]},
    "starts_with": {"label": "starts with", "types": ["string"]},
    "gt": {"label": "greater than", "types": ["number", "date"]},
    "gte": {"label": "at least", "types": ["number", "date"]},
    "lt": {"label": "less than", "types": ["number", "date"]},
    "lte": {"label": "at most", "types": ["number", "date"]},
    "in": {"label": "is any of", "types": ["string", "number", "enum"]},
    "exists": {"label": "is present", "types": ["string", "number", "enum", "date"]},
}

QUERY_MAX_LIMIT = 200


def _coerce(value, field_type):
    """Turn a JSON value from the client into something comparable in Mongo."""
    if field_type == "number":
        try:
            num = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"'{value}' is not a number")
        return int(num) if num.is_integer() else num
    if field_type == "boolean":
        if isinstance(value, bool):
            return value
        return str(value).strip().lower() in ("1", "true", "yes")
    # dates are stored as ISO-8601 strings, which compare correctly as strings
    return str(value)


def _build_match(source, filters):
    """Translate the filter list into a Mongo $match, or raise ValueError."""
    clauses = []
    for f in filters:
        name = f.get("field")
        op = f.get("op", "eq")
        spec = source["fields"].get(name)
        if spec is None:
            raise ValueError(f"Unknown field '{name}'")
        if op not in QUERY_OPERATORS:
            raise ValueError(f"Unknown operator '{op}'")
        if spec["type"] not in QUERY_OPERATORS[op]["types"]:
            raise ValueError(f"'{QUERY_OPERATORS[op]['label']}' does not apply to {name}")

        raw = f.get("value", "")

        if op == "exists":
            # "present" means the field is there and non-empty, not merely set
            want = _coerce(True if raw == "" else raw, "boolean")
            if want:
                clauses.append({name: {"$exists": True, "$nin": [None, ""]}})
            else:
                clauses.append({"$or": [
                    {name: {"$exists": False}},
                    {name: {"$in": [None, ""]}},
                ]})
        elif op in ("contains", "starts_with"):
            if raw == "":
                continue
            pattern = re.escape(str(raw))
            if op == "starts_with":
                pattern = "^" + pattern
            clauses.append({name: {"$regex": pattern, "$options": "i"}})
        elif op == "in":
            parts = raw if isinstance(raw, list) else str(raw).split(",")
            values = [_coerce(p.strip() if isinstance(p, str) else p, spec["type"])
                      for p in parts if str(p).strip() != ""]
            if not values:
                continue
            clauses.append({name: {"$in": values}})
        else:
            if raw == "" and spec["type"] != "boolean":
                continue
            clauses.append({name: {f"${op}": _coerce(raw, spec["type"])}})

    return clauses


@app.route("/api/query/schema", methods=["GET"])
@require_role("admin", "developer")
def query_schema():
    """Describe what can be queried, so the UI can build its dropdowns."""
    is_admin = g.current_user.get("role") == "admin"
    # a list, not a dict, so the UI keeps the order declared above rather than
    # whatever alphabetical order jsonify would impose
    sources = [
        {
            "key": key,
            "label": src["label"],
            "description": src["description"],
            "fields": src["fields"],
            "columns": src["columns"],
            "default_sort": src["default_sort"],
        }
        for key, src in QUERY_SOURCES.items()
        if is_admin or not src["admin_only"]
    ]
    return jsonify({
        "sources": sources,
        "operators": QUERY_OPERATORS,
        "max_limit": QUERY_MAX_LIMIT,
    })


@app.route("/api/query", methods=["POST"])
@require_role("admin", "developer")
def run_query():
    body = request.json or {}
    source = QUERY_SOURCES.get(body.get("source"))
    if source is None:
        return jsonify({"error": "Unknown data source"}), 400
    if source["admin_only"] and g.current_user.get("role") != "admin":
        return jsonify({"error": "Forbidden"}), 403

    filters = body.get("filters") or []
    if not isinstance(filters, list):
        return jsonify({"error": "filters must be a list"}), 400

    try:
        clauses = _build_match(source, filters)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    if clauses:
        combinator = "$or" if body.get("combinator") == "or" else "$and"
        match = {combinator: clauses}
    else:
        match = {}

    sort_field = body.get("sort") or source["default_sort"]
    direction = -1 if sort_field.startswith("-") else 1
    sort_field = sort_field.lstrip("-")
    if sort_field not in source["fields"]:
        return jsonify({"error": f"Cannot sort by '{sort_field}'"}), 400

    try:
        limit = min(int(body.get("limit", 50)), QUERY_MAX_LIMIT)
        skip = max(int(body.get("skip", 0)), 0)
    except (TypeError, ValueError):
        return jsonify({"error": "limit and skip must be numbers"}), 400
    limit = max(limit, 1)

    stages = []
    if source["add_fields"]:
        stages.append({"$addFields": source["add_fields"]})
    if match:
        stages.append({"$match": match})

    collection = db[source["collection"]]
    total = next(
        iter(collection.aggregate(stages + [{"$count": "n"}])), {"n": 0}
    )["n"]

    projection = {"_id": 0}
    projection.update({c: 1 for c in source["columns"]})
    rows = list(collection.aggregate(stages + [
        {"$sort": {sort_field: direction}},
        {"$skip": skip},
        {"$limit": limit},
        {"$project": projection},
    ]))

    return jsonify({
        "rows": rows,
        "columns": source["columns"],
        "fields": source["fields"],
        "total": total,
        "limit": limit,
        "skip": skip,
    })

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
    try:
        oid = ObjectId(comment_id)
    except (InvalidId, TypeError):
        return jsonify({"error": "Comment not found"}), 404

    comment = comments_collection.find_one({"_id": oid})
    if not comment:
        return jsonify({"error": "Comment not found"}), 404

    # admins can delete anything, everyone else only their own
    user = g.current_user
    if user.get("role") != "admin" and comment.get("sub") != user["sub"]:
        return jsonify({"error": "Forbidden"}), 403

    if comment.get("filename"):
        filepath = os.path.join(UPLOAD_DIR, comment["filename"])
        if os.path.exists(filepath):
            os.remove(filepath)
    comments_collection.delete_one({"_id": oid})
    return jsonify({"deleted": True})


@app.route("/api/uploads/<filename>", methods=["GET"])
def serve_upload(filename):
    return send_from_directory(UPLOAD_DIR, secure_filename(filename))


if __name__ == "__main__":
    load_data()
    app.run(debug=True, port=5000)
