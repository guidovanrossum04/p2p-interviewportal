import React from 'react';

const videoInterviewTips = [
  {
    title: 'Test your technology beforehand',
    description: 'Check your internet connection, camera, lighting, microphone, and interview software ahead of time. Make sure your device is charged.',
    icon: 'settings_input_antenna',
  },
  {
    title: 'Do a practice run',
    description: 'Record a short test to check your framing, sound, lighting, and background, and fix any distractions before the interview.',
    icon: 'videocam',
  },
  {
    title: 'Dress presentably',
    description: 'Wear professional interview attire, as you would for an in-person interview.',
    icon: 'checkroom',
  },
  {
    title: 'Look at the camera when answering',
    description: 'Speak toward the camera to create a natural sense of eye contact. If helpful, place brief notes near the camera.',
    icon: 'center_focus_strong',
  },
  {
    title: 'Keep background noise to a minimum',
    description: 'Choose a quiet room where you are unlikely to be interrupted, and turn off music or other sources of noise.',
    icon: 'volume_off',
  },
  {
    title: 'Prepare beforehand',
    description: 'Review your résumé and the job description, research the employer, and practise answers to likely interview questions.',
    icon: 'menu_book',
  },
];

export const CandidatePrepGuidelinesView: React.FC = () => (
  <main className="mx-auto max-w-4xl space-y-6">
    <header className="rounded-2xl border border-[#E8E5E1] bg-white p-6 shadow-xs">
      <h2 className="text-2xl font-bold text-[#101010]">Prep &amp; Guidelines</h2>
      <p className="mt-1 text-xs text-red-900/60">Use these six tips to prepare for a confident and successful video interview.</p>
    </header>

    <section className="space-y-4 rounded-2xl border border-[#E8E5E1] bg-white p-6 shadow-xs">
      <div>
        <h3 className="text-base font-bold text-[#101010]">6 tips for video interview success</h3>
        <p className="mt-1 text-sm text-[#5A5550]">A little preparation can help you feel comfortable and make a strong impression.</p>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2">
        {videoInterviewTips.map((tip, index) => (
          <li key={tip.title} className="flex gap-3 rounded-xl border border-[#E8E5E1] bg-[#FAF9F7] p-4">
            <span className="material-symbols-outlined mt-0.5 text-xl text-red-600" aria-hidden="true">{tip.icon}</span>
            <div>
              <h4 className="text-sm font-bold text-[#101010]">{index + 1}. {tip.title}</h4>
              <p className="mt-1 text-xs leading-relaxed text-[#5A5550]">{tip.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>

  </main>
);
