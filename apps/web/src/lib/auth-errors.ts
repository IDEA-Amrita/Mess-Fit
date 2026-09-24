/**
 * Supabase Auth returns developer-facing messages ("Invalid login
 * credentials", "email rate limit exceeded"). Translate the ones a user can
 * actually hit into something they can act on; anything unrecognised passes
 * through unchanged rather than being hidden.
 */
export function friendlyAuthError(err: { message: string; code?: string; status?: number }): string {
  const m = err.message.toLowerCase();
  const code = err.code ?? "";
  if (code === "invalid_credentials" || m.includes("invalid login credentials")) return "Incorrect email or password.";
  if (code === "email_not_confirmed" || m.includes("email not confirmed")) {
    return "Please confirm your email first — check your inbox for the link we sent.";
  }
  if (code === "user_already_exists" || m.includes("already registered")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (code === "weak_password" || m.includes("password should be")) {
    return "That password is too weak. Use at least 8 characters.";
  }
  if (code.includes("rate_limit") || m.includes("rate limit") || err.status === 429) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }
  if (m.includes("failed to fetch") || m.includes("network")) {
    return "Couldn't reach MessFit. Check your connection and try again.";
  }
  return err.message;
}
