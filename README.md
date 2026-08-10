# Humanoid Farming Web

A web interface for the Humanoid Farming Pipeline — a research project at Middle Tennessee State University focused on converting farming demonstration videos into structured, robot-usable task sequences through multimodal AI.

<img width="1470" height="810" alt="image" src="https://github.com/user-attachments/assets/869bcbe8-870c-4217-83b1-140840fe67ef" />
<img width="1470" height="810" alt="image" src="https://github.com/user-attachments/assets/4d44aadd-15d2-44c3-b51a-592d7d433c91" />
<img width="1470" height="810" alt="image" src="https://github.com/user-attachments/assets/a34e93dc-6ada-4dbd-81a8-389f995657b6" />
<img width="1470" height="810" alt="image" src="https://github.com/user-attachments/assets/f64cfe64-ffa0-406c-8dd7-733ecb650a8e" />
<img width="1470" height="810" alt="image" src="https://github.com/user-attachments/assets/3424f966-33f3-4e11-9af9-1f9d4ed31704" />
<img width="1470" height="810" alt="image" src="https://github.com/user-attachments/assets/7e76ab3a-0a42-429a-b51e-3804db6798f7" />
<img width="1470" height="810" alt="image" src="https://github.com/user-attachments/assets/daf9e29e-7a3d-40d1-a94d-9498235ded64" />

## Tech Stack

- **Frontend:** React
- **Backend:** Python (Flask)
- **Database:** MongoDB

## Project Structure

```
src/
  components/
    Navbar.jsx            # Navigation bar, with the auth area and internal links
    Footer.jsx            # Page footer
    GoogleSignInButton.jsx # Renders Google's button and hands the credential to AuthContext
    RequireRole.jsx       # Route guard for the role-gated pages
  context/
    AuthContext.jsx       # Session state, login/logout, role helpers
  pages/
    Home.jsx              # Homepage with stats, Pipeline 1 and Pipeline 2 charts
    Dataset.jsx           # Searchable/filterable video grid with pagination
    VideoDetail.jsx       # Video detail with mission tree, task tree, and robot guidance
    Query.jsx             # Data query interface (developer + admin)
    Admin.jsx             # User management (admin)
  styles/
    variables.css         # Global CSS variables (MTSU colors)

backend/
  app.py                  # Flask API server
  mongo_transfer.sh       # MongoDB export/import script for transferring between machines
  requirements.txt        # Python dependencies
  data/
    tasks_with_timestamps/   # 567 video task files
    pipeline2_blocks/        # 527 pipeline2 structured data files
  uploads/                # Comment recordings (gitignored, created on first run)
```

## Comments and Human Review

Signed-in users can leave feedback on any video to flag errors in the
AI-extracted data. A comment can be text, or a recording made in the browser via
the MediaRecorder API in one of three modes:

- **Audio** — microphone only
- **Video** — webcam and microphone
- **Screen** — a shared screen or window with narration, with a floating
  recording bar so the page can be navigated while recording

Recordings are saved to `backend/uploads/` and transcribed automatically with
Whisper (`base` model), and the transcript is stored alongside the comment so
recorded feedback is searchable from the query interface.

## Setup

### Prerequisites

- Node.js
- Python 3
- MongoDB
- **ffmpeg** — required by Whisper to transcribe comment recordings

```bash
brew install ffmpeg
```

### Google OAuth client

Sign-in needs an OAuth client before either server will start.

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. Under **APIs & Services → OAuth consent screen**, choose **External**, fill in the app name and support email, and add every address that should be able to sign in under **Test users** (Testing mode allows up to 100)
3. Under **Credentials**, create an **OAuth client ID** of type **Web application**
4. Add each origin the site is served from to **Authorized JavaScript origins**, with no trailing slash:
   - `http://localhost:3000` for local development
   - the https URL of any tunnel or deployment
