import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

export const AdminLayout: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col md:flex-row max-w-7xl w-full mx-auto p-4 sm:p-8 gap-6">
      {/* Left Sidebar */}
      <aside className="w-full md:w-64 shrink-0">
        <div className="neu-card p-4 sm:p-6 sticky top-24 flex flex-col gap-4">
          <div className="border-b border-[#E0D9F0] pb-3">
            <span className="text-xs font-bold text-[#7A7396] tracking-wider uppercase font-['Poppins']">
              Admin Portal
            </span>
            <h3 className="text-lg font-bold text-[#241A3F] font-['Poppins']">Management</h3>
          </div>

          <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto pb-1 md:pb-0">
            <NavLink
              to="/admin"
              end
              className={({ isActive }) =>
                `px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 flex items-center gap-3 whitespace-nowrap ${
                  isActive
                    ? 'neu-raised text-[#4B22A6] font-bold'
                    : 'text-[#7A7396] hover:text-[#241A3F] hover:bg-white/40'
                }`
              }
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/admin/classes"
              end
              className={({ isActive }) =>
                `px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 flex items-center gap-3 whitespace-nowrap ${
                  isActive
                    ? 'neu-raised text-[#4B22A6] font-bold'
                    : 'text-[#7A7396] hover:text-[#241A3F] hover:bg-white/40'
                }`
              }
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <span>Manage classes</span>
            </NavLink>

            <NavLink
              to="/admin/classes/new"
              className={({ isActive }) =>
                `px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-200 flex items-center gap-3 whitespace-nowrap ${
                  isActive
                    ? 'neu-raised text-[#4B22A6] font-bold'
                    : 'text-[#7A7396] hover:text-[#241A3F] hover:bg-white/40'
                }`
              }
            >
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span>Create class</span>
            </NavLink>
          </nav>
        </div>
      </aside>

      {/* Main Admin Area */}
      <section className="flex-1 min-w-0">
        <Outlet />
      </section>
    </div>
  );
};

