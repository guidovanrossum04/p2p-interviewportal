import React from 'react';

const interviewQuestions = [
  'Please tell me a little bit about yourself? For example, who you are, your employment history and your current achievements?',
  'Tell me about a time that you provided outstanding customer service?',
  'How would you deal with a difficult patient?',
  'If you were in a situation where you could not read the prescription, what would you do?',
  'Describe a clinical intervention that you have made?',
  'The role as a pharmacist requires you to lead and manage your team. Describe to me how you will lead and manage your team effectively?',
];

const reminders = [
  'Please review all the questions and prepare your answers before you attempt to complete the video interview.',
  'I would prefer to discuss the video interview with you so that you are going to be best prepared to complete it.',
  'Do not complete the interview if you have poor internet access.',
  'I will be sending you a separate email with a link in coming weeks to complete the video interview once I have deemed that you are ready, so please keep an eye on your junk mail or spam box just in case it lands in there.',
  'If you have any questions please don’t hesitate to give me a call or send me a message via WhatsApp.',
];

export const CandidatePrepGuidelinesView: React.FC = () => (
  <main className="mx-auto max-w-4xl space-y-6">
    <header className="rounded-2xl border border-[#F5DADB] bg-white p-6 shadow-xs">
      <h2 className="text-2xl font-bold text-[#1F1617]">Prep &amp; Guidelines</h2>
      <p className="mt-1 text-xs text-red-900/60">Review these questions and reminders before your video interview.</p>
    </header>

    <section className="space-y-4 rounded-2xl border border-[#F5DADB] bg-white p-6 shadow-xs">
      <h3 className="text-base font-bold text-[#1F1617]">Things to remember</h3>
      <p className="text-sm text-[#4B5563]">The following are the questions that will be asked of you.</p>
      <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-[#1F1617]">
        {interviewQuestions.map((question) => <li key={question}>{question}</li>)}
      </ol>
    </section>

    <section className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/60 p-6">
      <h3 className="text-base font-bold text-amber-950">Before you complete the interview</h3>
      <ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed text-amber-950">
        {reminders.map((reminder) => <li key={reminder}>{reminder}</li>)}
      </ul>
    </section>
  </main>
);
