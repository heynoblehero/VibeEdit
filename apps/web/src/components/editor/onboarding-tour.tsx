"use client";

import { useState, useEffect } from "react";

const TOUR_STEPS = [
  {
    title: "Welcome to VibeEdit!",
    description: "This is your AI video editor. Describe what you want, and the AI builds it for you.",
    highlight: "chat",
  },
  {
    title: "Attach your media",
    description: "Click the paperclip icon or drag files into the chat to add videos, images, and audio to your project.",
    highlight: "input",
  },
  {
    title: "Watch the preview",
    description: "Your video preview updates in real-time as the AI makes changes. Click Render when you're ready to export.",
    highlight: "preview",
  },
];

export function OnboardingTour() {
  const [step, setStep] = useState(-1); // -1 = not showing
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const seen = localStorage.getItem("vibeedit-tour-seen");
    if (!seen) {
      setDismissed(false);
      setStep(0);
    }
  }, []);

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem("vibeedit-tour-seen", "true");
  };

  const next = () => {
    if (step >= TOUR_STEPS.length - 1) {
      dismiss();
    } else {
      setStep(step + 1);
    }
  };

  if (dismissed || step < 0) return null;

  const current = TOUR_STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-sm mx-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs text-muted-foreground">{step + 1} of {TOUR_STEPS.length}</span>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{current.title}</h3>
        <p className="text-sm text-muted-foreground mb-5">{current.description}</p>
        <div className="flex items-center justify-between">
          <button onClick={dismiss} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Skip tour
          </button>
          <button
            onClick={next}
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {step >= TOUR_STEPS.length - 1 ? "Get Started" : "Next"}
          </button>
        </div>
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mt-4">
          {TOUR_STEPS.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === step ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
