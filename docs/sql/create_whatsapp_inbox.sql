CREATE TABLE IF NOT EXISTS whatsapp_inbox (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  sender_name TEXT,
  message_text TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'geral',
  confidence REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  notes TEXT,
  patient_id TEXT,
  received_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_select_inbox" ON whatsapp_inbox FOR SELECT USING (true);
CREATE POLICY "anon_insert_inbox" ON whatsapp_inbox FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_inbox" ON whatsapp_inbox FOR UPDATE USING (true);
CREATE POLICY "anon_delete_inbox" ON whatsapp_inbox FOR DELETE USING (true);
CREATE POLICY "authenticated_all_inbox" ON whatsapp_inbox FOR ALL USING (true);

CREATE INDEX idx_whatsapp_inbox_status ON whatsapp_inbox(status);
CREATE INDEX idx_whatsapp_inbox_category ON whatsapp_inbox(category);
CREATE INDEX idx_whatsapp_inbox_received_at ON whatsapp_inbox(received_at DESC);
CREATE INDEX idx_whatsapp_inbox_phone ON whatsapp_inbox(phone);
