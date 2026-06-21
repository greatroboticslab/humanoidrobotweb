import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Dataset.css';

const CATEGORIES = ['All', 'Narration', 'Planning', 'Perception', 'Motion'];
const PER_PAGE = 20;

function Dataset() {
  const [videos, setVideos] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState(1);

  // fetch all videos on mount
  useEffect(() => {
    fetch('http://localhost:5000/api/videos')
      .then(res => res.json())
      .then(data => setVideos(data))
      .catch(err => console.error('Error fetching videos:', err));
  }, []);

  // filter by search and category
  const filtered = videos.filter(v => {
    const matchesSearch = v.title.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'All' || v.category.toLowerCase() === category.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  // pagination
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, category]);

  return (
    <div className="dataset-page">
      <h2>Dataset</h2>
      <p>{filtered.length} videos processed through the pipeline</p>

      {/* search and category filters */}
      <div className="dataset-filters">
        <input
          type="text"
          className="search-input"
          placeholder="Search videos by title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="category-filters">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`filter-btn ${category === cat ? 'active' : ''}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* video card grid */}
      {paginated.length > 0 ? (
        <div className="video-grid">
          {paginated.map(video => (
            <Link to={`/dataset/${video.video_id}`} className="video-card" key={video.video_id}>
              <img
                className="video-thumbnail"
                src={`https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`}
                alt={video.title}
              />
              <div className="video-card-body">
                <span className="category-tag">
                  {video.category.charAt(0).toUpperCase() + video.category.slice(1)}
                </span>
                <h4 className="video-card-title">{video.title}</h4>
                <div className="video-card-meta">
                  <span>{video.task_count} tasks</span>
                  <span>{video.subtask_count} subtasks</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="no-results">No videos found.</p>
      )}

      {/* pagination */}
      {totalPages > 1 && (() => {
        // build page numbers: 1, 2, 3, ... last
        const pages = [];
        const maxVisible = 5;
        if (totalPages <= maxVisible + 2) {
          for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
          pages.push(1);
          if (page > 3) pages.push('...');
          for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
            pages.push(i);
          }
          if (page < totalPages - 2) pages.push('...');
          pages.push(totalPages);
        }

        return (
          <div className="pagination">
            <button
              className="pagination-btn"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 1}
            >
              Previous
            </button>
            {pages.map((p, i) =>
              p === '...' ? (
                <span key={`dots-${i}`} className="pagination-dots">...</span>
              ) : (
                <button
                  key={p}
                  className={`page-btn ${page === p ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              )
            )}
            <button
              className="pagination-btn"
              onClick={() => setPage(p => p + 1)}
              disabled={page === totalPages}
            >
              Next
            </button>
          </div>
        );
      })()}
    </div>
  );
}

export default Dataset;
