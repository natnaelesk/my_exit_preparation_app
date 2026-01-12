import { useState, useEffect } from 'react';
import { resetAllData, getCollectionCounts } from '../../services/resetService';
import LoadingAnimation from '../Common/LoadingAnimation';
import ButtonLoading from '../Common/ButtonLoading';
import { ExclamationTriangleIcon, TrashIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

const ResetData = () => {
  const [isResetting, setIsResetting] = useState(false);
  const [counts, setCounts] = useState(null);
  const [result, setResult] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoadingCounts, setIsLoadingCounts] = useState(true);

  useEffect(() => {
    loadCounts();
  }, []);

  const loadCounts = async () => {
    try {
      setIsLoadingCounts(true);
      const dataCounts = await getCollectionCounts();
      setCounts(dataCounts);
    } catch (error) {
      console.error('Error loading counts:', error);
    } finally {
      setIsLoadingCounts(false);
    }
  };

  const handleReset = async () => {
    try {
      setIsResetting(true);
      setResult(null);
      
      const resetResult = await resetAllData();
      setResult(resetResult);
      
      // Reload counts after reset
      await loadCounts();
      
      setShowConfirm(false);
    } catch (error) {
      setResult({
        success: false,
        message: 'Error: ' + error.message
      });
    } finally {
      setIsResetting(false);
    }
  };

  const totalDocuments = counts ? Object.values(counts).reduce((sum, count) => sum + count, 0) : 0;

  return (
    <div className="min-h-screen bg-bg text-text px-4 py-6 pb-24 md:pb-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text mb-2">Reset All Data</h1>
          <p className="text-muted">Permanently delete all data from the database</p>
        </div>

        {/* Current Data Counts */}
        <div className="card">
          <h2 className="text-xl font-bold text-text mb-4">Current Data</h2>
          <div className="space-y-2 mb-4">
            {isLoadingCounts ? (
              <div className="text-center py-4">
                <LoadingAnimation message="Loading counts" size="default" />
              </div>
            ) : counts ? (
              <>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Questions:</span>
                  <span className="font-semibold text-text">{counts.questions || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Exams:</span>
                  <span className="font-semibold text-text">{counts.exams || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Attempts:</span>
                  <span className="font-semibold text-text">{counts.attempts || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Exam Sessions:</span>
                  <span className="font-semibold text-text">{counts.examSessions || 0}</span>
                </div>
                <div className="pt-3 border-t border-border">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-text">Total Documents:</span>
                    <span className="text-lg font-bold text-primary-500">{totalDocuments}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-muted">Loading counts...</div>
            )}
          </div>
          <button
            className="btn-secondary w-full"
            onClick={loadCounts}
          >
            Refresh Counts
          </button>
        </div>

        {/* Warning Card */}
        <div className="card border-2 border-red-500/50 bg-red-500/10">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold text-red-500 mb-2">Warning: This action cannot be undone!</h3>
              <p className="text-sm text-text">
                This will permanently delete ALL data from the database including:
              </p>
              <ul className="text-sm text-muted mt-2 list-disc list-inside space-y-1">
                <li>All questions</li>
                <li>All exams</li>
                <li>All attempt history</li>
                <li>All exam sessions</li>
                <li>All analytics data</li>
              </ul>
              <p className="text-sm font-semibold text-red-500 mt-3">
                This action is IRREVERSIBLE!
              </p>
            </div>
          </div>
        </div>

        {/* Result Message */}
        {result && (
          <div className={`card border-2 ${
            result.success 
              ? 'border-green-500/50 bg-green-500/10' 
              : 'border-red-500/50 bg-red-500/10'
          }`}>
            <div className="flex items-start gap-3">
              {result.success ? (
                <CheckCircleIcon className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
              ) : (
                <ExclamationTriangleIcon className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
              )}
              <div>
                <h3 className={`font-bold mb-2 ${
                  result.success ? 'text-green-500' : 'text-red-500'
                }`}>
                  {result.success ? 'Success!' : 'Error'}
                </h3>
                <p className="text-sm text-text">{result.message}</p>
                {result.results && (
                  <div className="mt-3 text-xs text-muted space-y-1">
                    {Object.entries(result.results).map(([collection, stats]) => (
                      <div key={collection}>
                        {collection}: {stats.deleted} deleted
                        {stats.errors > 0 && `, ${stats.errors} errors`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reset Button */}
        <div className="space-y-3">
          {!showConfirm ? (
            <button
              className="btn-primary w-full bg-red-600 hover:bg-red-700 text-white py-4 text-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={() => setShowConfirm(true)}
              disabled={isResetting || totalDocuments === 0}
            >
              <TrashIcon className="w-5 h-5" />
              Delete All Data
            </button>
          ) : (
            <div className="space-y-3">
              <div className="card bg-red-500/20 border-2 border-red-500">
                <p className="text-center font-semibold text-text mb-4">
                  Are you absolutely sure? This cannot be undone!
                </p>
                <div className="flex gap-3">
                  <button
                    className="btn-secondary flex-1"
                    onClick={() => setShowConfirm(false)}
                    disabled={isResetting}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-primary flex-1 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
                    onClick={handleReset}
                    disabled={isResetting}
                  >
                    {isResetting ? (
                      <ButtonLoading text="Deleting..." />
                    ) : (
                      <>
                        <TrashIcon className="w-5 h-5" />
                        <span>Yes, Delete Everything</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {totalDocuments === 0 && !counts && (
          <div className="card text-center text-muted">
            Click "Refresh Counts" to see current data
          </div>
        )}

        {totalDocuments === 0 && counts && (
          <div className="card text-center">
            <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p className="text-text font-semibold">No data found</p>
            <p className="text-muted text-sm mt-1">Database is already empty</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetData;

