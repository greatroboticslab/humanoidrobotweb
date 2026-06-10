# Humanoid Farming Web

A web interface for the Humanoid Farming Pipeline — a research project at Middle Tennessee State University focused on converting farming demonstration videos into structured, robot-usable task sequences through multimodal AI.

<img width="1470" height="810" alt="image" src="https://github.com/user-attachments/assets/557c52ff-9c29-414f-a070-d88740a80a1c" />
<img width="1470" height="810" alt="image" src="https://github.com/user-attachments/assets/d088a832-f449-4194-ab86-c60792ee1cb5" />
<img width="1470" height="810" alt="image" src="https://github.com/user-attachments/assets/40b6770a-939c-4fc4-8662-f2c8ca90a5f8" />

## Tech Stack

- **Frontend:** React
- **Backend:** Python (Flask)
- **Database:** MongoDB

## Project Structure

```
src/
  components/
    Navbar.jsx        # Navigation bar
    Footer.jsx        # Page footer
  pages/
    Home.jsx          # Home page with hero, dataset table, tools, and about sections
  styles/
    variables.css     # Global CSS variables (MTSU colors)

backend/
  app.py              # Flask API server
  requirements.txt    # Python dependencies
  data/
    tasks_with_timestamps/   # 567 video task files from pipeline
    pipeline2_blocks/        # 527 pipeline2 structured data files
```

## Setup

### Prerequisites

- Node.js
- Python 3
- MongoDB

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
mongosh --eval 'use humanoidfarming; db.videos.drop(); db.pipeline2.drop()'
```

Then restart the backend.

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/videos` | Returns all videos with task/subtask counts |
| GET | `/api/videos/<video_id>` | Returns a single video by ID with full details |
| GET | `/api/stats` | Returns dashboard statistics (totals, categories) |
