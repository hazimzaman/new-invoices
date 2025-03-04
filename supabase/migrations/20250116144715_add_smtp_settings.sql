-- Add SMTP settings to business_settings table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'business_settings' 
                  AND column_name = 'smtp_host') THEN
        ALTER TABLE business_settings
        ADD COLUMN smtp_host text,
        ADD COLUMN smtp_port integer,
        ADD COLUMN smtp_password text;
    END IF;
END $$; 

create table if not exists business_settings (
    id uuid primary key default uuid_generate_v4(),
    business_name text,
    business_address text,
    contact_email text,
    contact_phone text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
); 