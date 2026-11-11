import { useEffect, useState } from 'react';
import { isServerReachable, subscribeServerStatus } from '../../api/client';

export function useServerStatus() {
  const [isDown, setIsDown] = useState<boolean>(!isServerReachable());

  useEffect(() => {
    const unsub = subscribeServerStatus((down) => {
      setIsDown(down);
    });
    return unsub;
  }, []);

  return { isDown };
}

