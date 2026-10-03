import { useEffect, useState } from 'react';
import { SERVER_STATUS_EVENT } from '../../services/apiClient';

const ServerStatusBanner = () => {
  const [serverStatus, setServerStatus] = useState({ waking: false, unreachable: false });

  useEffect(() => {
    const handleStatus = (event) => setServerStatus(event.detail);
    window.addEventListener(SERVER_STATUS_EVENT, handleStatus);
    return () => window.removeEventListener(SERVER_STATUS_EVENT, handleStatus);
  }, []);

  if (!serverStatus.waking && !serverStatus.unreachable) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-3 px-4 py-2 text-sm bg-yellow-500/90 text-black shadow"
      role="status"
    >
      {serverStatus.waking ? (
        <span>Waking up the server... free hosting sleeps when idle, this can take up to a minute.</span>
      ) : (
        <>
          <span>Can&apos;t reach the server right now. It may still be waking up; wait a few seconds, then retry.</span>
          <button
            className="underline font-medium"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </>
      )}
    </div>
  );
};

export default ServerStatusBanner;
