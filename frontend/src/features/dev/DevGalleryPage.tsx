import React, { useState } from 'react';
import {
  Card,
  Button,
  Input,
  Pill,
  ProgressBar,
  Banner,
  Skeleton,
  EmptyState,
  CountdownRing,
} from '../../shared/components';
import { ERROR_MESSAGES } from '../../shared/messages';

export const DevGalleryPage: React.FC = () => {
  const [sampleInput, setSampleInput] = useState('20051234567890123');
  const [inputError, setInputError] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'components' | 'errors' | 'hold-designs' | 'states'>('all');

  return (
    <div className="max-w-6xl w-full mx-auto py-8 px-4 sm:px-6 flex flex-col gap-12 min-w-0 overflow-x-hidden">
      {/* Gallery Header */}
      <div className="border-b border-[#E0D9F0] pb-6 min-w-0 max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E4DBF7] text-[#4B22A6] text-xs font-bold tracking-wider uppercase mb-2">
              Dev Only Design Gallery
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold font-['Poppins'] text-[#241A3F] break-words">
              Frontend Design Foundation & Mockup Gap Gallery
            </h1>
            <p className="text-sm sm:text-base text-[#7A7396] mt-1.5 max-w-3xl">
              Preview of Tailwind v4 tokens, neumorphic surfaces, shared components, the 5 error banners, and the missing hold-page states (EXPIRED and CONFIRMED) for approval.
            </p>
          </div>
        </div>

        {/* Filter Navigation */}
        <div className="flex items-center gap-2 mt-6 overflow-x-auto pb-1 max-w-full">
          {[
            { id: 'all', label: 'Show All' },
            { id: 'components', label: '1. Shared Components' },
            { id: 'errors', label: '2. Error Banners (5 Cases)' },
            { id: 'hold-designs', label: '3. Hold Designs (Expired / Confirmed)' },
            { id: 'states', label: '4. Skeletons & Empty States' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-4 py-2 rounded-2xl text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === tab.id
                  ? 'neu-raised text-[#4B22A6]'
                  : 'text-[#7A7396] hover:text-[#241A3F]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SECTION 1: SHARED COMPONENTS */}
      {(activeTab === 'all' || activeTab === 'components') && (
        <section className="flex flex-col gap-8">
          <div className="border-l-4 border-[#683DD0] pl-4">
            <h2 className="text-2xl font-bold font-['Poppins'] text-[#241A3F]">
              1. Shared Core Components
            </h2>
            <p className="text-sm text-[#7A7396]">
              Neumorphic tokens verified against mockups: raised cards, inset inputs, gradients, and typography.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Buttons */}
            <Card className="flex flex-col gap-4">
              <h3 className="text-lg font-bold font-['Poppins']">Buttons</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="primary">Primary Action</Button>
                <Button variant="secondary">Secondary Action</Button>
                <Button variant="primary" disabled>Disabled Button</Button>
                <Button variant="primary" isLoading>Loading State</Button>
                <Button
                  variant="primary"
                  icon={
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                  }
                >
                  With Icon
                </Button>
              </div>
            </Card>

            {/* Status Pills */}
            <Card className="flex flex-col gap-4">
              <h3 className="text-lg font-bold font-['Poppins']">Status Pills (Section 11.4 Tokens)</h3>
              <div className="flex flex-wrap items-center gap-3">
                <Pill status="HELD" />
                <Pill status="CONFIRMED" />
                <Pill status="EXPIRED" />
                <Pill status="CANCELLED" />
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <Pill status="HELD" size="sm" label="10m Left" />
                <Pill status="CONFIRMED" size="sm" label="Enrolled" />
                <Pill status="EXPIRED" size="sm" label="Time Out" />
                <Pill status="CANCELLED" size="sm" label="User Cancelled" />
              </div>
            </Card>

            {/* Inputs */}
            <Card className="flex flex-col gap-4">
              <h3 className="text-lg font-bold font-['Poppins']">Inputs (Neumorphic Inset)</h3>
              <Input
                label="Student Birth Registration Number (17 digits)"
                placeholder="e.g. 20051234567890123"
                value={sampleInput}
                onChange={(e) => {
                  setSampleInput(e.target.value);
                  if (e.target.value.length !== 17 && e.target.value.length > 0) {
                    setInputError('Birth registration number must be exactly 17 digits.');
                  } else {
                    setInputError('');
                  }
                }}
                error={inputError}
                helperText="Enter the 17-digit number found on your birth certificate."
                icon={
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                }
              />
              <Input
                label="Disabled Input Field"
                value="Class 6 - Morning Shift"
                disabled
              />
            </Card>

            {/* Progress Bars */}
            <Card className="flex flex-col gap-5">
              <h3 className="text-lg font-bold font-['Poppins']">Progress & Seat Capacity Bars</h3>
              <div>
                <span className="text-xs font-semibold text-[#7A7396] block mb-1">Standard Percentage</span>
                <ProgressBar value={65} max={100} showLabel />
              </div>
              <div>
                <span className="text-xs font-semibold text-[#7A7396] block mb-1">
                  Multi-Segment Seat Distribution (Confirmed + Held + Available)
                </span>
                <ProgressBar
                  confirmed={28}
                  held={12}
                  max={50}
                  showLabel
                  height="md"
                />
              </div>
              <div>
                <span className="text-xs font-semibold text-[#7A7396] block mb-1">Full Capacity (100% Occupied)</span>
                <ProgressBar confirmed={45} held={5} max={50} showLabel height="sm" />
              </div>
            </Card>

            {/* Countdown Ring */}
            <Card className="md:col-span-2 flex flex-wrap items-center justify-around gap-6">
              <div className="flex flex-col items-center gap-2">
                <CountdownRing secondsLeft={492} totalSeconds={600} size={180} />
                <span className="text-xs font-semibold text-[#7A7396]">Active Countdown (08:12 left)</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <CountdownRing secondsLeft={0} isConfirmed size={180} />
                <span className="text-xs font-semibold text-[#1D7A4A]">Confirmed State</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <CountdownRing secondsLeft={0} isExpired size={180} />
                <span className="text-xs font-semibold text-[#B03A5B]">Expired State</span>
              </div>
            </Card>
          </div>
        </section>
      )}

      {/* SECTION 2: THE FIVE ERROR BANNERS */}
      {(activeTab === 'all' || activeTab === 'errors') && (
        <section className="flex flex-col gap-6">
          <div className="border-l-4 border-[#B03A5B] pl-4">
            <h2 className="text-2xl font-bold font-['Poppins'] text-[#241A3F]">
              2. The Five System Error Banners
            </h2>
            <p className="text-sm text-[#7A7396]">
              Every error shown in plain English with clear remediation (Requirement U5).
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {/* 1. Invalid Student ID */}
            <Banner
              variant="error"
              title="Invalid Student ID (400 INVALID_STUDENT_ID)"
              message={ERROR_MESSAGES.INVALID_STUDENT_ID}
              action={
                <Button size="sm" variant="secondary">
                  Edit ID
                </Button>
              }
            />

            {/* 2. No Seats Available */}
            <Banner
              variant="error"
              title="Class Full (409 NO_SEATS_AVAILABLE)"
              message={ERROR_MESSAGES.NO_SEATS_AVAILABLE}
              action={
                <Button size="sm" variant="secondary">
                  Browse Other Classes
                </Button>
              }
            />

            {/* 3. Hold Expired */}
            <Banner
              variant="error"
              title="Seat Hold Expired (409 HOLD_EXPIRED)"
              message={ERROR_MESSAGES.HOLD_EXPIRED}
              action={
                <Button size="sm" variant="secondary">
                  Apply Again
                </Button>
              }
            />

            {/* 4. Already Applied in Class */}
            <Banner
              variant="warning"
              title="Already Applied (409 ALREADY_APPLIED_IN_CLASS)"
              message={ERROR_MESSAGES.ALREADY_APPLIED_IN_CLASS}
              action={
                <Button size="sm" variant="secondary">
                  View My Applications
                </Button>
              }
            />

            {/* 5. Server Down */}
            <Banner
              variant="error"
              title="Server Unreachable (NETWORK_ERROR)"
              message={ERROR_MESSAGES.NETWORK_ERROR}
              action={
                <span className="inline-flex items-center gap-1.5 text-xs text-[#841935] font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#B03A5B] animate-ping" />
                  Auto-retrying
                </span>
              }
            />

            {/* Info / Notice banner example */}
            <Banner
              variant="info"
              title="Admission Notice"
              message="Online seat reservations are open for the 2026-2027 academic session. Each student may hold one seat per class."
            />
          </div>
        </section>
      )}

      {/* SECTION 3: HOLD PAGE DESIGNS (GAP DESIGNS FOR APPROVAL) */}
      {(activeTab === 'all' || activeTab === 'hold-designs') && (
        <section className="flex flex-col gap-8">
          <div className="border-l-4 border-[#1D7A4A] pl-4">
            <h2 className="text-2xl font-bold font-['Poppins'] text-[#241A3F]">
              3. Hold Page Gap Designs (EXPIRED vs CONFIRMED)
            </h2>
            <p className="text-sm text-[#7A7396]">
              The assignment mockups only showed the active countdown state. These are the completed designs for the EXPIRED and CONFIRMED states presented for user approval.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Design A: EXPIRED Hold Page */}
            <Card className="flex flex-col gap-6 border-2 border-[#F6DDE4]">
              <div className="flex items-center justify-between border-b border-[#E0D9F0] pb-4">
                <div>
                  <span className="text-xs font-bold text-[#B03A5B] uppercase tracking-wider">
                    Design Option A
                  </span>
                  <h3 className="text-xl font-bold font-['Poppins']">EXPIRED Hold Page</h3>
                </div>
                <Pill status="EXPIRED" />
              </div>

              {/* Expired Banner */}
              <Banner
                variant="error"
                title="Your seat hold has expired"
                message="The 10-minute hold window elapsed before payment was completed. The seat has automatically returned to the class pool."
              />

              {/* Expired Countdown Ring */}
              <div className="flex justify-center py-2">
                <CountdownRing secondsLeft={0} isExpired size={180} />
              </div>

              {/* Hold Details Summary */}
              <div className="neu-inset p-3.5 sm:p-4 rounded-2xl flex flex-col gap-2 text-xs sm:text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-[#7A7396]">Class:</span>
                  <span className="font-semibold text-[#241A3F]">Class 6 - Morning Shift</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-[#7A7396]">Hold Started:</span>
                  <span className="text-[#241A3F]">10 Nov, 05:40 PM</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-[#7A7396]">Expired At:</span>
                  <span className="text-[#B03A5B] font-semibold">10 Nov, 05:50 PM</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button variant="primary" fullWidth>
                  Apply Again
                </Button>
                <Button variant="secondary" fullWidth>
                  Back to Classes
                </Button>
              </div>

              {/* Disabled Pay button indicator */}
              <div className="text-center">
                <Button variant="primary" disabled fullWidth>
                  Pay admission fee (Disabled — Hold Expired)
                </Button>
                <span className="text-xs text-[#7A7396] mt-1 block">
                  Requirement U2: "Pay admission fee" disables without reload upon expiry.
                </span>
              </div>
            </Card>

            {/* Design B: CONFIRMED Hold Page */}
            <Card className="flex flex-col gap-6 border-2 border-[#D9F0E3]">
              <div className="flex items-center justify-between border-b border-[#E0D9F0] pb-4">
                <div>
                  <span className="text-xs font-bold text-[#1D7A4A] uppercase tracking-wider">
                    Design Option B
                  </span>
                  <h3 className="text-xl font-bold font-['Poppins']">CONFIRMED Hold Page</h3>
                </div>
                <Pill status="CONFIRMED" />
              </div>

              {/* Success Banner */}
              <Banner
                variant="success"
                title="Admission Confirmed!"
                message="Your admission fee has been recorded and your seat is permanently confirmed for Class 6 - Morning Shift."
              />

              {/* Confirmed Indicator */}
              <div className="flex justify-center py-2">
                <CountdownRing secondsLeft={0} isConfirmed size={180} />
              </div>

              {/* Confirmed Details Summary */}
              <div className="neu-inset p-3.5 sm:p-4 rounded-2xl flex flex-col gap-2 text-xs sm:text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-[#7A7396]">Student ID:</span>
                  <span className="font-mono font-semibold text-[#241A3F] break-all">20051234567890123</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-[#7A7396]">Class:</span>
                  <span className="font-semibold text-[#241A3F]">Class 6 - Morning Shift</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-[#7A7396]">Confirmed At:</span>
                  <span className="text-[#1D7A4A] font-semibold">10 Nov, 06:15 PM</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="text-[#7A7396]">Status:</span>
                  <span className="font-semibold text-[#1D7A4A]">Enrolled (Paid)</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button variant="primary" fullWidth>
                  View My Applications
                </Button>
                <Button variant="secondary" fullWidth>
                  Browse Other Classes
                </Button>
              </div>
            </Card>
          </div>
        </section>
      )}

      {/* SECTION 4: SKELETONS & EMPTY STATES */}
      {(activeTab === 'all' || activeTab === 'states') && (
        <section className="flex flex-col gap-8">
          <div className="border-l-4 border-[#4B22A6] pl-4">
            <h2 className="text-2xl font-bold font-['Poppins'] text-[#241A3F]">
              4. Skeletons & Empty States
            </h2>
            <p className="text-sm text-[#7A7396]">
              Visual design for data loading delays and zero-data states (Requirement U5 & Section 11.3).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Loading Skeletons */}
            <Card className="flex flex-col gap-4">
              <h3 className="text-lg font-bold font-['Poppins']">Class Card Loading Skeleton</h3>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <Skeleton variant="title" width="60%" />
                  <Skeleton variant="rect" width={70} height={24} className="rounded-full" />
                </div>
                <Skeleton variant="text" width="40%" />
                <Skeleton variant="rect" height={14} className="rounded-full mt-2" />
                <div className="flex justify-between gap-4 mt-2">
                  <Skeleton variant="text" width="30%" />
                  <Skeleton variant="text" width="30%" />
                </div>
                <Skeleton variant="rect" height={44} className="rounded-2xl mt-3" />
              </div>
            </Card>

            {/* Empty State: No Active Hold */}
            <EmptyState
              title="No Active Seat Hold"
              description="You do not currently have any active seat holds. Explore available classes to apply for admission."
              action={
                <Button variant="primary" size="sm">
                  Browse Available Classes
                </Button>
              }
            />

            {/* Empty State: No Applications */}
            <div className="md:col-span-2">
              <EmptyState
                title="No Applications Found"
                description="You haven't submitted any admission applications yet. Once you apply, your active holds and confirmations will appear here."
                icon={
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                }
                action={
                  <Button variant="primary">
                    Find a Class
                  </Button>
                }
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
