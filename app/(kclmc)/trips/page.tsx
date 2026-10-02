import React from 'react';
import { getTrips } from '@/lib/db';
import TripsClientView from './TripsClientView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Meets & Expeditions | King\'s College London Mountaineering Club',
  description: 'Outdoor rock climbing meets, Scottish winter expeditions, and weekly social climbing sessions for King\'s College London students.',
};

export default async function TripsPage() {
  const trips = await getTrips();
  return <TripsClientView initialTrips={trips} />;
}
