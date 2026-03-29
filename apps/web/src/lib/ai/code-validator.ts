export const BLOCKED_PATTERNS = [
  /(?<!React\.)(?<!\w)fetch\s*\(/,          // fetch() but not someFetch()
  /\bXMLHttpRequest\b/,
  /\bnew\s+WebSocket\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bdocument\.cookie\b/,
  /(?<!\w)eval\s*\(/,                        // eval() but not someEval()
  /\bnew\s+Function\b/,
  /\bimport\s*\(/,
  /\brequire\s*\(/,
  /\bwindow\.open\b/,
  /\bnavigator\.sendBeacon\b/,               // specific navigator abuse, not all navigator
  /\bwindow\.location\b/,                    // window.location (not bare "location" — common var name in animations)
  /\blocation\.href\s*=/,
  /\b__editor\b/,
  /\bprocess\.env\b/,
  /\bglobalThis\b/,
  /\bwindow\[/,
  /\bdocument\.(write|querySelector|getElementById|body)/,  // removed createElement — React needs it
  /\bwindow\.postMessage\b/,                 // window.postMessage (not bare "postMessage" — common method name)
  /\bsetInterval\s*\(/,
];

export function validateUserCode(code: string, maxLength = 5000): string | null {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(code)) {
      return `Blocked: code contains unsafe pattern "${pattern.source}"`;
    }
  }
  if (code.length > maxLength) {
    return `Code too long (max ${maxLength} chars)`;
  }
  return null;
}
