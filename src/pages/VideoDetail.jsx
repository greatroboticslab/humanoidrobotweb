import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import './VideoDetail.css';

// format seconds to mm:ss
function formatTime(seconds) {
  if (seconds == null) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// collapsible tree node component
function TreeNode({ icon, iconClass, label, timestamp, tag, children }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = children && children.length > 0;

  return (
    <div className="tree-node">
      <div className="tree-label" onClick={() => hasChildren && setExpanded(!expanded)}>
        {hasChildren ? (
          <span className={`tree-toggle ${expanded ? 'expanded' : ''}`}>&#9654;</span>
        ) : (
          <span className="tree-toggle" />
        )}
        <span className={`tree-icon ${iconClass}`}>{icon}</span>
        <span className="tree-text">{label}</span>
        {tag && <span className="tree-category-tag">{tag}</span>}
        {timestamp && <span className="tree-timestamp">{timestamp}</span>}
      </div>
      {expanded && hasChildren && (
        <div className="tree-children">
          {children}
        </div>
      )}
    </div>
  );
}

function VideoDetail() {
  const { videoId } = useParams();
  const [video, setVideo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/videos/${videoId}`)
      .then(res => res.json())
      .then(data => {
        setVideo(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching video:', err);
        setLoading(false);
      });
  }, [videoId]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!video || video.error) return <div className="loading">Video not found.</div>;

  // group blocks by sub-mission
  const blocksBySubMission = {};
  (video.blocks || []).forEach(block => {
    const smId = block.sub_mission_id || 'unknown';
    if (!blocksBySubMission[smId]) blocksBySubMission[smId] = [];
    blocksBySubMission[smId].push(block);
  });

  return (
    <div className="video-detail">
      <Link to="/dataset" className="back-link">&#8592; Back to Dataset</Link>

      {/* video header */}
      <div className="video-header">
        <img
          className="video-header-thumbnail"
          src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
          alt={video.title}
        />
        <div className="video-header-info">
          <h2>{video.title}</h2>
          {video.blocks && video.blocks[0] && (
            <span className="category-tag">
              {video.blocks[0].dominant_category?.charAt(0).toUpperCase() +
                video.blocks[0].dominant_category?.slice(1)}
            </span>
          )}
          <div className="video-meta">
            <span>{(video.tasks || []).length} tasks</span>
            <span>{(video.tasks || []).reduce((sum, t) => sum + (t.subtasks || []).length, 0)} subtasks</span>
            <span>{(video.blocks || []).length} blocks</span>
          </div>
          {video.url && (
            <a href={video.url} target="_blank" rel="noopener noreferrer" className="youtube-link">
              Watch on YouTube &#8599;
            </a>
          )}
        </div>
      </div>

      {/* pipeline2 tree: mission > sub-mission > blocks */}
      {video.mission_title && (
        <div className="tree-section">
          <h3>Mission Tree</h3>
          <div className="tree-container">
            <TreeNode
              icon="M"
              iconClass="mission"
              label={video.mission_title}
              children={(video.sub_missions || []).map(sm => (
                <TreeNode
                  key={sm.sub_mission_id}
                  icon="SM"
                  iconClass="sub-mission"
                  label={sm.sub_mission_title}
                  timestamp={`${formatTime(sm.time_start)} - ${formatTime(sm.time_end)}`}
                  children={(blocksBySubMission[sm.sub_mission_id] || []).map(block => (
                    <TreeNode
                      key={block.block_id}
                      icon="B"
                      iconClass="block"
                      label={block.block_preview_text || `Block ${block.block_id}`}
                      tag={block.dominant_category?.charAt(0).toUpperCase() + block.dominant_category?.slice(1)}
                      timestamp={`${formatTime(block.time_start)} - ${formatTime(block.time_end)}`}
                    />
                  ))}
                />
              ))}
            />
          </div>
        </div>
      )}

      {/* tasks tree: task > subtasks */}
      {video.tasks && video.tasks.length > 0 && (
        <div className="tree-section">
          <h3>Task Tree</h3>
          <div className="tree-container">
            {video.tasks.map((task, i) => (
              <TreeNode
                key={i}
                icon="T"
                iconClass="task"
                label={`${task.task} (${(task.subtasks || []).length} subtasks)`}
                timestamp={task.start != null ? `${formatTime(task.start)} - ${formatTime(task.end)}` : ''}
                children={(task.subtasks || []).map((sub, j) => (
                  <TreeNode
                    key={j}
                    icon="ST"
                    iconClass="subtask"
                    label={sub.text}
                    timestamp={sub.start != null ? `${formatTime(sub.start)} - ${formatTime(sub.end)}` : ''}
                  />
                ))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default VideoDetail;
