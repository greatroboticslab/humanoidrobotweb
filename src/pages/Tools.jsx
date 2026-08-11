import './Tools.css';

// descriptions carried over from the homepage tools section
const MODELS = [
  {
    icon: 'S1',
    name: 'S1 Baseline',
    role: 'Task extraction',
    description:
      'Large language model for interpreting transcripts and extracting hierarchical tasks and subtasks from farming videos.',
    tags: ['LLM', 'Task Extraction', 'MoMask'],
  },
  {
    icon: 'B3',
    name: 'BLIP3 Multimodal',
    role: 'Vision and language',
    description:
      'Unified inference framework for text-to-text reasoning, image captioning, visual Q&A, and image generation.',
    tags: ['Vision', 'Captioning', 'LoRA'],
  },
  {
    icon: 'LG',
    name: 'LLaVAGraph',
    role: 'Graph understanding',
    description:
      'Graph understanding system for analyzing laser displacement patterns and actuator diagnostics.',
    tags: ['Classification', 'LLAMA', 'Graphs'],
  },
  {
    icon: 'QW',
    name: 'QWEN Baseline',
    role: 'Multimodal baseline',
    description:
      'Qwen2.5-VL based baseline for multimodal visual understanding and reasoning tasks.',
    tags: ['VLM', 'Baseline', 'Qwen'],
  },
];

// the pieces this site itself runs on
const STACK = [
  {
    name: 'Whisper',
    detail:
      'Transcribes audio, video and screen recordings left as reviewer feedback, so spoken comments become searchable text.',
  },
  {
    name: 'MongoDB',
    detail:
      'Stores the video dataset, both pipelines’ output, reviewer comments and user accounts.',
  },
  {
    name: 'Flask',
    detail:
      'Serves the REST API, verifies Google sign-in tokens, and enforces role-based access on every protected route.',
  },
  {
    name: 'React',
    detail:
      'Frontend for browsing the dataset, inspecting mission and task trees, and running queries against the collections.',
  },
  {
    name: 'Recharts',
    detail:
      'Renders the pipeline statistics on the homepage, including category and action-type distributions.',
  },
  {
    name: 'MediaRecorder API',
    detail:
      'Captures audio, webcam and screen recordings in the browser, with no plugin or upload step for the reviewer.',
  },
];

function Tools() {
  return (
    <div className="tools-page">
      <div className="tools-hero">
        <h1>Tools</h1>
        <p>
          The models that process the videos, and what this site runs on.
        </p>
      </div>

      <div className="tools-section">
        <h2>Models</h2>
        <p className="tools-lede">
          Lab modules for interpreting demonstration footage.
        </p>
        <div className="model-grid">
          {MODELS.map(m => (
            <div className="model-card" key={m.name}>
              <div className="model-card-head">
                <div className="model-icon">{m.icon}</div>
                <div>
                  <h3>{m.name}</h3>
                  <span className="model-role">{m.role}</span>
                </div>
              </div>
              <p>{m.description}</p>
              <div className="model-tags">
                {m.tags.map(t => (
                  <span className="model-tag" key={t}>{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="tools-section tinted">
        <div className="tools-section-inner">
          <h2>Platform</h2>
          <p className="tools-lede">
            What this site runs on.
          </p>
          <div className="stack-grid">
            {STACK.map(s => (
              <div className="stack-item" key={s.name}>
                <h4>{s.name}</h4>
                <p>{s.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Tools;
