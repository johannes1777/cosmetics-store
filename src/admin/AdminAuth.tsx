import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type AdminStatus = "loading" | "not-configured" | "signed-out" | "not-admin" | "admin";

type AdminAuthValue = {
  status: AdminStatus;
  email: string;
  signIn: (email: string, password: string) => Promise<string | null>; // returns an error message, or null on success
  signOut: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AdminStatus>(isSupabaseConfigured ? "loading" : "not-configured");
  const [email, setEmail] = useState("");

  // Signed in is not enough: we also ask the database "is this person an admin?".
  // (The database rules enforce this too. This check just decides what to show.)
  const check = useCallback(async (session: Session | null) => {
    if (!supabase) return;
    if (!session) {
      setEmail("");
      setStatus("signed-out");
      return;
    }
    setEmail(session.user.email ?? "");
    const { data, error } = await supabase.rpc("is_admin");
    setStatus(!error && data === true ? "admin" : "not-admin");
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => check(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      // Run on the next tick: calling Supabase directly inside this callback can freeze it.
      setTimeout(() => void check(session), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [check]);

  const signIn = useCallback(async (emailInput: string, password: string) => {
    if (!supabase) return "The shop is not connected to its database.";
    const { error } = await supabase.auth.signInWithPassword({ email: emailInput.trim(), password });
    // One vague message on purpose, so the form never reveals which emails exist.
    return error ? "That email or password is not correct." : null;
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
  }, []);

  const value = useMemo(() => ({ status, email, signIn, signOut }), [status, email, signIn, signOut]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used inside <AdminAuthProvider>");
  return ctx;
}

// Wrap admin pages in this. Anyone who is not a signed-in admin never sees them.
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { status, email, signOut } = useAdminAuth();

  if (status === "loading") return <p className="admin-message" role="status">Checking your sign-in…</p>;
  if (status === "not-configured") {
    return <p className="admin-message">The site is not connected to Supabase yet. See SETUP.md.</p>;
  }
  if (status === "signed-out") return <Navigate to="/admin/login" replace />;
  if (status === "not-admin") {
    return (
      <div className="admin-message">
        <h1>No admin access</h1>
        <p>{email} is signed in, but is not on the admin list.</p>
        <button type="button" className="button button-quiet" onClick={() => void signOut()}>Sign out</button>
      </div>
    );
  }
  return <>{children}</>;
}
