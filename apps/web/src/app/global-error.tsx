"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
	return (
		<html>
			<body style={{ background: "#08080c", color: "white", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui" }}>
				<div style={{ textAlign: "center" }}>
					<h2 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Something went wrong</h2>
					<button onClick={reset} style={{ marginTop: "1rem", padding: "0.75rem 1.5rem", borderRadius: "9999px", background: "linear-gradient(135deg, #8b5cf6, #d946ef)", color: "white", border: "none", cursor: "pointer", fontWeight: 600 }}>
						Try again
					</button>
				</div>
			</body>
		</html>
	);
}
