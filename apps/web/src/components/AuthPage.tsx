import React from "react";

type AuthPageProps = {
  authMode: "login" | "register";
  authEmail: string;
  authPassword: string;
  authError: string | null;
  authWorking: boolean;
  title: string;
  subtitle: string;
  onAuthModeChange: (mode: "login" | "register") => void;
  onAuthEmailChange: (value: string) => void;
  onAuthPasswordChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onBackToLanding: () => void;
};

export const AuthPage: React.FC<AuthPageProps> = ({
  authMode,
  authEmail,
  authPassword,
  authError,
  authWorking,
  title,
  subtitle,
  onAuthModeChange,
  onAuthEmailChange,
  onAuthPasswordChange,
  onSubmit,
  onBackToLanding,
}) => {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background:
          "radial-gradient(700px 360px at 20% 0%, rgba(56, 189, 248, 0.18), transparent 55%), radial-gradient(560px 320px at 80% 0%, rgba(139, 92, 246, 0.14), transparent 55%), var(--bg)",
      }}
    >
      <div
        style={{
          width: "min(1040px, 100%)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px",
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            display: "grid",
            gap: "18px",
            alignContent: "center",
            padding: "16px",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "32px",
                lineHeight: 1.1,
              }}
            >
              Scanlark
            </div>
            <div
              style={{
                marginTop: "10px",
                color: "var(--text-muted)",
                fontSize: "15px",
                lineHeight: 1.6,
                maxWidth: "46ch",
              }}
            >
              Sign in to monitor site health, run external scans, review
              reports, and manage alerts and schedules.
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gap: "10px",
              color: "var(--text-muted)",
              fontSize: "14px",
            }}
          >
            <div className="marketing-chip">Passive website monitoring</div>
            <div className="marketing-chip">Manual and scheduled scans</div>
            <div className="marketing-chip">
              Issue change detection and alerts
            </div>
          </div>
          <div>
            <button className="ghost-button" onClick={onBackToLanding}>
              Back to landing
            </button>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="auth-panel"
          style={{
            background: "var(--panel)",
            border: "1px solid var(--border)",
            borderRadius: "18px",
            padding: "24px",
            display: "grid",
            gap: "16px",
            boxShadow: "var(--shadow)",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "24px",
                fontWeight: 700,
              }}
            >
              {title}
            </div>
            <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              {subtitle}
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {(["login", "register"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onAuthModeChange(mode)}
                className={
                  authMode === mode ? "toggle-pill active" : "toggle-pill"
                }
              >
                {mode === "login" ? "Login" : "Register"}
              </button>
            ))}
          </div>

          <label className="field-label">
            Email
            <input
              type="email"
              value={authEmail}
              onChange={(e) => onAuthEmailChange(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
              disabled={authWorking}
              className="app-input"
            />
          </label>

          <label className="field-label">
            Password
            <input
              type="password"
              value={authPassword}
              onChange={(e) => onAuthPasswordChange(e.target.value)}
              autoComplete={
                authMode === "login" ? "current-password" : "new-password"
              }
              placeholder="Enter your password"
              disabled={authWorking}
              className="app-input"
            />
          </label>

          {authError && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: "12px",
                border:
                  "1px solid color-mix(in srgb, var(--danger) 50%, transparent)",
                background:
                  "color-mix(in srgb, var(--danger) 12%, transparent)",
                color: "var(--danger)",
                fontSize: "13px",
              }}
            >
              {authError}
            </div>
          )}

          <button
            type="submit"
            disabled={authWorking}
            className="primary-button primary-button--large"
            style={{ width: "100%", justifyContent: "center" }}
          >
            {authWorking
              ? "Please wait..."
              : authMode === "login"
                ? "Log in"
                : "Create account"}
          </button>

          <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
            Authentication remains separate from the public landing page and the
            logged-in monitoring dashboard.
          </div>
        </form>
      </div>
    </div>
  );
};
