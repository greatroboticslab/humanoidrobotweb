import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import './Home.css';

// mtsu blue palette for chart colors
const CHART_COLORS = ['#0066CC', '#3399FF', '#69B3E7', '#004C99'];

function Home() {
  const [videos, setVideos] = useState([]);
  const [stats, setStats] = useState(null);

  // fetch video list and stats on mount
  useEffect(() => {
    fetch('http://localhost:5000/api/videos')
      .then(res => res.json())
      .then(data => setVideos(data))
      .catch(err => console.error('Error fetching videos:', err));

    fetch('http://localhost:5000/api/stats')
      .then(res => res.json())
      .then(data => setStats(data))
      .catch(err => console.error('Error fetching stats:', err));
  }, []);

  return (
    <>
      {/* hero banner */}
      <div className="homeBanner">
        <div className='headerText'>
          <h1>Humanoid Farming Pipeline</h1>
          <h3>Converting farming demonstration videos into structured, robot-usable task sequences through multimodal AI.</h3>
        </div>
        <div className="homeBannerBtns">
          <button className="exploreDatasetBtn">Explore Dataset</button>
          <button className="viewToolsBtn">View Tools</button>
        </div>
      </div>

      {/* stats bar, totals from /api/stats */}
      {stats && (
        <div className="stats-bar">
          <div className="stat-card">
            <span className="stat-number">{stats.total_videos.toLocaleString()}</span>
            <span className="stat-label">Videos</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.total_tasks.toLocaleString()}</span>
            <span className="stat-label">Tasks</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.total_subtasks.toLocaleString()}</span>
            <span className="stat-label">Subtasks</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.total_blocks.toLocaleString()}</span>
            <span className="stat-label">Blocks</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{Object.keys(stats.categories).length}</span>
            <span className="stat-label">Categories</span>
          </div>
        </div>
      )}

      {/* charts section, bar chart and pie chart side by side */}
      {stats && stats.categories && (() => {
        // convert categories object to sorted array for recharts
        const categoryData = Object.entries(stats.categories)
          .map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value,
          }))
          .sort((a, b) => b.value - a.value);
        const total = categoryData.reduce((sum, d) => sum + d.value, 0);

        return (
          <div className="charts-section">
            <div className="headerText">
              <h2>Pipeline Statistics</h2>
              <h3>Each farming video is split into smaller segments called blocks. Every block is classified into a category based on what's happening; whether someone is narrating, planning, perceiving their environment, or performing a physical motion.</h3>
            </div>
            <div className="charts-container">
              {/* bar chart, block count per category */}
              <div className="chart-card">
                <h4>Blocks by Category</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="name" tick={{ fontSize: 13 }} />
                    <YAxis tick={{ fontSize: 13 }} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {categoryData.map((entry, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* pie chart, category percentages */}
              <div className="chart-card">
                <h4>Category Distribution</h4>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                      label={({ name, value, x, y, textAnchor }) => (
                        <text x={x} y={y + 6} textAnchor={textAnchor} fill="#374151" fontSize={12}>
                          <tspan x={x} dy="0">{name}</tspan>
                          <tspan x={x} dy="14">{`(${((value / total) * 100).toFixed(1)}%)`}</tspan>
                        </text>
                      )}
                      labelLine={{ strokeWidth: 1 }}
                    >
                      {categoryData.map((entry, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );
      })()}

      {/* dataset preview, first 8 videos */}
      <div className='datasetBanner'>
        <div className='headerText'>
          <h2>Dataset</h2>
          <h3>Sample videos processed through the pipeline through extracted tasks.</h3>
        </div>
        <div className='table-container'>
          <table>
            <thead>
              <tr>
                <th>Video</th>
                <th>Category</th>
                <th>Tasks</th>
                <th>Subtasks</th>
              </tr>
            </thead>
            <tbody>
              {videos.slice(0, 8).map((video) => (
                <tr key={video.video_id}>
                  <td>{video.title}</td>
                  <td><span className='category-tag'>{video.category.charAt(0).toUpperCase() + video.category.slice(1)}</span></td>
                  <td>{video.task_count}</td>
                  <td>{video.subtask_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Link to="/dataset" className="view-dataset-btn">View Full Dataset</Link>
      </div>

      {/* tools section */}
      <div className='toolsBanner'>
        <div className='headerText'>
          <h2>Tools</h2>
          <h3>The modules that power the humanoid farming pipeline.</h3>
        </div>

        <div className='tools-container'>
          <div className='tool-box'>
            <div className='tool-header'>
              <div className='tool-icon'>S1</div>
              <h4>S1 Baseline</h4>
            </div>
            <p>Large language model for interpreting transcripts and extracting hierarchical tasks and subtasks from farming videos.</p>
            <div className='tools-tag-area'>
              <span className='tool-tag'>LLM</span>
              <span className='tool-tag'>Task Extraction</span>
              <span className='tool-tag'>MoMask</span>
            </div>
          </div>
          <div className='tool-box'>
            <div className='tool-header'>
              <div className='tool-icon'>B3</div>
              <h4>BLIP3 Multimodal</h4>
            </div>
            <p>Unified inference framework for text-to-text reasoning, image captioning, visual Q&A, and image generation.</p>
            <div className='tools-tag-area'>
              <span className='tool-tag'>Vision</span>
              <span className='tool-tag'>Captioning</span>
              <span className='tool-tag'>LoRA</span>
            </div>
          </div>
          <div className='tool-box'>
            <div className='tool-header'>
              <div className='tool-icon'>LG</div>
              <h4>LLaVAGraph</h4>
            </div>
            <p>Graph understanding system for analyzing laser displacement patterns and actuator diagnostics.</p>
            <div className='tools-tag-area'>
              <span className='tool-tag'>Classification</span>
              <span className='tool-tag'>LLAMA</span>
              <span className='tool-tag'>Graphs</span>
            </div>
          </div>
          <div className='tool-box'>
            <div className='tool-header'>
              <div className='tool-icon'>QW</div>
              <h4>QWEN Baseline</h4>
            </div>
            <p>Qwen2.5-VL based baseline for multimodal visual understanding and reasoning tasks.</p>
            <div className='tools-tag-area'>
              <span className='tool-tag'>VLM</span>
              <span className='tool-tag'>Baseline</span>
              <span className='tool-tag'>Qwen</span>
            </div>
          </div>
        </div>
      </div>

      {/* about section */}
      <div className='about-banner'>
        <div className='headerText'>
          <h2>About</h2>
          <h3>The Humanoid Farming Pipeline is a research project at Middle Tennessee State University focused
            on converting human farming demonstrations into structured task sequences that humanoid robots can
            learn from.</h3>

          <h3>By combining video processing, large language models, and multimodal AI, we aim to bridge the gap
            between human agricultural knowledge and robotic execution in precision farming.</h3>
        </div>
      </div>
    </>

  );
}

export default Home;
