import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import './VideoDetail.css';

function CommentSection({ videoId }) {
  const [comments, setComments] = useState([]);
  const [name, setName] = useState(() => localStorage.getItem('comment_name') || '');
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(false);
  const [recordType, setRecordType] = useState(null);
  const [mediaBlob, setMediaBlob] = useState(null);
  const [mediaUrl, setMediaUrl] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const videoPreviewRef = useRef(null);

  useEffect(() => {
    fetch(`/api/videos/${videoId}/comments`)
      .then(res => res.json())
      .then(data => setComments(data))
      .catch(err => console.error('Error fetching comments:', err));
  }, [videoId]);

  useEffect(() => {
    localStorage.setItem('comment_name', name);
  }, [name]);

  const startRecording = async (type) => {
    try {
      const constraints = type === 'video'
        ? { audio: true, video: true }
        : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const mimeType = type === 'video'
        ? (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4')
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4');
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setMediaBlob(blob);
        setMediaUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
        if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
      };

      recorder.start();
      setRecording(true);
      setRecordType(type);
      setMediaBlob(null);
      setMediaUrl(null);
    } catch (err) {
      console.error('Recording error:', err);
      alert('Could not access microphone/camera. Please allow permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const clearRecording = () => {
    setMediaBlob(null);
    setMediaUrl(null);
    setRecordType(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      alert('Please enter your name.');
      return;
    }
    if (!text.trim() && !mediaBlob) {
      alert('Please add a comment or recording.');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('name', name.trim());
    formData.append('text', text.trim());
    formData.append('type', mediaBlob ? recordType : 'text');
    if (mediaBlob) {
      const ext = mediaBlob.type.includes('mp4') ? 'mp4' : 'webm';
      formData.append('file', mediaBlob, `recording.${ext}`);
    }

    try {
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: 'POST',
        body: formData,
      });
      const comment = await res.json();
      setComments(prev => [comment, ...prev]);
      setText('');
      clearRecording();
    } catch (err) {
      console.error('Error submitting comment:', err);
    }
    setSubmitting(false);
  };

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="comments-section">
      <h3>Comments</h3>
      <p className="comments-subtitle">Leave feedback to help verify the accuracy of AI-extracted data.</p>

      <div className="comment-input">
        <input
          type="text"
          className="comment-name-input"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <textarea
          className="comment-text-input"
          placeholder="Add a comment..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />

        <div className="comment-record-controls">
          {!recording && !mediaBlob && (
            <>
              <button className="record-btn audio" onClick={() => startRecording('audio')}>
                <span className="record-icon">&#9679;</span> Record Audio
              </button>
              <button className="record-btn video" onClick={() => startRecording('video')}>
                <span className="record-icon">&#9679;</span> Record Video
              </button>
            </>
          )}

          {recording && (
            <button className="record-btn stop" onClick={stopRecording}>
              <span className="stop-icon">&#9632;</span> Stop Recording
            </button>
          )}
        </div>

        {recording && recordType === 'video' && (
          <video
            ref={(el) => {
              videoPreviewRef.current = el;
              if (el && streamRef.current) {
                el.srcObject = streamRef.current;
              }
            }}
            className="comment-video-live"
            muted
            autoPlay
            playsInline
          />
        )}

        {recording && recordType === 'audio' && (
          <div className="recording-indicator">
            <span className="recording-dot" /> Recording audio...
          </div>
        )}

        {mediaUrl && !recording && (
          <div className="comment-preview">
            {recordType === 'audio' ? (
              <audio src={mediaUrl} controls />
            ) : (
              <video src={mediaUrl} controls className="comment-video-preview" />
            )}
            <button className="discard-btn" onClick={clearRecording}>Discard</button>
          </div>
        )}

        <button
          className="comment-submit-btn"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? 'Submitting & Transcribing...' : 'Submit'}
        </button>
      </div>

      <div className="comment-list">
        {comments.length === 0 && (
          <p className="no-comments">No comments yet. Be the first to leave feedback!</p>
        )}
        {comments.map((c, i) => (
          <div key={i} className="comment-card">
            <div className="comment-header">
              <span className="comment-author">{c.name}</span>
              <span className="comment-date">{formatDate(c.created_at)}</span>
            </div>
            {c.text && <p className="comment-body">{c.text}</p>}
            {c.filename && c.type === 'audio' && (
              <audio src={`/api/uploads/${c.filename}`} controls className="comment-audio" />
            )}
            {c.filename && c.type === 'video' && (
              <video src={`/api/uploads/${c.filename}`} controls className="comment-video-playback" />
            )}
            {c.transcript && (
              <div className="comment-transcript">
                <span className="comment-transcript-label">Transcript:</span> {c.transcript}
              </div>
            )}
            <button
              className="comment-delete-btn"
              onClick={async () => {
                if (!window.confirm('Delete this comment?')) return;
                await fetch(`/api/comments/${c.id}`, { method: 'DELETE' });
                setComments(prev => prev.filter(x => x.id !== c.id));
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// format seconds to mm:ss
function formatTime(seconds) {
  if (seconds == null) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// collapsible tree node component
function TreeNode({ icon, iconClass, label, timestamp, tag, detail, children }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = (children && children.length > 0) || detail;

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
      {expanded && (
        <div className="tree-children">
          {detail && <div className="block-detail">{detail}</div>}
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
                  children={(blocksBySubMission[sm.sub_mission_id] || []).map(block => {
                    const catDist = block.category_distribution || {};
                    const catTotal = Object.values(catDist).reduce((s, v) => s + v, 0) || 1;
                    const subtaskRefs = (block.subtask_refs || []).map(ref => {
                      const task = (video.tasks || [])[ref.task_index];
                      const sub = task?.subtasks?.[ref.sub_index];
                      return sub?.text;
                    }).filter(Boolean);

                    return (
                      <TreeNode
                        key={block.block_id}
                        icon="B"
                        iconClass="block"
                        label={block.block_preview_text?.slice(0, 80) + (block.block_preview_text?.length > 80 ? '...' : '') || `Block ${block.block_id}`}
                        tag={block.dominant_category?.charAt(0).toUpperCase() + block.dominant_category?.slice(1)}
                        timestamp={`${formatTime(block.time_start)} - ${formatTime(block.time_end)}`}
                        detail={
                          <>
                            {block.block_preview_text && (
                              <div className="block-detail-section">
                                <div className="block-detail-label">Full Text</div>
                                <div className="block-detail-text">{block.block_preview_text}</div>
                              </div>
                            )}
                            {Object.keys(catDist).length > 0 && (
                              <div className="block-detail-section">
                                <div className="block-detail-label">Category Breakdown</div>
                                <div className="block-cat-bars">
                                  {Object.entries(catDist)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([cat, count]) => (
                                      <div key={cat} className="block-cat-row">
                                        <span className="block-cat-name">{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                                        <div className="block-cat-bar-bg">
                                          <div
                                            className="block-cat-bar-fill"
                                            style={{ width: `${(count / catTotal) * 100}%` }}
                                          />
                                        </div>
                                        <span className="block-cat-pct">{Math.round((count / catTotal) * 100)}%</span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            )}
                            {subtaskRefs.length > 0 && (
                              <div className="block-detail-section">
                                <div className="block-detail-label">Linked Subtasks</div>
                                <ul className="block-subtask-list">
                                  {subtaskRefs.map((text, i) => (
                                    <li key={i}>{text}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </>
                        }
                      />
                    );
                  })}
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

      {/* pipeline 1: robot guidance */}
      {video.pipeline1_tasks && video.pipeline1_tasks.length > 0 && (
        <div className="tree-section">
          <h3>
            <span className="pipeline-badge">Pipeline 1</span>
            Robot Guidance
          </h3>
          <div className="guidance-list">
            {video.pipeline1_tasks.map((task, i) => (
              <div key={i} className="guidance-task">
                <div className="guidance-task-header" onClick={(e) => {
                  const el = e.currentTarget.nextElementSibling;
                  const arrow = e.currentTarget.querySelector('.guidance-arrow');
                  if (el.style.display === 'none') {
                    el.style.display = 'block';
                    arrow.classList.add('expanded');
                  } else {
                    el.style.display = 'none';
                    arrow.classList.remove('expanded');
                  }
                }}>
                  <span className="guidance-arrow">&#9654;</span>
                  <span className="guidance-task-title">Task {i + 1}: {task.task}</span>
                  <span className="guidance-count">{(task.subtasks || []).length} subtasks</span>
                </div>
                <div style={{ display: 'none' }}>
                  {(task.subtasks || []).map((sub, j) => {
                    const g = sub.guidance || {};
                    return (
                      <div key={j} className="guidance-subtask">
                        <div className="guidance-subtask-header">{sub.text}</div>
                        {sub.frames && sub.frames.length > 0 && (
                          <span className="guidance-frames">{sub.frames.length} frames</span>
                        )}

                        {g.global_summary && (
                          <div className="guidance-field">
                            <div className="guidance-field-label">Summary</div>
                            <div className="guidance-field-value">{g.global_summary}</div>
                          </div>
                        )}

                        {g.preconditions_for_robot && (
                          <div className="guidance-field">
                            <div className="guidance-field-label">Preconditions</div>
                            <div className="guidance-field-value">{g.preconditions_for_robot}</div>
                          </div>
                        )}

                        {g.ordered_robot_action_steps && (
                          <div className="guidance-field">
                            <div className="guidance-field-label">Action Steps</div>
                            <div className="guidance-field-value guidance-steps">{g.ordered_robot_action_steps}</div>
                          </div>
                        )}

                        {g.success_criteria && (
                          <div className="guidance-field">
                            <div className="guidance-field-label">Success Criteria</div>
                            <div className="guidance-field-value">{g.success_criteria}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <CommentSection videoId={videoId} />
    </div>
  );
}

export default VideoDetail;
