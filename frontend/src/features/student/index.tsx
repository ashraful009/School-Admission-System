import React from 'react';
import { Card } from '../../shared/components';

export { StudentIdentityPage } from './StudentIdentityPage';

export const StudentDashboardPage: React.FC = () => (
  <div className="py-6">
    <Card>
      <h2 className="text-2xl font-bold font-['Poppins'] mb-2">Student Classes Dashboard</h2>
      <p className="text-sm text-[#7A7396]">Placeholder for classes list, seat counters, and quick apply (Section S9).</p>
    </Card>
  </div>
);

export const ClassDetailsPage: React.FC = () => (
  <div className="py-6">
    <Card>
      <h2 className="text-2xl font-bold font-['Poppins'] mb-2">Class Details</h2>
      <p className="text-sm text-[#7A7396]">Placeholder for class seat breakdown and hold initiation (Section S10).</p>
    </Card>
  </div>
);

export const HoldApplicationPage: React.FC = () => (
  <div className="py-6">
    <Card>
      <h2 className="text-2xl font-bold font-['Poppins'] mb-2">Application / Hold Status</h2>
      <p className="text-sm text-[#7A7396]">Placeholder for live countdown ring, simulated fee payment, and cancel (Section S11).</p>
    </Card>
  </div>
);

export const MyApplicationsPage: React.FC = () => (
  <div className="py-6">
    <Card>
      <h2 className="text-2xl font-bold font-['Poppins'] mb-2">My Applications</h2>
      <p className="text-sm text-[#7A7396]">Placeholder for student application history with status pills (Section S12).</p>
    </Card>
  </div>
);
