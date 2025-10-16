-- ======================================
-- Extensions
-- ======================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "vector";    -- for pgvector

-- ======================================
-- Sequence for incremental org account IDs
-- ======================================
CREATE SEQUENCE IF NOT EXISTS organization_account_id_seq
    START 1100000000000000
    INCREMENT 1;

-- ======================================
-- Table: organizations
-- ======================================
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    account_id BIGINT UNIQUE DEFAULT nextval('organization_account_id_seq'),
    created_by UUID,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ======================================
-- Table: users
-- ======================================
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE users (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,         -- FK to organizations
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,           -- unique per org
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,             -- owner / maintainer / member
    status VARCHAR(20) DEFAULT 'pending',  -- pending / active / suspended
    invited_by UUID,                       -- who invited this user
    invite_token VARCHAR(255),
    expires_at TIMESTAMP,
    reactivated_at TIMESTAMP,
    token_version INT DEFAULT 1,           -- 🔒 for JWT invalidation after password change
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by UUID,
    reset_token VARCHAR(255),
    reset_expires_at TIMESTAMP,

    -- =============================
    -- 🔐 Constraints & Relationships
    -- =============================

    -- ✅ Each user email must be unique *within* the same organization
    CONSTRAINT unique_org_email UNIQUE (organization_id, email),

    -- ✅ Foreign key linking users → organizations
    CONSTRAINT fk_organization FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE,

    -- ✅ Self-reference for user invitations
    CONSTRAINT fk_invited_by FOREIGN KEY (invited_by)
        REFERENCES users(id)
        DEFERRABLE INITIALLY DEFERRED,

    -- ✅ Ensure only one owner per organization
    CONSTRAINT unique_org_owner UNIQUE (organization_id, role)
        DEFERRABLE INITIALLY DEFERRED
        -- allows only one 'owner' role per org; we'll enforce this with a partial unique index below
);

-- =============================
-- Indexes for performance
-- =============================

-- Fast lookup by organization
CREATE INDEX idx_users_org ON users(organization_id);

-- Fast lookup by email (used in login or invitations)
CREATE INDEX idx_users_email ON users(email);

-- Filter by user status
CREATE INDEX idx_users_status ON users(status);

-- Enforce only one OWNER per organization
CREATE UNIQUE INDEX idx_unique_org_owner_role
ON users(organization_id)
WHERE role = 'owner';

-- Speed up soft-delete filtering
CREATE INDEX idx_users_is_deleted ON users(is_deleted);


-- ======================================
-- Table: documents
-- ======================================
DROP TABLE IF EXISTS documents CASCADE;

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    created_by UUID NOT NULL,
    organization_id UUID,
    account_id UUID,

    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    s3_key TEXT NOT NULL,               -- e.g. "orgs/{orgId}/users/{userId}/docs/file.pdf"
    s3_url TEXT,                        -- presigned URL
    s3_url_expires_at TIMESTAMP,        -- expiry time

    status VARCHAR(20) DEFAULT 'active',  -- active/deleted/archived
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    

    CONSTRAINT fk_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);



-- ======================================
-- Table: urls
-- ======================================
CREATE TABLE IF NOT EXISTS urls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    url VARCHAR(2048) NOT NULL,
    title VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ======================================
-- Table: document_chunks
-- ======================================
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding vector(1536),
    embedding_model VARCHAR(50),
    token_count INT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for document_chunks
CREATE INDEX IF NOT EXISTS idx_document_chunks_org ON document_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_doc ON document_chunks(document_id);

-- ======================================
-- Table: chunk_relations
-- ======================================
CREATE TABLE IF NOT EXISTS chunk_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    to_chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    relation_type VARCHAR(50),
    score DOUBLE PRECISION,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ======================================
-- Table: chats
-- ======================================
CREATE TABLE IF NOT EXISTS chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chat_type VARCHAR(50), -- 'doc' | 'url' | 'org' | 'system'
    document_id UUID REFERENCES documents(id),
    url_id UUID REFERENCES urls(id),
    title VARCHAR(255),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for chat status
CREATE INDEX IF NOT EXISTS idx_chats_status ON chats(status);

-- ======================================
-- Table: messages
-- ======================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sender_user_id UUID REFERENCES users(id),
    role VARCHAR(20), -- 'user' | 'assistant' | 'system' | 'tool'
    content TEXT,
    content_json JSONB,
    attachment_group_id UUID,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ======================================
-- Table: attachments
-- ======================================
CREATE TABLE IF NOT EXISTS attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    file_name VARCHAR(255),
    mime_type VARCHAR(100),
    size_bytes BIGINT,
    storage_key VARCHAR(1024),
    thumbnail_key VARCHAR(1024),
    duration_seconds INT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ======================================
-- Table: training_jobs
-- ======================================
CREATE TABLE IF NOT EXISTS training_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    initiated_by UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending', -- pending/running/completed/failed
    total_documents INT,
    total_chunks INT,
    error_message TEXT,
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ======================================
-- Table: queries
-- ======================================
CREATE TABLE IF NOT EXISTS queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    query_text TEXT,
    query_embedding vector(1536),
    model_used VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- ======================================
-- Table: query_results
-- ======================================
CREATE TABLE IF NOT EXISTS query_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID NOT NULL REFERENCES queries(id) ON DELETE CASCADE,
    chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    rank INT,
    score DOUBLE PRECISION,
    retrieved_text TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ======================================
-- Additional Indexes
-- ======================================
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);





-- FOR CELERY IF FAILS MID TASK
UPDATE training_jobs 
SET status='failed', error_message='Worker timeout or crash' 
WHERE status='running' AND started_at < NOW() - INTERVAL '1 hour';
