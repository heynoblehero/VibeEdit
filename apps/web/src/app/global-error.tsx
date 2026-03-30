"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
	return (
		<html>
			<body>
				<div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", fontFamily: "system-ui" }}>
					<h2 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Something went wrong</h2>
					<button onClick={() => reset()} style={{ marginTop: "1rem", padding: "0.5rem 1rem", borderRadius: "0.5rem", background: "#7c3aed", color: "white", border: "none", cursor: "pointer" }}>
						Try again
					</button>
				</div>
			</body>
		</html>
	);
}
