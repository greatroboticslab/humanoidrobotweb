import { useState, useEffect } from 'react';
import './Home.css';

function Home() {
  const [videos, setVideos] = useState([]);

  useEffect(() => {
    fetch('http://localhost:5000/api/videos')
      .then(res => res.json())
      .then(data => setVideos(data))
      .catch(err => console.error('Error fetching videos:', err));
  }, []);
  return (
    <>
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
              {videos.map((video) => (
                <tr key={video.video_id}>
                  <td>{video.title}</td>
                  <td><span className='category-tag'>{video.category}</span></td>
                  <td>{video.tasks.length}</td>
                  <td>{video.tasks.reduce((sum, t) => sum + t.subtasks.length, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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