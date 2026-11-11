import React, { useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { clearStoredStudentId, getStoredStudentId } from '../../api/client';

export const StudentLayout: React.FC = () => {
  const [studentId, setStudentId] = useState<string | null>(getStoredStudentId());
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleIdChange = () => {
      setStudentId(getStoredStudentId());
    };
    window.addEventListener('student-id-changed', handleIdChange);
    window.addEventListener('storage', handleIdChange);
    return () => {
      window.removeEventListener('student-id-changed', handleIdChange);
      window.removeEventListener('storage', handleIdChange);
    };
  }, []);

  const handleChangeId = () => {
    clearStoredStudentId();
    navigate('/identity');
  };

  // Route guard: student pages redirect to Identity when no ID is stored (Requirement B4, Mockup correction 11)
  if (!studentId && location.pathname !== '/identity') {
    return <Navigate to="/identity" replace />;
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* Student Sub-Header Navigation Bar */}
      <nav className="bg-[#EEEAF6] px-4 sm:px-8 py-3 border-b border-[#E0D9F0]/70">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Navigation Links (Mockup correction 11: nav items show before an ID exists) */}
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-4 py-2 rounded-2xl text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                  isActive && location.pathname !== '/identity'
                    ? 'neu-raised text-[#4B22A6]'
                    : 'text-[#7A7396] hover:text-[#241A3F]'
                }`
              }
            >
              Classes
            </NavLink>

            <NavLink
              to="/my-applications"
              className={({ isActive }) =>
                `px-4 py-2 rounded-2xl text-sm font-semibold transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'neu-raised text-[#4B22A6]'
                    : 'text-[#7A7396] hover:text-[#241A3F]'
                }`
              }
            >
              My applications
            </NavLink>
          </div>

          {/* Student ID Chip with Change button (Requirement B4) */}
          <div className="flex items-center self-end sm:self-auto">
            {studentId ? (
              <div className="neu-card px-3.5 py-1.5 rounded-2xl flex items-center gap-2.5 text-xs sm:text-sm">
                <div className="flex items-center gap-1.5 text-[#241A3F] font-medium">
                  <span className="w-2 h-2 rounded-full bg-[#1D7A4A]" />
                  <span className="text-[#7A7396] font-normal">Student ID:</span>
                  <span className="font-mono font-semibold tracking-wider">{studentId}</span>
                </div>
                <button
                  type="button"
                  onClick={handleChangeId}
                  className="text-xs font-semibold text-[#683DD0] hover:text-[#4B22A6] underline cursor-pointer ml-1 transition-colors"
                  title="Change student ID"
                >
                  Change
                </button>
              </div>
            ) : (
              <NavLink
                to="/identity"
                className="neu-btn-secondary px-3.5 py-1.5 text-xs font-semibold text-[#4B22A6] inline-flex items-center gap-1.5"
              >
                <span className="w-2 h-2 rounded-full bg-[#B03A5B]" />
                <span>Enter Student ID</span>
              </NavLink>
            )}
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8">
        <Outlet />
      </div>
    </div>
  );
};
