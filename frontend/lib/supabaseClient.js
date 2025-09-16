// import { createClient } from '@supabase/supabase-js';

// export const supabase = createClient(
//   process.env.REACT_PUBLIC_SUPABASE_URL,
//   process.env.REACT_PUBLIC_SUPABASE_ANON_KEY,
//   {
//     auth: {
//       persistSession: true,
//       autoRefreshToken: true,
//       detectSessionInUrl: true,
//     },
//   }
// );

import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL;
const anon = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Helpful error so this never wastes your time again
  // (Remove after you confirm it works)
  console.error('Supabase envs missing:', { url, anonPresent: !!anon });
  throw new Error('Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY');
}

export const supabase = createClient(url, anon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
