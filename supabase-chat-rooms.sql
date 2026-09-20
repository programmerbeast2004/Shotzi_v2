-- ==============================================================================
-- Shotzi: Chat Rooms & Synchronized Memberships Schema
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/llnkxxbplosswrskrbkc/sql
-- ==============================================================================

-- 1. Create the chat_rooms table
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT 'globe',
  image_url TEXT,
  is_private BOOLEAN DEFAULT false,
  creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creator_username TEXT,
  members JSONB DEFAULT '[]'::jsonb,
  pending_requests JSONB DEFAULT '[]'::jsonb,
  invite_code TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

-- 3. Policy: Public read access for all rooms
CREATE POLICY "Public read chat rooms"
  ON public.chat_rooms FOR SELECT
  USING (true);

-- 4. Policy: Authenticated users can create rooms
CREATE POLICY "Authenticated users can create rooms"
  ON public.chat_rooms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 5. Policy: Room creator can update their room
CREATE POLICY "Creators can update rooms"
  ON public.chat_rooms FOR UPDATE
  USING (auth.uid() = creator_id);

-- 6. Policy: Room creator can delete their room
CREATE POLICY "Creators can delete rooms"
  ON public.chat_rooms FOR DELETE
  USING (auth.uid() = creator_id);

-- 7. Insert default Everyone's Corner room
INSERT INTO public.chat_rooms (
  id, name, description, icon, image_url, is_private, creator_username, invite_code
) VALUES (
  'everyone',
  'Everyone''s Corner',
  'Open chat for all',
  'globe',
  '',
  false,
  'Shotzi',
  'everyones-corner'
) ON CONFLICT (id) DO NOTHING;
