-- ====================================================
-- Production-ready DDL for Multi-Org RAG platform (Postgres)
-- Requires extensions: pgcrypto, pgvector
-- Assumes embedding dimension = 1536 (adjust EMB_DIM if different)
-- ====================================================

-- ========================
-- Config / Extensions
-- ========================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "vector";    -- pgvector

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
    organization_id UUID NOT NULL,         -- FK to organizations
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,           -- unique per org
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,             -- owner / maintainer / member
    status VARCHAR(20) DEFAULT 'pending',  -- pending / active / suspended
    invited_by UUID,                       -- who invited this user
    invite_token VARCHAR(255),
    expires_at TIMESTAMP WITH TIME ZONE,
    reactivated_at TIMESTAMP WITH TIME ZONE,
    token_version INT DEFAULT 1,           -- for JWT invalidation
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID,
    reset_token VARCHAR(255),
    reset_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metadata JSONB,

    -- Constraints & relationships
    CONSTRAINT fk_users_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT fk_users_invited_by FOREIGN KEY (invited_by) REFERENCES users(id) DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT unique_org_email UNIQUE (organization_id, email)
);

-- Indexes for users
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted);

-- Enforce only one OWNER role per organization (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_org_owner_role
    ON users(organization_id)
    WHERE role = 'owner';

-- Enforce: an email that is owner in any org cannot be owner in another org (global owner-email uniqueness)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_owner_email_global
    ON users(LOWER(email))
    WHERE role = 'owner';

-- ========================
-- Table: documents
-- ========================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

    -- optional account id from organizations.account_id for quick joins
    account_id BIGINT,

    file_name VARCHAR(1024) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,

    -- storage details (S3)
    s3_key TEXT NOT NULL,               -- "organizations/{org}/documents/{uuid}_name.ext"
    s3_url TEXT,                        -- last generated presigned URL (optional)
    s3_url_expires_at TIMESTAMP WITH TIME ZONE,

    -- training metadata
    status VARCHAR(20) DEFAULT 'pending',  -- pending / training / active / failed / archived
    trained_at TIMESTAMP WITH TIME ZONE,
    training_job_id UUID REFERENCES training_jobs(id),

    file_hash VARCHAR(128),  -- e.g. sha256 to detect duplicates

    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_documents_org ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON documents(created_by);

-- ========================
-- Table: urls (external sources)
-- ========================
CREATE TABLE IF NOT EXISTS urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    url VARCHAR(2048) NOT NULL,
    title VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    last_fetched_at TIMESTAMP WITH TIME ZONE,
    fetched_hash VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_urls_org ON urls(organization_id);

-- ========================
-- Table: training_jobs
-- ========================
CREATE TABLE IF NOT EXISTS training_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    initiated_by UUID REFERENCES users(id),
    celery_task_id VARCHAR(255),  -- for Celery/RQ tracking
    status VARCHAR(20) DEFAULT 'pending', -- pending/running/completed/failed
    total_documents INT DEFAULT 0,
    total_chunks INT DEFAULT 0,
    progress_percent NUMERIC(5,2) DEFAULT 0,
    retry_count INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_training_jobs_org ON training_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_training_jobs_status ON training_jobs(status);

-- ========================
-- Table: document_chunks
-- ========================
-- Note: embedding vector dimension must match your model (adjust 1536 if needed)
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    chunk_text TEXT NOT NULL,
    source_type VARCHAR(20) DEFAULT 'document',
    url_id UUID,
    embedding vector(1536),            -- pgvector column
    embedding_model VARCHAR(100),
    token_count INT,
    content_hash VARCHAR(128),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes on chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_url ON document_chunks(url_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_source_type ON document_chunks(source_type);
CREATE INDEX IF NOT EXISTS idx_document_chunks_org ON document_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_doc ON document_chunks(document_id);
-- ivfflat index for vector search (requires REINDEX or analyze when large)
-- Adjust lists = 100 according to dataset scale. For small data, KNN sequential scan OK.
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_ivfflat
  ON document_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ========================
-- Table: chunk_relations (graph links between chunks)
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
-- Table: chats & messages (conversations)
-- ========================
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_type VARCHAR(50), -- 'doc' | 'url' | 'org' | 'system'
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

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sender_user_id UUID REFERENCES users(id),
    role VARCHAR(20) NOT NULL, -- 'user' | 'assistant' | 'system' | 'tool'
    message_index BIGINT DEFAULT 0,  -- incremental index inside chat for ordering
    content TEXT,                    -- raw markdown/plain text
    content_json JSONB,              -- structured blocks, AST, attachments list, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_org ON messages(organization_id);

-- ========================
-- Table: attachments (files referenced in messages)
-- ========================
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    file_name VARCHAR(1024),
    mime_type VARCHAR(255),
    size_bytes BIGINT,
    storage_key VARCHAR(1024),   -- s3 key
    thumbnail_key VARCHAR(1024),
    attachment_type VARCHAR(50),
    duration_seconds INT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attachments_org ON attachments(organization_id);

-- ========================
-- Table: queries & query_results
-- ========================
CREATE TABLE IF NOT EXISTS queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    query_text TEXT,
    query_embedding vector(1536),
    model_used VARCHAR(100),
    query_type VARCHAR(50) DEFAULT 'org', -- 'org'|'doc'|'url'
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queries_org ON queries(organization_id);
CREATE INDEX IF NOT EXISTS idx_queries_status ON queries(status);
CREATE INDEX IF NOT EXISTS idx_queries_embedding_ivfflat
  ON queries USING ivfflat (query_embedding vector_cosine_ops)
  WITH (lists = 50);

CREATE TABLE IF NOT EXISTS query_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
    chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    rank INT,
    score DOUBLE PRECISION,
    retrieved_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_query_results_query ON query_results(query_id);

-- ========================
-- Safety / maintenance helper
-- ========================
-- Recover training jobs that are stuck 'running' for too long, optional.
-- Run as a periodic job (cron) or at app start:
-- UPDATE training_jobs
-- SET status='failed', error_message='Worker timeout/crash', finished_at=NOW()
-- WHERE status='running' AND started_at < NOW() - INTERVAL '1 hour';

-- ====================================================
-- Notes:
-- 1) Adjust vector dimension (1536) to match the embedding model you use.
-- 2) ivfflat indexes require you to run: SELECT vector_create_index('document_chunks','embedding') OR create as above.
--    You should also run: ANALYZE document_chunks; and tune lists based on dataset size.
-- 3) For pgvector performance: create ivfflat + store number of lists appropriate for data size.
-- 4) Use prepared transactions/transactions in app code for training insertion to ensure atomicity.
-- 5) Consider periodically vacuum/analyze and reindex vector indexes after large batches.
-- 6) If you want document-level soft-delete, rely on 'status' and not physical deletion to avoid orphaning chunks/messages.
-- ====================================================
