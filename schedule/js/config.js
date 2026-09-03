/** Shared operational config. Mirrors the live viewer’s teams, districts, and job shape. */

export const APP_NAME = 'Breathe-Easy Scheduler';
export const TODAY = '2026-08-19';

export const TEAMS = ['Josh', 'Matthew', 'Tiago', 'Nick', 'Alun', 'Iggi'];

export const TEAM_META = {
  Josh: {
    members: 'Josh + James',
    color: '#7c3aed',
    soft: '#ede9fe',
    ink: '#4c1d95',
    home: ['HKN', 'HKS', 'L-T'],
  },
  Matthew: {
    members: 'Matthew + Ken',
    color: '#0284c7',
    soft: '#e0f2fe',
    ink: '#075985',
    home: ['HKS', 'HKN', 'L-M'],
  },
  Tiago: {
    members: 'Tiago + Pedro',
    color: '#059669',
    soft: '#d1fae5',
    ink: '#064e3b',
    home: ['KLN', 'S-K', 'L-M'],
  },
  Nick: {
    members: 'Nick + Sam',
    color: '#d97706',
    soft: '#fef3c7',
    ink: '#78350f',
    home: ['KLN', 'TKO', 'S-K'],
  },
  Alun: {
    members: 'Alun + Ben',
    color: '#e11d48',
    soft: '#ffe4e6',
    ink: '#881337',
    home: ['N-T', 'N-TW', 'TKO'],
  },
  Iggi: {
    members: 'Iggi + Leo',
    color: '#4f46e5',
    soft: '#e0e7ff',
    ink: '#312e81',
    home: ['N-T', 'TKO', 'N-TW'],
  },
};

export const DISTRICTS = {
  HKN: { label: 'HK Island North', short: 'HKN', bg: '#CFE2F3', border: '#9FC5E8', text: '#1e3a5f' },
  HKS: { label: 'HK Island South', short: 'HKS', bg: '#9FC5E8', border: '#6FA8DC', text: '#1e3a5f' },
  KLN: { label: 'Kowloon', short: 'KLN', bg: '#F4CCCC', border: '#EA9999', text: '#5c1a1a' },
  'N-T': { label: 'New Territories', short: 'N-T', bg: '#FFF2CC', border: '#FFE599', text: '#5c4a00' },
  'N-TW': { label: 'Tsuen Wan / Tuen Mun', short: 'N-TW', bg: '#FCE4D6', border: '#F9CB9C', text: '#5c3a1a' },
  TKO: { label: 'Tseung Kwan O', short: 'TKO', bg: '#B6D7A8', border: '#93C47D', text: '#1e3d14' },
  'S-K': { label: 'Sai Kung', short: 'S-K', bg: '#D9EAD3', border: '#B6D7A8', text: '#1e3d14' },
  'L-T': { label: 'Lantau', short: 'L-T', bg: '#D9D2E9', border: '#B4A7D6', text: '#2e1a4a' },
  'L-M': { label: 'Lai Chi Kok / Mei Foo', short: 'L-M', bg: '#A2C4C9', border: '#76A5AF', text: '#1a3338' },
};

export const UNIT_TYPES = [
  { id: 'S' },
  { id: 'W' },
  { id: 'B' },
  { id: 'C' },
  { id: 'UC' },
  { id: 'OU' },
  { id: 'SwG' },
];

export const JOB_TYPES = [
  { id: 'cleaning', label: 'Cleaning' },
  { id: 'return', label: 'Return' },
  { id: 'influencer', label: 'Influencer' },
];

export const PAYMENTS = ['Unpaid', 'Payme', 'FPS', 'Cash', 'Visa', 'Payme / FPS'];

export const STORAGE_KEY = 'be-scheduler-v2-roster';
