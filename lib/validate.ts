// Checks shared by the sign-up form (browser) and the sign-up API (server).

export const emailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e.trim());

export const phoneValid = (p: string) => {
  const d = p.replace(/\D/g, "");
  return d.length === 10 || (d.length === 11 && d.startsWith("1"));
};

export function passwordStrength(p: string): { score: number; label: string } {
  let score = 0;
  if (p.length >= 12) score++;
  if (p.length >= 16) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  return { score, label: ["Too weak", "Weak", "Fair", "Good", "Strong", "Very strong"][score] };
}

/** Returns what's wrong with a new password, or "" when it's acceptable. */
export function passwordProblem(p: string, email = ""): string {
  if (p.length < 12) return "Use at least 12 characters.";
  if (p.length > 128) return "Use 128 characters or fewer.";
  if (passwordStrength(p).score < 3) return "Mix upper and lower case letters with numbers or symbols.";
  const local = email.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && p.toLowerCase().includes(local)) return "Don't include your email address in your password.";
  return "";
}

export function signupProblem(v: { name: string; email: string; phone: string; password: string }): { field: string; message: string } | null {
  if (v.name.trim().length < 2) return { field: "name", message: "Enter your full name." };
  if (!emailValid(v.email)) return { field: "email", message: "Enter a valid email address." };
  if (!phoneValid(v.phone)) return { field: "phone", message: "Enter a 10-digit U.S. mobile number." };
  const pw = passwordProblem(v.password, v.email);
  if (pw) return { field: "password", message: pw };
  return null;
}
