import { useEffect, useState } from 'react';
import { getStatus } from '../api';

export function useStatus(intervalMs = 2000) {
  const [status, setStatus]   = useState(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let id;
    async function poll() {
      try {
        setStatus(await getStatus());
        setOffline(false);
        id = setTimeout(poll, intervalMs);
      } catch {
        setOffline(true);
        id = setTimeout(poll, 10000);
      }
    }
    poll();
    return () => clearTimeout(id);
  }, [intervalMs]);

  return { status, offline };
}
