# Humanoid Farming Web

A web interface for the Humanoid Farming Pipeline — a research project at Middle Tennessee State University focused on converting farming demonstration videos into structured, robot-usable task sequences through multimodal AI.

**Live site:** https://endurance-cylinder-component.ngrok-free.dev

Running on the lab server behind an ngrok tunnel. On the first visit ngrok shows an
interstitial warning page — click **Visit Site** to continue. Sign-in is limited to
addresses on the OAuth test-user list, so ask to be added if you need an account.

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

## Deploying to the Lab Server

In development, React serves the frontend on :3000 and proxies `/api` to Flask on
:5000. In production there is a single port: `npm run build` compiles the frontend
and Flask serves those files alongside the API, with ngrok tunnelling to it.

### 1. Environment

The system Python and Node on the lab server are shared and out of date, so create
a conda environment rather than installing anything globally.

```bash
conda create -n <yourname>-humanoid python=3.11 -y
conda activate <yourname>-humanoid
```

The server's `/usr/bin/node` is v10, which is too old to build this project. Install
a current Node **inside the environment**, leaving the system one untouched:

```bash
conda install -c conda-forge nodejs=20 -y
hash -r          # bash caches command paths; without this it keeps using v10
node --version   # expect v20.x
```

Then the Python dependencies:

```bash
pip install -r humanoidrobotweb/backend/requirements.txt
```

### 2. Configuration

Both `.env` files are gitignored and must be created by hand.

**Create these before building the frontend.** `REACT_APP_GOOGLE_CLIENT_ID` is
compiled into the bundle at build time, so a build made without it produces a site
where sign-in fails silently.

`.env` in the project root:

```
REACT_APP_GOOGLE_CLIENT_ID=<client id>
```

Then derive the backend's copy from it and add the rest:

```bash
cd humanoidrobotweb/backend
sed 's/^REACT_APP_//' ../../.env > .env
python -c "import secrets;print('FLASK_SECRET_KEY='+secrets.token_hex(32))" >> .env
echo "ADMIN_EMAILS=<admin addresses, comma separated>" >> .env
echo "COOKIE_SECURE=1" >> .env
```

`COOKIE_SECURE=1` is correct behind ngrok, which terminates TLS.

### 3. Build the frontend

```bash
cd /path/to/humanoidrobotweb && npm install && npm run build
```

### 4. Import the database

The `videos` and `pipeline2` collections load automatically from `backend/data/` on
first run. `pipeline1` is not in the repo and has to be migrated from a machine that
already has it:

```bash
# on the source machine
cd humanoidrobotweb/backend && bash mongo_transfer.sh export

# copy mongo_dump/ across, then on the server
bash mongo_transfer.sh import
```

Check the target server doesn't already have a `humanoidfarming` database in use
before importing, since the restore drops collections before writing.

### 5. Pick a free port

The server is shared, so find a port nobody has claimed. Avoid 8888 (Jupyter), 8080,
5000, 3000 and 27017 (MongoDB).

```bash
ss -tuln | grep 8420    # no output means it is free
```

### 6. Run it

Use `tmux` so both processes survive disconnecting.

```bash
tmux new -s site
```

Flask in the first pane:

```bash
cd humanoidrobotweb/backend && PORT=8420 FLASK_DEBUG=0 python app.py
```

Split with `Ctrl+B` then `"`, and run ngrok in the second:

```bash
ngrok http --url=<your reserved domain> 8420
```

Detach with `Ctrl+B` then `d`. Both keep running. Reattach later with
`tmux attach -t site`.

### Google OAuth for a deployment

The deployment's URL must be listed under **Authorized JavaScript origins** in the
Google Cloud console, with `https://` and no trailing slash. Sign-in fails without
it. Changes can take a few minutes to propagate.

A reserved ngrok domain is worth setting up (free accounts get one) so the URL stays
constant and this only has to be configured once.

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
| PATCH | `/api/query/<source>/<row_id>` | admin | Updates allowlisted fields on one row |
| DELETE | `/api/query/<source>/<row_id>` | admin | Deletes a row, cascading to dependent collections |
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

### Editing and deleting rows

Admins additionally get **Edit** and **Delete** on each row; developers see the
same table read-only. Both are enforced on the server, so hiding the buttons is
only cosmetic.

Only fields listed in a source's `editable` array can be changed — a request
naming any other field is rejected, so computed columns like `task_count` and
identity fields like `sub` cannot be written.

Deleting a **video** cascades: its `pipeline1`, `pipeline2` and `comments` rows
go too, along with any recordings those comments left in `uploads/`. Without
that, removing a video from the dataset would strand its pipeline output and
feedback in collections nothing can reach. The confirmation dialog names
everything that will be removed.

The `users` source is deliberately **not** deletable here. Accounts are managed
at `/admin`, which owns the last-admin guard, and keeping that logic in one
place means it can't be bypassed through the query interface.

To expose a new collection or field, add it to `QUERY_SOURCES` in
`backend/app.py` — the UI builds its dropdowns from `/api/query/schema`, so
nothing on the frontend needs changing.
