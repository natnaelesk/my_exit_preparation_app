import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { courseNames, getActiveBlueprint } from '../services/blueprintService';

const CurriculumContext = createContext(null);

/**
 * The signed-in user's active exit-exam blueprint. `subjects` (its course names) is the only subject list in the
 * app; it is empty until the user applies a blueprint.
 */
export const CurriculumProvider = ({ children }) => {
  const [blueprint, setBlueprint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const active = await getActiveBlueprint();
      setBlueprint(active);
      return active;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => {
    const subjects = courseNames(blueprint);
    return {
      blueprint,
      subjects,
      hasCurriculum: subjects.length > 0,
      loading,
      error,
      refresh,
      setBlueprint,
    };
  }, [blueprint, loading, error, refresh]);

  return <CurriculumContext.Provider value={value}>{children}</CurriculumContext.Provider>;
};

export const useCurriculum = () => {
  const context = useContext(CurriculumContext);
  if (!context) throw new Error('useCurriculum must be used inside CurriculumProvider');
  return context;
};
