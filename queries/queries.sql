-- ====================================================
-- 🧠 Multi-Org RAG Graph Platform (Postgres)
-- ====================================================
-- Requires: pgcrypto, pgvector
-- Optional: superuser privileges for CREATE EXTENSION
-- Embedding dimension = 1536 (adjust if needed)
-- ====================================================

-- ========================
-- Config / Extensions
-- ========================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Change this if your embedding model uses different dimension
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_settings WHERE name = 'rag.embedding_dim') THEN
        -- optional: you can set a GUC or manage dim in app config
        PERFORM set_config('rag.embedding_dim', '1536', false);
    END IF;
END
$$;

-- ========================
-- Sequence for organization account ids (human-friendly incremental)
-- ========================
CREATE SEQUENCE IF NOT EXISTS organization_account_id_seq
    START 1100000000000000
    INCREMENT 1;

-- ========================
-- Table: organizations
-- ========================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    account_id BIGINT UNIQUE DEFAULT nextval('organization_account_id_seq'),
    created_by UUID,  -- FK not enforced here if bootstrap complexity exists
    status VARCHAR(20) DEFAULT 'pending',   -- pending / active / suspended
    meta JSONB,                             -- optional organization metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organizations_account_id ON organizations(account_id);

-- ========================
-- Table: users
-- ========================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,             -- platform_owner | owner | maintainer | member
    status VARCHAR(20) DEFAULT 'pending',
    invited_by UUID REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED,
    invite_token VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    reactivated_at TIMESTAMP WITH TIME ZONE,
    token_version INT DEFAULT 1,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    reset_token VARCHAR(255),
    reset_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metadata JSONB,
    CONSTRAINT unique_org_email UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted);

-- One OWNER per org
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_org_owner_role
    ON users(organization_id)
    WHERE role = 'owner';

-- Owner email globally unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_owner_email_global
    ON users(LOWER(email))
    WHERE role = 'owner';

-- ========================
-- Training Jobs
-- ========================
CREATE TABLE IF NOT EXISTS training_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    initiated_by UUID REFERENCES users(id),
    celery_task_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    total_documents INT DEFAULT 0,
    total_chunks INT DEFAULT 0,
    progress_percent NUMERIC(5,2) DEFAULT 0,
    error_message TEXT,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_jobs_org ON training_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_training_jobs_status ON training_jobs(status);

-- ========================
-- Documents
-- ========================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    file_name VARCHAR(1024) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    s3_key TEXT NOT NULL,
    s3_url TEXT,
    s3_url_expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'pending',
    file_hash VARCHAR(128),
    trainable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_metadata_gin ON documents USING GIN (metadata jsonb_path_ops);

-- ========================
-- URLs
-- ========================
CREATE TABLE IF NOT EXISTS urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    url VARCHAR(2048) NOT NULL,
    title VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    last_fetched_at TIMESTAMP WITH TIME ZONE,
    fetched_hash VARCHAR(128),
    trainable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_urls_org ON urls(organization_id);

-- ========================
-- Document Chunks
-- ========================
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    chunk_text TEXT NOT NULL,
    source_type VARCHAR(20) DEFAULT 'document',
    url_id UUID REFERENCES urls(id) ON DELETE CASCADE,
    embedding vector(1536),
    embedding_model VARCHAR(100),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    chunk_text_tsv tsvector
);

-- Foreign key for URL
ALTER TABLE document_chunks
  ADD CONSTRAINT fk_document_chunks_url
  FOREIGN KEY (url_id) REFERENCES urls(id) ON DELETE SET NULL;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS ux_document_chunks_document_chunk_index
  ON document_chunks(document_id, chunk_index);

CREATE INDEX IF NOT EXISTS idx_document_chunks_doc ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_org ON document_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_source_type ON document_chunks(source_type);
CREATE INDEX IF NOT EXISTS idx_document_chunks_metadata_gin ON document_chunks USING GIN (metadata jsonb_path_ops);
CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_text_tsv ON document_chunks USING GIN (chunk_text_tsv);

-- IVFFLAT index for 1536-d vectors
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_ivfflat
  ON document_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Trigger to populate tsvector
CREATE OR REPLACE FUNCTION document_chunks_tsv_trigger() RETURNS trigger AS $$
BEGIN
  NEW.chunk_text_tsv := to_tsvector('simple', coalesce(NEW.chunk_text,''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tsv_update_document_chunks ON document_chunks;
CREATE TRIGGER tsv_update_document_chunks
  BEFORE INSERT OR UPDATE ON document_chunks
  FOR EACH ROW EXECUTE FUNCTION document_chunks_tsv_trigger();

-- ========================
-- Chunk Relations
-- ========================
CREATE TABLE IF NOT EXISTS chunk_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    to_chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    relation_type VARCHAR(50),
    score DOUBLE PRECISION,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ========================
-- Chats
-- ========================
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_type VARCHAR(50),
    document_id UUID REFERENCES documents(id),
    url_id UUID REFERENCES urls(id),
    title VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chats_org ON chats(organization_id);
CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status);

-- ========================
-- Messages
-- ========================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sender_user_id UUID REFERENCES users(id),
    role VARCHAR(20) NOT NULL,
    message_index BIGINT DEFAULT 0,
    content TEXT,
    content_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(organization_id);

-- ========================
-- Attachments
-- ========================
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    file_name VARCHAR(1024),
    mime_type VARCHAR(255),
    size_bytes BIGINT,
    storage_key VARCHAR(1024),
    thumbnail_key VARCHAR(1024),
    attachment_type VARCHAR(50),
    duration_seconds INT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_org ON attachments(organization_id);


-- ========================
-- Trigger: auto-update "updated_at"
-- ========================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to tables that have updated_at
DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS trg_training_jobs_updated_at ON training_jobs;
CREATE TRIGGER trg_training_jobs_updated_at
  BEFORE UPDATE ON training_jobs
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

DROP TRIGGER IF EXISTS trg_chats_updated_at ON chats;
CREATE TRIGGER trg_chats_updated_at
  BEFORE UPDATE ON chats
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ========================
-- Row Level Security (RLS)
-- ========================
CREATE OR REPLACE FUNCTION current_organization() RETURNS uuid AS $$
  SELECT current_setting('myapp.current_organization', true)::uuid;
$$ LANGUAGE SQL STABLE;

-- Enable RLS and policy for core tables
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY documents_tenant_isolation ON documents
  USING (organization_id = current_organization());

CREATE POLICY messages_tenant_isolation ON messages
  USING (organization_id = current_organization());

CREATE POLICY chats_tenant_isolation ON chats
  USING (organization_id = current_organization());

CREATE POLICY document_chunks_tenant_isolation ON document_chunks
  USING (organization_id = current_organization());

-- ========================
-- Token Usage (for analytics / billing)
-- ========================
CREATE TABLE IF NOT EXISTS token_usage (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    total_prompt_tokens BIGINT DEFAULT 0,
    total_completion_tokens BIGINT DEFAULT 0,
    total_tokens BIGINT GENERATED ALWAYS AS (total_prompt_tokens + total_completion_tokens) STORED,
    total_cost NUMERIC(12,6) DEFAULT 0,

    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),

    PRIMARY KEY (organization_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_token_usage_org ON token_usage(organization_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_user ON token_usage(user_id);
-- ====================================================
-- ✅ Done: Complete, production-ready schema
-- ====================================================
