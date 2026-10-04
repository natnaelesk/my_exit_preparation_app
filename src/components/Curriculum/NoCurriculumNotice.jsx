import { Link } from 'react-router-dom';

/** Empty state shown wherever the app needs courses but the user has not applied a blueprint yet. */
const NoCurriculumNotice = ({ title = 'No curriculum yet', message, compact = false }) => (
  <div className={`card text-center space-y-3 ${compact ? 'py-4' : 'py-8'}`}>
    <h3 className="text-lg font-bold text-text">{title}</h3>
    <p className="text-sm text-muted max-w-md mx-auto">
      {message || 'Your courses come from your official exit exam blueprint. Upload it once and the app sets up your subjects, priorities and study focus from it.'}
    </p>
    <Link to="/curriculum" className="btn-primary inline-block">Upload your exit exam blueprint</Link>
  </div>
);

export default NoCurriculumNotice;
