import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './About.css';

function About() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error('Error fetching stats:', err));
  }, []);

  const n = (v) => (v == null ? '—' : v.toLocaleString());

  return (
    <div className="about-page">
      <div className="about-hero">
        <h1>About the Project</h1>
        <p>
          Turning farming demonstration videos into task sequences a humanoid
          robot can follow.
        </p>
      </div>

      {/* the problem */}
      <div className="about-section">
        <h2>The Problem</h2>
        <div className="about-body">
          <p>
            A lot of farming knowledge only exists as video. Someone walks you
            through building a vertical garden or setting up solar irrigation,
            and if you watch it, you can go do it yourself.
          </p>
          <p>
            A robot can't. It needs to know what has to be true before it
            starts, what to do in what order, and how to tell whether a step
            actually worked. All of that is in the video somewhere, mixed in
            with narration, camera movement, and everything the person assumes
            you already know.
          </p>
          <p>
            We run the videos through two pipelines to pull it out.
          </p>
        </div>
      </div>

      {/* the two pipelines */}
      <div className="about-section tinted">
        <div className="about-section-inner">
          <h2>How It Works</h2>
          <p className="about-lede">
            Both pipelines read the same video and pull out different things.
          </p>

          <div className="pipeline-cards">
            <div className="pipeline-card">
              <span className="pipeline-card-badge">Pipeline 1</span>
              <h3>Robot Guidance Generation</h3>
              <p>
                Takes each subtask and writes out what a robot would need to do,
                based on what's actually visible in the frames.
              </p>
              <ol className="pipeline-steps">
                <li>Extract frames covering the subtask</li>
                <li>Caption each frame and combine them into a scene understanding</li>
                <li>State the preconditions the robot needs before starting</li>
                <li>Produce ordered action steps, each labelled by type</li>
                <li>Define success criteria for verifying the step worked</li>
              </ol>
            </div>

            <div className="pipeline-card">
              <span className="pipeline-card-badge">Pipeline 2</span>
              <h3>Structured Task Dataset</h3>
              <p>
                Breaks the video into a hierarchy, so a long demonstration
                becomes something you can navigate instead of a wall of
                transcript.
              </p>
              <ol className="pipeline-steps">
                <li>Split the transcript into coherent blocks</li>
                <li>Classify each block by what is happening in it</li>
                <li>Group blocks into sub-missions by theme</li>
                <li>Roll sub-missions up into an overall mission</li>
                <li>Link every block back to the subtasks it covers</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      {/* dataset */}
      <div className="about-section">
        <h2>The Dataset</h2>
        <p className="about-lede">
          Every number below is live from the database.
        </p>
        <div className="about-stats">
          <div className="about-stat">
            <span className="about-stat-number">{n(stats?.total_videos)}</span>
            <span className="about-stat-label">Videos</span>
          </div>
          <div className="about-stat">
            <span className="about-stat-number">{n(stats?.total_tasks)}</span>
            <span className="about-stat-label">Tasks</span>
          </div>
          <div className="about-stat">
            <span className="about-stat-number">{n(stats?.total_subtasks)}</span>
            <span className="about-stat-label">Subtasks</span>
          </div>
          <div className="about-stat">
            <span className="about-stat-number">{n(stats?.pipeline1?.total_frames)}</span>
            <span className="about-stat-label">Frames</span>
          </div>
        </div>
      </div>

      {/* reviewing the data */}
      <div className="about-section tinted">
        <div className="about-section-inner">
          <h2>Reviewing the Data</h2>
          <p className="about-lede">
            The extraction gets things wrong sometimes, so the data is built to
            be checked.
          </p>
          <div className="review-flow">
            <div className="review-step">
              <span className="review-step-num">1</span>
              <h4>Review</h4>
              <p>
                Open any video and look at what came out of it: the mission
                tree, the task tree, and the robot guidance generated for each
                subtask.
              </p>
            </div>
            <div className="review-step">
              <span className="review-step-num">2</span>
              <h4>Flag</h4>
              <p>
                Leave a comment when something is off. Type it, or record your
                voice, your webcam, or your screen if it's easier to point at
                the problem than describe it.
              </p>
            </div>
            <div className="review-step">
              <span className="review-step-num">3</span>
              <h4>Act</h4>
              <p>
                Recordings get transcribed, so spoken feedback is searchable
                later. Reviewers with the right role can then fix or delete the
                bad records.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* research group */}
      <div className="about-section">
        <h2>The Research Group</h2>
        <div className="about-body">
          <p>
            This is an undergraduate research project at Middle Tennessee State
            University, carried out in the Great Robotics Lab under the
            supervision of <strong>Dr. Hongbo Zhang</strong>.
          </p>
          <p>
            The pipelines, the dataset, and this site are all ongoing work. The
            point of putting it on the web is that the data can be looked at
            and corrected, rather than sitting in a folder nobody opens.
          </p>
        </div>
        <div className="about-links">
          <Link to="/dataset" className="about-link-btn primary">Explore the Dataset</Link>
          <a
            href="https://github.com/greatroboticslab/humanoidrobotweb"
            target="_blank"
            rel="noopener noreferrer"
            className="about-link-btn secondary"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}

export default About;
