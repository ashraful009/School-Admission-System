import { apiClient } from './client';

export interface AdmissionClassDto {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
  holdDurationSeconds: number;
}

export interface StudentHoldDto {
  holdId: string;
  classId: string;
  className: string;
  status: 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  createdAt: string;
  confirmedAt: string | null;
  serverTime: string;
}

export interface CreateHoldResponseDto {
  holdId: string;
  classId: string;
  studentId: string;
  status: 'HELD';
  expiresAt: string;
  className: string;
  createdAt: string;
  serverTime: string;
}

export interface HoldDetailsDto {
  holdId: string;
  classId: string;
  status: 'HELD' | 'CONFIRMED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  className: string;
  createdAt: string;
  confirmedAt: string | null;
  serverTime: string;
}

export interface ConfirmHoldResponseDto {
  holdId: string;
  status: 'CONFIRMED';
  classId: string;
  confirmedAt: string;
}

export interface CreateClassRequestDto {
  name: string;
  totalSeats: number;
}

export interface CreateClassResponseDto {
  id: string;
  name: string;
  totalSeats: number;
}

export interface UpdateClassRequestDto {
  name: string;
  totalSeats: number;
}

/**
 * Create a new admission class (A1)
 */
export async function createClass(data: CreateClassRequestDto): Promise<CreateClassResponseDto> {
  return apiClient<CreateClassResponseDto>('/classes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Update an existing admission class (A9)
 */
export async function updateClass(classId: string, data: UpdateClassRequestDto): Promise<AdmissionClassDto> {
  return apiClient<AdmissionClassDto>(`/classes/${classId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/**
 * Fetch all admission classes (A2)
 */
export async function fetchClasses(): Promise<AdmissionClassDto[]> {
  return apiClient<AdmissionClassDto[]>('/classes');
}

/**
 * Fetch a single admission class by id (A3)
 */
export async function fetchClassById(classId: string): Promise<AdmissionClassDto> {
  return apiClient<AdmissionClassDto>(`/classes/${classId}`);
}

/**
 * Fetch a single hold by holdId (A5)
 */
export async function fetchHoldById(holdId: string): Promise<HoldDetailsDto> {
  return apiClient<HoldDetailsDto>(`/holds/${holdId}`);
}

/**
 * Confirm a seat hold (simulated payment) (A6)
 */
export async function confirmHold(holdId: string, studentId?: string): Promise<ConfirmHoldResponseDto> {
  return apiClient<ConfirmHoldResponseDto>(`/holds/${holdId}/confirm`, {
    method: 'POST',
    studentId,
  });
}

/**
 * Cancel a seat hold (A7)
 */
export async function cancelHold(holdId: string, studentId?: string): Promise<void> {
  return apiClient<void>(`/holds/${holdId}`, {
    method: 'DELETE',
    studentId,
  });
}

/**
 * Fetch all holds for the current student (A8)
 */
export async function fetchMyHolds(studentId?: string): Promise<StudentHoldDto[]> {
  return apiClient<StudentHoldDto[]>('/me/holds', { studentId });
}

/**
 * Apply to hold a seat in a class (A4)
 */
export async function createHold(classId: string): Promise<CreateHoldResponseDto> {
  return apiClient<CreateHoldResponseDto>(`/classes/${classId}/holds`, {
    method: 'POST',
  });
}

