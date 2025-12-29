import { defineStore } from 'pinia';
import { ref } from 'vue';
import { supabase } from '../services/supabase';
import { useRouter } from 'vue-router';
import type { User, Session } from '@supabase/supabase-js';

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const session = ref<Session | null>(null);
  const loading = ref(true);
  const router = useRouter();

  // 1. Initialize: Check if user is logged in
  async function initializeAuth() {
    loading.value = true;
    const { data } = await supabase.auth.getSession();
    
    if (data.session) {
      const email = data.session.user.email;
      
      // Safety check: specific logic if email is missing
      if (!email) {
        await logout();
        return;
      }

      const isAdmin = await checkIsAdmin(email); // Now safe
      if (isAdmin) {
        session.value = data.session;
        user.value = data.session.user;
      } else {
        await logout();
      }
    }
    loading.value = false;
  }

  // 2. Helper: Check Whitelist
  async function checkIsAdmin(email: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('app_admins')
      .select('role')
      .eq('email', email)
      .single();
    
    return !error && !!data;
  }

  // 3. Login (Existing Users)
  async function login(email: string, password: string) {
    // A. Check Whitelist First
    const isAdmin = await checkIsAdmin(email);
    if (!isAdmin) throw new Error("Access Denied: You are not an administrator.");

    // B. Perform Login
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    session.value = data.session;
    user.value = data.user;
    router.push('/');
  }

  // 4. Register (For First Time Admins)
  async function register(email: string, password: string) {
    // A. Check Whitelist First
    const isAdmin = await checkIsAdmin(email);
    if (!isAdmin) throw new Error("Access Denied: Your email has not been invited by a Super Admin.");

    // B. Create Account
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    
    // Auto login after signup
    if (data.session) {
      session.value = data.session;
      user.value = data.user;
      router.push('/');
    } else {
        // Sometimes Supabase requires email verification, depending on settings
        alert("Account created! Please check your email to confirm.");
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    user.value = null;
    session.value = null;
    router.push('/login');
  }

  return { user, session, loading, initializeAuth, login, register, logout };
});