-- Add SMTP settings to business_settings table
ALTER TABLE business_settings
ADD COLUMN smtp_host text,
ADD COLUMN smtp_port integer,
ADD COLUMN smtp_password text; 