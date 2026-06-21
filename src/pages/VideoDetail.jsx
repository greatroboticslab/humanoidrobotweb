import { useParams } from 'react-router-dom';

function VideoDetail() {
  const { videoId } = useParams();

  return (
    <div style={{ padding: '40px 48px' }}>
      <h2>Video Detail</h2>
      <p>Video ID: {videoId}</p>
      <p>Tree chart coming soon.</p>
    </div>
  );
}

export default VideoDetail;
