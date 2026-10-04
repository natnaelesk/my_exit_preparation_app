import { Fragment } from 'react';
import { useCurriculum } from '../../contexts/CurriculumContext';
import LoadingAnimation from '../Common/LoadingAnimation';
import NoCurriculumNotice from './NoCurriculumNotice';

/**
 * Renders children only once the user has an active curriculum, remounting them when the active blueprint changes
 * so pages never hold a stale subject list.
 */
const RequireCurriculum = ({ children, message }) => {
  const { blueprint, hasCurriculum, loading, error, refresh } = useCurriculum();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <LoadingAnimation message="Loading your curriculum" size="large" />
      </div>
    );
  }

  if (!hasCurriculum) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        {error ? (
          <div className="card space-y-3 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <button type="button" className="btn-secondary" onClick={refresh}>Retry</button>
          </div>
        ) : (
          <NoCurriculumNotice message={message} />
        )}
      </div>
    );
  }

  return <Fragment key={blueprint.id}>{children}</Fragment>;
};

export default RequireCurriculum;
