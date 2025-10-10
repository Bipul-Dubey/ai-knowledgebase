-- ======================================
-- Sequence for incremental organization account IDs
-- ======================================
CREATE SEQUENCE organization_account_id_seq
    START 1100000000000000
    INCREMENT 1;

-- ======================================
-- Table: organizations
-- ======================================
DROP TABLE IF EXISTS organizations CASCADE;
CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    account_id BIGINT NOT NULL UNIQUE DEFAULT nextval('organization_account_id_seq'), -- incremental login ID
    created_by UUID,                       -- owner of organization
    status VARCHAR(20) DEFAULT 'pending',  -- pending / active
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast login queries
CREATE INDEX idx_org_account_id ON organizations(account_id);

-- ======================================
-- Table: users
-- ======================================
DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,         -- FK to organizations
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,           -- unique per org
    password VARCHAR(255),
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

    -- Constraints
    CONSTRAINT unique_org_email UNIQUE (organization_id, email),
    CONSTRAINT fk_organization FOREIGN KEY (organization_id)
        REFERENCES organizations(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_invited_by FOREIGN KEY (invited_by)
        REFERENCES users(id)
        DEFERRABLE INITIALLY DEFERRED
);

-- Indexes for performance
CREATE INDEX idx_users_org ON users(organization_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
