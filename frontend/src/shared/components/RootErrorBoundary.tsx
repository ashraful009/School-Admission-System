import React from 'react';
import { useRouteError, isRouteErrorResponse, Link } from 'react-router-dom';
import { Card } from './Card';
import { Button } from './Button';

export const RootErrorBoundary: React.FC = () => {
  const error = useRouteError();

  let title = 'Something went wrong';
  let message = 'An unexpected error occurred while loading this page. Please try again.';

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = 'Page Not Found';
      message = "The page you are looking for doesn't exist or has moved.";
    } else {
      title = `Error ${error.status}`;
      message = error.statusText || message;
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#EEEAF6] text-[#241A3F]">
      <Card padding="lg" className="max-w-md w-full text-center flex flex-col items-center gap-5">
        <div className="w-14 h-14 rounded-2xl bg-[#F6DDE4] flex items-center justify-center text-[#B03A5B] shadow-inner">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-['Poppins'] text-[#241A3F]">{title}</h1>
          <p className="text-sm text-[#7A7396] mt-2 leading-relaxed">{message}</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full pt-2">
          <Button variant="primary" fullWidth onClick={() => window.location.reload()}>
            Reload Page
          </Button>
          <Link to="/" className="w-full">
            <Button variant="secondary" fullWidth>
              Return Home
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
};

