CREATE TABLE IF NOT EXISTS support_chats (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  username text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  subject text,
  last_message text,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS support_messages (
  id text PRIMARY KEY,
  chat_id text NOT NULL REFERENCES support_chats(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  sender_type text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS support_chats_user_idx ON support_chats(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS support_chats_status_idx ON support_chats(status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS support_messages_chat_idx ON support_messages(chat_id, created_at ASC);
CREATE INDEX IF NOT EXISTS support_messages_user_idx ON support_messages(user_id, created_at DESC);
