import { createBrowserRouter, Navigate } from 'react-router-dom';
import { RootLayout } from './layouts/RootLayout';
import { StudentLayout } from './layouts/StudentLayout';
import { AdminLayout } from './layouts/AdminLayout';
import { RootErrorBoundary } from '../shared/components';

// Student feature placeholders
import {
  StudentIdentityPage,
  StudentDashboardPage,
  ClassDetailsPage,
  HoldApplicationPage,
  MyApplicationsPage,
} from '../features/student';

// Admin feature placeholders
import {
  AdminDashboardPage,
  ManageClassesPage,
  ClassFormPage,
} from '../features/admin';

// Dev gallery
import { DevGalleryPage } from '../features/dev/DevGalleryPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RootErrorBoundary />,
    children: [
      // Student portal layout
      {
        element: <StudentLayout />,
        children: [
          {
            index: true,
            element: <StudentDashboardPage />,
          },
          {
            path: 'identity',
            element: <StudentIdentityPage />,
          },
          {
            path: 'classes/:classId',
            element: <ClassDetailsPage />,
          },
          {
            path: 'holds/:holdId',
            element: <HoldApplicationPage />,
          },
          {
            path: 'my-applications',
            element: <MyApplicationsPage />,
          },
        ],
      },
      // Admin portal layout
      {
        path: 'admin',
        element: <AdminLayout />,
        children: [
          {
            index: true,
            element: <AdminDashboardPage />,
          },
          {
            path: 'classes',
            element: <ManageClassesPage />,
          },
          {
            path: 'classes/new',
            element: <ClassFormPage />,
          },
          {
            path: 'classes/:classId/edit',
            element: <ClassFormPage />,
          },
        ],
      },
      // Dev-only gallery (only available in development)
      ...(import.meta.env.DEV
        ? [
            {
              path: 'dev/gallery',
              element: <DevGalleryPage />,
            },
          ]
        : []),
      // Catch-all redirect to root
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);

