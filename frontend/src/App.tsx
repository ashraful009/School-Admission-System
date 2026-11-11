import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { router } from './app/router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export const App: React.FC = () => {
  React.useEffect(() => {
    // When backend recovers after being unreachable, invalidate all active queries
    // so every screen recovers instantly without requiring a manual page reload.
    const handleRecovered = () => {
      queryClient.invalidateQueries();
    };
    window.addEventListener('server-recovered', handleRecovered);
    return () => {
      window.removeEventListener('server-recovered', handleRecovered);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
};

export default App;
