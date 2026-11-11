import React from 'react';
import { Card } from '../../shared/components';

export const AdminDashboardPage: React.FC = () => (
  <div className="py-2">
    <Card>
      <h2 className="text-2xl font-bold font-['Poppins'] mb-2">Admin Dashboard</h2>
      <p className="text-sm text-[#7A7396]">Placeholder for global admission statistics and overview (Section S13).</p>
    </Card>
  </div>
);

export const ManageClassesPage: React.FC = () => (
  <div className="py-2">
    <Card>
      <h2 className="text-2xl font-bold font-['Poppins'] mb-2">Manage Classes</h2>
      <p className="text-sm text-[#7A7396]">Placeholder for classes management table with Edit actions (Section S14).</p>
    </Card>
  </div>
);

export const ClassFormPage: React.FC = () => (
  <div className="py-2">
    <Card>
      <h2 className="text-2xl font-bold font-['Poppins'] mb-2">Create / Edit Class</h2>
      <p className="text-sm text-[#7A7396]">Placeholder for class name, shift selection, total seats, and live preview (Section S15).</p>
    </Card>
  </div>
);

