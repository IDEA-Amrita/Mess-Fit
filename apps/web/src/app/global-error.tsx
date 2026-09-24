"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Last resort: an error in the root layout itself. It replaces the whole
// document, so it can't rely on providers or the app's stylesheet.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#08080a",
          color: "#f5f5f7",
          fontFamily: "system-ui, sans-serif",
          textAlign: "center",
          padding: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ color: "#9a9aa3", marginBottom: 24 }}>MessFit hit an unexpected error. It&apos;s been reported.</p>
          <button
            onClick={reset}
            style={{
              background: "#ccff00",
              color: "#000",
              border: 0,
              borderRadius: 999,
              padding: "12px 24px",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
