/* ============================================
   SUPABASE CONFIGURATION
   Kayole Digital Hub — Public Client Config
   ============================================ */

const SUPABASE_URL = "https://nhrkhynqovrcagfoftft.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ZHIOX2-UyiRKCn9kgkeYNg_eyKDscNT";

/* Initialise the Supabase client
   (requires the supabase-js library to be loaded first) */
const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);