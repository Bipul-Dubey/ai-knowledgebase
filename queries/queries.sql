-- ====================================================
-- 🧠 Basic RAG Platform (Documents Only)
-- ====================================================
-- Scope:
-- - Multi-organization
-- - Document ingestion (S3)
-- - Vector search (pgvector)
-- - Chat + messages
-- - Token usage tracking
-- ====================================================

-- ========================
-- Extensions
-- ========================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";


-- ========================
-- Sequence for organization account ids (human-friendly incremental)
-- ========================
CREATE SEQUENCE IF NOT EXISTS organization_account_id_seq
    START 1100000000000000
    INCREMENT 1;
    
-- ====================================================
-- organizations (UNCHANGED)
-- ====================================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    account_id BIGINT UNIQUE DEFAULT nextval('organization_account_id_seq'),
    created_by UUID,
    status VARCHAR(20) DEFAULT 'pending',
    meta JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ====================================================
-- users (UNCHANGED)
-- ====================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    invited_by UUID REFERENCES users(id),
    invite_token VARCHAR(255),
    expires_at TIMESTAMPTZ,
    reactivated_at TIMESTAMPTZ,
    token_version INT DEFAULT 1,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    reset_token VARCHAR(255),
    reset_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    metadata JSONB,
    CONSTRAINT unique_org_email UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ====================================================
-- Documents
-- ====================================================
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    file_name VARCHAR(1024) NOT NULL,
    s3_key TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    trainable BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_documents_org ON documents(organization_id);
CREATE INDEX idx_documents_status ON documents(status);

-- ====================================================
-- Training Jobs
-- ====================================================
CREATE TABLE training_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    initiated_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',
    total_chunks INT DEFAULT 0,
    error_message TEXT,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_training_jobs_org ON training_jobs(organization_id);

-- ====================================================
-- Document Chunks (CORE RAG TABLE)
-- ====================================================
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT uq_document_chunk UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_document_chunks_org
    ON document_chunks(organization_id);

CREATE INDEX idx_document_chunks_embedding
    ON document_chunks
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ====================================================
-- Chats
-- ====================================================
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_message_at TIMESTAMPTZ
);

CREATE INDEX idx_chats_org ON chats(organization_id);

-- ====================================================
-- Messages
-- ====================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sender_user_id UUID REFERENCES users(id),
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_chat ON messages(chat_id);
CREATE INDEX idx_messages_org ON messages(organization_id);

-- ====================================================
-- Token Usage
-- ====================================================
CREATE TABLE token_usage (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,

    total_prompt_tokens BIGINT DEFAULT 0,
    total_completion_tokens BIGINT DEFAULT 0,
    total_cost NUMERIC(12,6) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),

    PRIMARY KEY (organization_id, user_id)
);

CREATE INDEX idx_token_usage_org ON token_usage(organization_id);
CREATE INDEX idx_token_usage_user ON token_usage(user_id);

-- ====================================================
-- End of Basic RAG Schema (Organizations & Users Preserved)
-- ====================================================
