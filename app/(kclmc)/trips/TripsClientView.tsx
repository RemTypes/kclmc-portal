'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { Trip } from '@/types/database';

interface TripsClientViewProps {
  initialTrips: Trip[];
}

export default function TripsClientView({ initialTrips }: TripsClientViewProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);

  const categories = [
    { id: 'all', label: 'All Meets' },
    { id: 'trad', label: 'Trad Climbing' },
    { id: 'sport', label: 'Sport Climbing' },
    { id: 'winter', label: 'Winter Expeditions' },
    { id: 'social', label: 'Social Wall Sessions' },
  ];

  const filteredTrips = initialTrips.filter((trip) => {
    if (selectedCategory === 'all') return true;
    return trip.trip_type === selectedCategory;
  });

  return (
    <div className="min-h-screen bg-[#041F1E] text-[#F7F7F7] p-6 md:p-12 relative overflow-hidden font-sans topo-pattern">
      <div className="max-w-6xl mx-auto relative z-10 py-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-8 border-b border-[#084746]">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#084746] border border-[#FFBD59]/40 text-[#FFBD59] text-xs font-mono uppercase tracking-widest mb-3">
              <span>🏔️</span>
              <span>2026/27 Outdoor Calendar</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black font-heading uppercase tracking-tight text-[#FFBD59]">
              Meets &amp; Expeditions
            </h1>
            <p className="text-zinc-300 text-sm md:text-base mt-2 max-w-2xl font-sans">
              From weekly London bouldering sessions to Scottish Winter gullies and Dorset sea cliffs. Sign up for upcoming club meets via official secretary Google Forms below.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/membership/bmc"
              className="px-4 py-2.5 bg-[#084746] hover:bg-[#0b5c5b] text-[#FFBD59] font-mono text-xs font-bold uppercase rounded-xl border border-[#FFBD59]/40 transition-colors inline-flex items-center gap-1.5 shadow"
            >
              <span>🛡️</span>
              <span>BMC Insurance Guide →</span>
            </Link>
            <Link
              href="/membership"
              className="px-4 py-2.5 bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] font-mono text-xs font-bold uppercase rounded-xl transition-colors shadow"
            >
              Get KCLSU Pass →
            </Link>
          </div>
        </div>

        {/* Safety & Prerequisite Notice */}
        <div className="bg-[#052322] border border-[#FFBD59]/30 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">🎫</span>
            <div className="text-xs font-sans">
              <strong className="text-white block font-heading uppercase tracking-wide text-sm mb-0.5">
                KCLSU Recreational Pass Required for Outdoor Rock
              </strong>
              <p className="text-zinc-300">
                All members attending outdoor trips must hold an active £45 Recreational Pass (includes £15M BMC civil liability insurance). For high-consequence mountain trips, we also recommend the Austrian Alpine Club (AAC).
              </p>
            </div>
          </div>
          <Link
            href="/membership/bmc"
            className="shrink-0 text-xs font-mono text-[#FFBD59] hover:underline font-bold self-end sm:self-center"
          >
            Learn about BMC &amp; AAC Cover →
          </Link>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-mono uppercase tracking-wider font-bold transition-all ${
                selectedCategory === cat.id
                  ? 'bg-[#FFBD59] text-[#052322] shadow-md'
                  : 'bg-[#052322] text-zinc-400 hover:text-white border border-[#084746] hover:border-[#FFBD59]/40'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Trips Grid / List */}
        <div className="space-y-4 mb-16">
          {filteredTrips.length === 0 ? (
            <div className="text-center py-16 bg-[#052322] rounded-3xl border border-[#084746] p-8">
              <div className="text-4xl mb-3">🧗</div>
              <h3 className="text-lg font-heading uppercase text-white font-bold mb-1">
                No meets scheduled in this category yet
              </h3>
              <p className="text-xs text-zinc-400 font-sans max-w-md mx-auto">
                Check back soon or follow @kclmc on Instagram for pop-up weekend sessions and weather announcements.
              </p>
            </div>
          ) : (
            filteredTrips.map((trip) => {
              const formattedPrice = trip.price_pence === 0 ? 'FREE' : `£${(trip.price_pence / 100).toFixed(2)}`;
              const googleFormLink = trip.google_form_url;

              return (
                <div
                  key={trip.id}
                  className="bg-[#052322] border border-[#084746] hover:border-[#FFBD59]/50 rounded-2xl p-6 transition-all shadow-md hover:shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group"
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded bg-[#084746] text-[#FFBD59] border border-[#FFBD59]/30 font-bold">
                        {trip.trip_type}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#041F1E] text-emerald-400 border border-emerald-500/20 font-bold">
                        {formattedPrice}
                      </span>
                      {trip.difficulty_grade && (
                        <span className="text-[10px] font-mono text-zinc-400">
                          Grade: {trip.difficulty_grade}
                        </span>
                      )}
                    </div>

                    <h2 className="text-2xl font-bold font-heading uppercase tracking-wide text-white group-hover:text-[#FFBD59] transition-colors">
                      {trip.title}
                    </h2>
                    
                    <p className="text-zinc-300 text-xs mt-1.5 font-sans line-clamp-2 max-w-3xl leading-relaxed">
                      {trip.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-mono text-zinc-400">
                      <span>🗓️ {trip.date_start}{trip.date_end && trip.date_end !== trip.date_start ? ` → ${trip.date_end}` : ''}</span>
                      <span>📍 {trip.location.split(',')[0]}</span>
                      {trip.max_capacity && (
                        <span>👥 Cap: {trip.max_capacity}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap sm:flex-col items-start sm:items-end gap-2.5 shrink-0 w-full sm:w-auto">
                    {googleFormLink ? (
                      <a
                        href={googleFormLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-5 py-2.5 bg-[#FFBD59] hover:bg-[#FFE0A3] text-[#052322] font-mono font-bold text-xs uppercase tracking-wider rounded-xl transition-colors shadow text-center inline-flex items-center justify-center gap-1.5"
                      >
                        <span>Register via Google Form</span>
                        <span>↗</span>
                      </a>
                    ) : trip.price_pence === 0 ? (
                      <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-3 py-1.5 rounded-lg border border-emerald-500/30">
                        Drop-in (No Form Required)
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-zinc-400 bg-[#041F1E] px-3 py-1.5 rounded-lg border border-[#084746]">
                        Form Opening Soon
                      </span>
                    )}

                    <button
                      onClick={() => setSelectedTrip(trip)}
                      className="w-full sm:w-auto px-4 py-2 rounded-xl border border-zinc-700 hover:border-[#FFBD59]/40 text-zinc-300 hover:text-white font-mono text-xs uppercase transition-colors text-center inline-flex items-center justify-center gap-1"
                    >
                      <span>View Dossier &amp; Itinerary</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Link */}
        <div className="pt-6 border-t border-[#084746] flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono text-zinc-400">
          <Link href="/" className="hover:text-[#FFBD59] transition-colors flex items-center gap-1">
            <span>←</span>
            <span>Back to Home</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/guides" className="hover:text-[#FFBD59] transition-colors">
              London Climbing Beta ↗
            </Link>
            <Link href="/membership/bmc" className="hover:text-[#FFBD59] transition-colors">
              BMC Insurance Details ↗
            </Link>
          </div>
        </div>

      </div>

      {/* Trip Details Modal / Dossier */}
      {selectedTrip && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#052322] border-2 border-[#FFBD59]/60 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 shadow-2xl relative topo-pattern">
            {/* Close button */}
            <button
              onClick={() => setSelectedTrip(null)}
              className="absolute top-5 right-5 text-zinc-400 hover:text-white text-xl font-bold bg-[#041F1E] w-8 h-8 rounded-full border border-[#FFBD59]/30 flex items-center justify-center transition-colors"
            >
              ✕
            </button>

            {/* Modal Header */}
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs uppercase font-mono px-2.5 py-0.5 rounded bg-[#084746] text-[#FFBD59] border border-[#FFBD59]/30 font-bold">
                  {selectedTrip.trip_type}
                </span>
                <span className="text-xs font-mono uppercase bg-[#041F1E] text-emerald-400 px-2.5 py-0.5 rounded border border-emerald-500/20 font-bold">
                  {selectedTrip.price_pence === 0 ? 'FREE' : `£${(selectedTrip.price_pence / 100).toFixed(2)}`}
                </span>
                <span className="text-xs font-mono text-zinc-300">
                  Status: {selectedTrip.status}
                </span>
              </div>
              <h2 className="text-3xl font-black font-heading uppercase tracking-wide text-white mb-2">
                {selectedTrip.title}
              </h2>
              <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                {selectedTrip.description}
              </p>
            </div>

            {/* Key Information Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6 font-mono text-xs">
              <div className="bg-[#041F1E] p-3 rounded-xl border border-[#FFBD59]/20">
                <span className="text-zinc-500 block text-[10px] uppercase">Dates</span>
                <span className="text-[#FFBD59] font-bold">
                  {selectedTrip.date_start}{selectedTrip.date_end && selectedTrip.date_end !== selectedTrip.date_start ? ` to ${selectedTrip.date_end}` : ''}
                </span>
              </div>
              <div className="bg-[#041F1E] p-3 rounded-xl border border-[#FFBD59]/20">
                <span className="text-zinc-500 block text-[10px] uppercase">Difficulty</span>
                <span className="text-white font-bold">{selectedTrip.difficulty_grade || 'All levels'}</span>
              </div>
              <div className="bg-[#041F1E] p-3 rounded-xl border border-[#FFBD59]/20">
                <span className="text-zinc-500 block text-[10px] uppercase">Capacity</span>
                <span className="text-emerald-400 font-bold">
                  {selectedTrip.max_capacity} Climbers
                </span>
              </div>
            </div>

            {/* Location & Directions */}
            <div className="mb-6 bg-[#041F1E] p-4 rounded-xl border border-[#FFBD59]/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <span className="text-zinc-500 block text-[10px] uppercase font-mono">Location</span>
                <span className="text-sm font-sans text-white">{selectedTrip.location}</span>
              </div>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(selectedTrip.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-[#FFBD59] hover:underline flex items-center gap-1 shrink-0 font-bold"
              >
                <span>Google Maps</span>
                <span>↗</span>
              </a>
            </div>

            {/* Expedition Itinerary */}
            {selectedTrip.itinerary && selectedTrip.itinerary.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-mono uppercase font-bold text-[#FFBD59] mb-3">
                  Expedition Itinerary
                </h3>
                <ul className="space-y-2 text-xs font-mono">
                  {selectedTrip.itinerary.map((step: string, i: number) => (
                    <li key={i} className="flex items-start gap-2.5 text-zinc-300 bg-[#041F1E]/60 p-2.5 rounded-lg border border-[#FFBD59]/10">
                      <span className="text-[#FFBD59] font-bold">0{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Required Gear Checklist */}
            {selectedTrip.gear_requirements && selectedTrip.gear_requirements.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-mono uppercase font-bold text-[#FFBD59] mb-3">
                  Required Gear Checklist
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  {selectedTrip.gear_requirements.map((gear: string, i: number) => (
                    <label key={i} className="flex items-center gap-2 p-2 rounded-lg bg-[#041F1E]/60 border border-[#FFBD59]/10 text-zinc-300 cursor-pointer hover:bg-[#041F1E]">
                      <input type="checkbox" className="accent-[#FFBD59] rounded" />
                      <span>{gear}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Registration Callout Note */}
            <div className="p-4 rounded-xl bg-[#084746]/40 border border-[#FFBD59]/20 text-xs font-sans text-zinc-300 mb-6">
              <span className="text-[#FFBD59] font-bold uppercase font-mono block mb-1">
                📋 Registration via Trip Secretary Form:
              </span>
              Registration for official club meets is processed via Google Forms managed by our trip secretaries. An active KCLSU Recreational membership pass is required to participate.
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-[#FFBD59]/20 flex flex-col sm:flex-row gap-3 justify-end items-center">
              <button
                onClick={() => setSelectedTrip(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-zinc-700 text-zinc-300 hover:bg-zinc-800 font-mono text-xs uppercase"
              >
                Close
              </button>

              {selectedTrip.google_form_url ? (
                <a
                  href={selectedTrip.google_form_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-mono text-xs uppercase font-bold bg-[#FFBD59] text-[#052322] hover:bg-[#FFE0A3] transition-all shadow text-center inline-flex items-center justify-center gap-1.5"
                >
                  <span>Register via Google Form ↗</span>
                </a>
              ) : selectedTrip.price_pence === 0 ? (
                <span className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-mono text-xs uppercase font-bold bg-[#084746] text-[#FFBD59] text-center border border-[#FFBD59]/30">
                  Drop-In (No Booking Needed)
                </span>
              ) : (
                <span className="w-full sm:w-auto px-6 py-2.5 rounded-xl font-mono text-xs uppercase font-bold bg-zinc-800 text-zinc-400 text-center border border-zinc-700">
                  Sign-up Form Opening Soon
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
