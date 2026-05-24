# Humanoid Farming Web

A web interface for the Humanoid Farming Pipeline — a research project at Middle Tennessee State University focused on converting farming demonstration videos into structured, robot-usable task sequences through multimodal AI.

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
  data/               # Sample JSON data files
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

The backend automatically loads sample data into MongoDB on first run.

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/videos` | Returns all videos |
| GET | `/api/videos/<video_id>` | Returns a single video by ID |
