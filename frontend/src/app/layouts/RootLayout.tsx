import React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Banner } from '../../shared/components';
import { useServerStatus } from '../../shared/hooks/useServerStatus';
import { ERROR_MESSAGES } from '../../shared/messages';

export const RootLayout: React.FC = () => {
  const { isDown } = useServerStatus();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen flex flex-col bg-[#EEEAF6] text-[#241A3F] overflow-x-hidden">
      {/* Global Server Reachability Banner */}
      {isDown && (
        <div className="sticky top-0 z-50 px-4 py-2 bg-[#FDF2F4] border-b border-[#F6DDE4]">
          <div className="max-w-7xl mx-auto">
            <Banner
              variant="error"
              title="Server connection issue"
              message={ERROR_MESSAGES.NETWORK_ERROR}
              className="py-2"
            />
          </div>
        </div>
      )}

      {/* Top Navigation Bar: Present on every page with Student and Admin links */}
      <header className="bg-[#EEEAF6] border-b border-[#E0D9F0] px-3 sm:px-8 py-3 sticky top-0 z-40 backdrop-blur-md bg-opacity-90 w-full">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-[#683DD0] to-[#4C23A8] flex items-center justify-center text-white shadow-md shadow-[#4B22A6]/20 font-bold text-base sm:text-lg font-['Poppins']">
              SA
            </div>
            <div>
              <span className="font-bold text-sm sm:text-lg text-[#241A3F] font-['Poppins'] tracking-tight block leading-tight">
                School Admission
              </span>
              <span className="text-[10px] sm:text-[11px] text-[#7A7396] font-medium hidden xs:block">
                Session 2026-2027
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Top Switcher: Student vs Admin */}
            <div className="neu-inset p-1 flex items-center gap-1 rounded-2xl">
              <NavLink
                to="/"
                end={false}
                className={() =>
                  `px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                    !isAdmin
                      ? 'bg-gradient-to-r from-[#683DD0] to-[#4C23A8] text-white shadow-sm'
                      : 'text-[#7A7396] hover:text-[#241A3F]'
                  }`
                }
              >
                Student
              </NavLink>

              <NavLink
                to="/admin"
                className={() =>
                  `px-3 sm:px-4 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                    isAdmin
                      ? 'bg-gradient-to-r from-[#683DD0] to-[#4C23A8] text-white shadow-sm'
                      : 'text-[#7A7396] hover:text-[#241A3F]'
                  }`
                }
              >
                Admin
              </NavLink>
            </div>

            {/* Dev Gallery link (Only in DEV) */}
            {import.meta.env.DEV && (
              <NavLink
                to="/dev/gallery"
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all duration-200 border ${
                    isActive
                      ? 'bg-[#E4DBF7] text-[#4B22A6] border-[#4B22A6]'
                      : 'border-[#cfc8e2] text-[#6B3FD4] hover:bg-[#E4DBF7]/50'
                  }`
                }
              >
                Gallery
              </NavLink>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col">
        <Outlet />
      </main>
    </div>
  );
};