5. Leave **Authorized redirect URIs** empty — Google Identity Services returns the token to a JavaScript callback rather than a redirect
6. Copy the Client ID into both `.env` files (see [Environment variables](#environment-variables))

Origin changes can take a few minutes to propagate on Google's side.

### Frontend

```bash
npm install
npm start
```

Runs at [http://localhost:3000](http://localhost:3000)

### Backend

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Runs at [http://localhost:5000](http://localhost:5000)

### MongoDB

Make sure MongoDB is running locally:

```bash
brew services start mongodb-community
```

The backend automatically loads all pipeline data (567 videos, 527 pipeline2 blocks) into MongoDB on first run.

To reload the data from scratch, drop the collections first:

```bash
mongosh --eval 'db.getSiblingDB("humanoidfarming").videos.drop()'
```

Then restart the backend.

### Transferring MongoDB between machines

To move the database from one machine to another (e.g. Mac to Linux server):

```bash
# on the source machine - exports to ./mongo_dump/
cd backend
bash mongo_transfer.sh export

# copy mongo_dump/ to the other machine, then:
bash mongo_transfer.sh import
```

## Authentication and Roles

Sign-in is Google Identity Services. The frontend hands the Google ID token to
the backend, which verifies it, stores the account in the `users` collection and
issues a Flask session cookie.

There are three roles:

| Role | Can do |
|------|--------|
| `user` | Browse every public page, leave comments, delete their own comments |
| `developer` | Everything a user can, plus the data query interface at `/query` |
| `admin` | Everything, plus user management at `/admin`, the `users` data source, and deleting anyone's comment |

Every public page stays public — only `/query` and `/admin` are gated.

**Bootstrapping the first admin:** put your address in `ADMIN_EMAILS`. Anyone
whose email is on that list becomes an admin on their next sign-in, whether or
not they had already signed up. After that, admins assign roles from `/admin`.
`ADMIN_EMAILS` never demotes anyone, and the API refuses to demote the last
remaining admin.

### Environment variables

`.env` in the project root (frontend):

```
REACT_APP_GOOGLE_CLIENT_ID=<your google oauth client id>
```

`backend/.env`:

```
GOOGLE_CLIENT_ID=<the same google oauth client id>
FLASK_SECRET_KEY=<a long random string; changing it logs everyone out>
ADMIN_EMAILS=you@example.com,someone.else@example.com
# optional, only needed when the frontend is not served through the CRA proxy
FRONTEND_ORIGINS=http://localhost:3000
# set to 1 once the site is behind https
COOKIE_SECURE=0
```

## API Endpoints

### Public

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/videos` | Returns all videos with task/subtask counts and categories |
| GET | `/api/videos/<video_id>` | Returns a single video with Pipeline 1 (robot guidance) and Pipeline 2 (missions, blocks) data |
| GET | `/api/stats` | Returns dashboard statistics for both pipelines (totals, categories, action types) |
| GET | `/api/videos/<video_id>/comments` | Comments on a video |
| GET | `/api/uploads/<filename>` | Serves an uploaded audio/video recording |

### Auth

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/google` | Verifies a Google ID token, creates or refreshes the account, starts a session |
| GET | `/api/auth/me` | The signed-in user, or `{"user": null}` |
| POST | `/api/auth/logout` | Clears the session |

### Signed in

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| POST | `/api/videos/<video_id>/comments` | any | Post a comment, optionally with a recording (transcribed by Whisper) |
| DELETE | `/api/comments/<comment_id>` | owner or admin | Delete a comment and its recording |

### Internal

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| GET | `/api/query/schema` | developer, admin | Queryable collections, their fields and the valid operators |
| POST | `/api/query` | developer, admin | Runs a filtered query (the `users` source is admin only) |
| GET | `/api/users` | admin | Every account |
| PATCH | `/api/users/<sub>/role` | admin | Sets an account's role to `user`, `developer` or `admin` |

## Data Query Interface

`/query` lets developers and admins filter the pipeline collections without
touching MongoDB: pick a collection, stack up field/operator/value filters,
match all or any of them, sort, page through the results, and export the current
page as CSV.

Queries are never passed through to MongoDB as raw filter documents. The request
carries `{field, op, value}` triples, and the backend looks up every field name
and operator in an allowlist before building the aggregation pipeline, so
operators like `$where` cannot be smuggled in and no collection outside
`QUERY_SOURCES` is reachable. Results are capped at 200 rows per request.

To expose a new collection or field, add it to `QUERY_SOURCES` in
`backend/app.py` — the UI builds its dropdowns from `/api/query/schema`, so
nothing on the frontend needs changing.
