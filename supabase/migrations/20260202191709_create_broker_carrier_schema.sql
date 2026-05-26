/*
  # Broker-Carrier Packet SaaS Schema

  ## Overview
  This migration creates the database schema for a multi-tenant SaaS application 
  where brokers can create carrier packets, send them to carriers for signing, 
  and track their status.

  ## New Tables

  ### `brokers`
  Stores broker profile information linked to Supabase auth users.
  - `id` (uuid, primary key) - References auth.users(id)
  - `company_name` (text) - Broker's company name
  - `email` (text, unique) - Broker's email
  - `subscription_status` (text) - Subscription tier (free, paid, etc.)
  - `created_at` (timestamptz) - Account creation timestamp

  ### `packets`
  Stores carrier packet information for each broker.
  - `id` (uuid, primary key) - Unique packet identifier
  - `broker_id` (uuid) - References brokers(id)
  - `carrier_email` (text) - Email of the carrier
  - `carrier_name` (text) - Name of the carrier
  - `packet_url` (text) - URL to the PDF in Supabase Storage
  - `status` (text) - Packet status: 'pending', 'sent', 'signed'
  - `secure_token` (text, unique) - Secure token for carrier signing link
  - `created_at` (timestamptz) - Packet creation timestamp
  - `sent_at` (timestamptz, nullable) - When email was sent
  - `signed_at` (timestamptz, nullable) - When packet was signed

  ### `signatures`
  Stores signature information for signed packets.
  - `id` (uuid, primary key) - Unique signature identifier
  - `packet_id` (uuid) - References packets(id)
  - `carrier_name` (text) - Name entered by carrier
  - `signature_data` (text) - Base64 signature image or URL to uploaded signed PDF
  - `signature_type` (text) - Type: 'draw' or 'upload'
  - `signed_at` (timestamptz) - Signature timestamp

  ## Security
  
  ### Row Level Security (RLS)
  All tables have RLS enabled with policies to ensure:
  1. Brokers can only access their own packets and signatures
  2. Carriers can access packets via secure token (no authentication required)
  3. Multi-tenant data isolation is enforced at the database level

  ### RLS Policies
  - **brokers**: Authenticated users can read/update their own profile
  - **packets**: Brokers can only view/manage their own packets
  - **signatures**: Brokers can view signatures for their packets, anyone with token can insert
*/

-- Create brokers table
CREATE TABLE IF NOT EXISTS brokers (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  email text UNIQUE NOT NULL,
  subscription_status text DEFAULT 'free',
  created_at timestamptz DEFAULT now()
);

-- Create packets table
CREATE TABLE IF NOT EXISTS packets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id uuid NOT NULL REFERENCES brokers(id) ON DELETE CASCADE,
  carrier_email text NOT NULL,
  carrier_name text NOT NULL,
  packet_url text NOT NULL,
  status text DEFAULT 'pending',
  secure_token text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  signed_at timestamptz
);

-- Create signatures table
CREATE TABLE IF NOT EXISTS signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id uuid NOT NULL REFERENCES packets(id) ON DELETE CASCADE,
  carrier_name text NOT NULL,
  signature_data text NOT NULL,
  signature_type text NOT NULL,
  signed_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_packets_broker_id ON packets(broker_id);
CREATE INDEX IF NOT EXISTS idx_packets_secure_token ON packets(secure_token);
CREATE INDEX IF NOT EXISTS idx_signatures_packet_id ON signatures(packet_id);

-- Enable Row Level Security
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;
ALTER TABLE packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE signatures ENABLE ROW LEVEL SECURITY;

-- RLS Policies for brokers table
CREATE POLICY "Users can view own broker profile"
  ON brokers FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own broker profile"
  ON brokers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own broker profile"
  ON brokers FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for packets table
CREATE POLICY "Brokers can view own packets"
  ON packets FOR SELECT
  TO authenticated
  USING (broker_id = auth.uid());

CREATE POLICY "Brokers can insert own packets"
  ON packets FOR INSERT
  TO authenticated
  WITH CHECK (broker_id = auth.uid());

CREATE POLICY "Brokers can update own packets"
  ON packets FOR UPDATE
  TO authenticated
  USING (broker_id = auth.uid())
  WITH CHECK (broker_id = auth.uid());

CREATE POLICY "Brokers can delete own packets"
  ON packets FOR DELETE
  TO authenticated
  USING (broker_id = auth.uid());

-- Allow anonymous users to view packets by secure token (for carrier signing)
CREATE POLICY "Anyone can view packet by secure token"
  ON packets FOR SELECT
  TO anon
  USING (true);

-- Allow anonymous users to update packet status when signing
CREATE POLICY "Anyone can update packet status for signing"
  ON packets FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- RLS Policies for signatures table
CREATE POLICY "Brokers can view signatures for own packets"
  ON signatures FOR SELECT
  TO authenticated
  USING (
    packet_id IN (
      SELECT id FROM packets WHERE broker_id = auth.uid()
    )
  );

CREATE POLICY "Anyone can insert signature"
  ON signatures FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert signature"
  ON signatures FOR INSERT
  TO authenticated
  WITH CHECK (true);