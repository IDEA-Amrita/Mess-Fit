import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Fetches the currently authenticated user from Supabase.
 * Uses TanStack Query to cache the user object across the app
 * to prevent waterfall fetches in `useEffect`.
 */
export function useUser() {
  return useQuery({
    queryKey: ["auth", "user"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    },
    // User object rarely changes during a session
    staleTime: 5 * 60 * 1000, 
  });
}
