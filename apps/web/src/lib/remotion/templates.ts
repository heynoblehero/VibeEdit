export interface RemotionTemplate {
  id: string;
  name: string;
  description: string;
  category:
    | "intro"
    | "lower-third"
    | "transition"
    | "overlay"
    | "outro"
    | "social";
  defaultDuration: number; // seconds
  code: string; // React.createElement code (no JSX)
  customizableProps: string[]; // Which props the AI can customize
}

export const TEMPLATES: RemotionTemplate[] = [
  {
    id: "youtube-intro",
    name: "YouTube Intro",
    description: "Animated channel name with subscribe prompt",
    category: "intro",
    defaultDuration: 4,
    customizableProps: ["channelName", "tagline", "color"],
    code: `({ frame, fps, width, height }) => {
  const channelName = "My Channel";
  const tagline = "Subscribe for more!";
  const color = "#C96442";
  const progress = Math.min(frame / (fps * 0.5), 1);
  const scale = 0.5 + progress * 0.5;
  const opacity = progress;
  const taglineOpacity = Math.max(0, (frame - fps * 1) / (fps * 0.5));
  const shimmer = Math.sin(frame / fps * 3) * 0.1 + 0.9;
  return React.createElement("div", {
    style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "radial-gradient(circle, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.8) 100%)" }
  },
    React.createElement("h1", {
      style: { fontSize: 72, fontWeight: "bold", color: "white", opacity: opacity * shimmer, transform: "scale(" + scale + ")", textShadow: "0 4px 30px " + color }
    }, channelName),
    React.createElement("p", {
      style: { fontSize: 24, color: color, opacity: taglineOpacity, marginTop: 16 }
    }, tagline)
  );
}`,
  },
  {
    id: "lower-third",
    name: "Lower Third",
    description: "Name and title bar sliding in from left",
    category: "lower-third",
    defaultDuration: 5,
    customizableProps: ["name", "title", "accentColor"],
    code: `({ frame, fps }) => {
  const name = "John Smith";
  const title = "CEO, Company";
  const accentColor = "#C96442";
  const slideIn = Math.min(frame / (fps * 0.3), 1);
  const slideOut = frame > fps * 4 ? Math.min((frame - fps * 4) / (fps * 0.3), 1) : 0;
  const x = -400 * (1 - slideIn) + 400 * slideOut;
  return React.createElement("div", {
    style: { position: "absolute", bottom: 80, left: 40 + x }
  },
    React.createElement("div", {
      style: { backgroundColor: accentColor, color: "white", padding: "10px 24px", fontSize: 28, fontWeight: "bold", borderRadius: "4px 4px 0 0" }
    }, name),
    React.createElement("div", {
      style: { backgroundColor: "rgba(0,0,0,0.8)", color: "white", padding: "6px 24px", fontSize: 18, borderRadius: "0 0 4px 4px" }
    }, title)
  );
}`,
  },
  {
    id: "subscribe-button",
    name: "Subscribe Button",
    description: "Animated subscribe button with bell icon",
    category: "social",
    defaultDuration: 3,
    customizableProps: ["text"],
    code: `({ frame, fps }) => {
  const text = "SUBSCRIBE";
  const bounce = frame < fps * 0.5 ? Math.sin(frame / fps * Math.PI * 4) * 10 * (1 - frame / (fps * 0.5)) : 0;
  const opacity = Math.min(frame / (fps * 0.2), 1);
  const pulseScale = 1 + Math.sin(frame / fps * 2) * 0.03;
  return React.createElement("div", {
    style: { position: "absolute", bottom: 60, right: 40, opacity, transform: "translateY(" + bounce + "px) scale(" + pulseScale + ")" }
  },
    React.createElement("div", {
      style: { backgroundColor: "#FF0000", color: "white", padding: "12px 28px", borderRadius: 4, fontSize: 18, fontWeight: "bold", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", boxShadow: "0 4px 15px rgba(255,0,0,0.4)" }
    }, "\uD83D\uDD14 " + text)
  );
}`,
  },
  {
    id: "countdown-timer",
    name: "Countdown Timer",
    description: "Animated countdown from a number",
    category: "overlay",
    defaultDuration: 5,
    customizableProps: ["startNumber", "color"],
    code: `({ frame, fps }) => {
  const startNumber = 5;
  const color = "#ffffff";
  const currentSecond = startNumber - Math.floor(frame / fps);
  if (currentSecond <= 0) return null;
  const withinSecond = (frame % fps) / fps;
  const scale = 1 + (1 - withinSecond) * 0.5;
  const opacity = withinSecond < 0.1 ? withinSecond / 0.1 : 1;
  return React.createElement("div", {
    style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }
  },
    React.createElement("span", {
      style: { fontSize: 200, fontWeight: "bold", color: color, opacity: opacity, transform: "scale(" + scale + ")", textShadow: "0 0 40px rgba(255,255,255,0.5)" }
    }, String(currentSecond))
  );
}`,
  },
  {
    id: "title-card",
    name: "Title Card",
    description: "Clean centered title with fade-in animation",
    category: "intro",
    defaultDuration: 4,
    customizableProps: ["title", "subtitle", "backgroundColor"],
    code: `({ frame, fps }) => {
  const title = "My Video Title";
  const subtitle = "A short description";
  const backgroundColor = "#1a1a1a";
  const titleOpacity = Math.min(frame / (fps * 0.5), 1);
  const subtitleOpacity = Math.max(0, Math.min((frame - fps * 0.5) / (fps * 0.5), 1));
  const lineWidth = Math.min(frame / (fps * 0.8), 1) * 120;
  return React.createElement("div", {
    style: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", backgroundColor: backgroundColor }
  },
    React.createElement("h1", {
      style: { fontSize: 64, fontWeight: "bold", color: "white", opacity: titleOpacity, letterSpacing: 2 }
    }, title),
    React.createElement("div", {
      style: { width: lineWidth, height: 3, backgroundColor: "#C96442", margin: "20px 0", borderRadius: 2 }
    }),
    React.createElement("p", {
      style: { fontSize: 24, color: "rgba(255,255,255,0.7)", opacity: subtitleOpacity }
    }, subtitle)
  );
}`,
  },
  {
    id: "text-reveal",
    name: "Text Reveal",
    description: "Text that types itself character by character",
    category: "overlay",
    defaultDuration: 3,
    customizableProps: ["text", "color", "fontSize"],
    code: `({ frame, fps }) => {
  const text = "Hello World";
  const color = "#ffffff";
  const fontSize = 48;
  const charsToShow = Math.floor(frame / (fps * 0.08));
  const visibleText = text.slice(0, Math.min(charsToShow, text.length));
  const showCursor = frame % fps < fps / 2;
  return React.createElement("div", {
    style: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }
  },
    React.createElement("span", {
      style: { fontSize: fontSize, fontWeight: "bold", color: color, fontFamily: "monospace", textShadow: "0 2px 10px rgba(0,0,0,0.5)" }
    }, visibleText + (showCursor && charsToShow <= text.length ? "|" : ""))
  );
}`,
  },
  {
    id: "progress-bar",
    name: "Progress Bar",
    description: "Animated progress bar that fills over time",
    category: "overlay",
    defaultDuration: 10,
    customizableProps: ["color", "label"],
    code: `({ frame, fps, width }) => {
  const color = "#C96442";
  const label = "Progress";
  const totalFrames = fps * 10;
  const progress = Math.min(frame / totalFrames, 1);
  return React.createElement("div", {
    style: { position: "absolute", bottom: 40, left: 40, right: 40 }
  },
    React.createElement("div", {
      style: { display: "flex", justifyContent: "space-between", marginBottom: 8 }
    },
      React.createElement("span", { style: { color: "white", fontSize: 14 } }, label),
      React.createElement("span", { style: { color: "white", fontSize: 14 } }, Math.round(progress * 100) + "%")
    ),
    React.createElement("div", {
      style: { height: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 3, overflow: "hidden" }
    },
      React.createElement("div", {
        style: { height: "100%", width: (progress * 100) + "%", backgroundColor: color, borderRadius: 3, transition: "width 0.1s" }
      })
    )
  );
}`,
  },
  {
    id: "fade-transition",
    name: "Fade Transition",
    description: "Smooth black fade in/out transition",
    category: "transition",
    defaultDuration: 1,
    customizableProps: ["color"],
    code: `({ frame, fps }) => {
  const color = "black";
  const midpoint = fps * 0.5;
  const opacity = frame < midpoint ? frame / midpoint : 1 - (frame - midpoint) / midpoint;
  return React.createElement("div", {
    style: { position: "absolute", inset: 0, backgroundColor: color, opacity: Math.max(0, Math.min(1, opacity)) }
  });
}`,
  },
];

export function getTemplate(id: string): RemotionTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: string): RemotionTemplate[] {
  return TEMPLATES.filter((t) => t.category === category);
}

export function getAllTemplates(): RemotionTemplate[] {
  return [...TEMPLATES];
}
