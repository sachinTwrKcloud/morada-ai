CREATE TABLE IF NOT EXISTS bots (
    id SERIAL PRIMARY KEY,
    props JSONB, -- This stores the JSON structure for chat-related data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY, -- Assuming id is a unique identifier of type string
    content TEXT,
    from_user VARCHAR(255),
    to_user VARCHAR(255),
    type VARCHAR(255),
    status VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    direction VARCHAR(10) CHECK (direction IN ('outgoing', 'incoming')),
    chat_id INT REFERENCES bots(id) -- Foreign key relationship with `bots`
);

CREATE TABLE IF NOT EXISTS chat_states (
    id SERIAL PRIMARY KEY,
    state VARCHAR(255),
    user_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,             
    conversation_id TEXT UNIQUE NOT NULL,     
    user_id TEXT NOT NULL,                  
    messages JSONB,                         
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,  
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP   
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE,
    role VARCHAR(50) NOT NULL, -- 'admin', 'user', etc.
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    session_token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS partner_users (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    partner_id INT NOT NULL, -- This may reference another table, such as `partners`
    active BOOLEAN DEFAULT TRUE,
    deleted_at TIMESTAMPTZ
);

ALTER TABLE bots ADD COLUMN partner_id INT;

ALTER TABLE conversations
ADD COLUMN bot_id INT REFERENCES bots(id);

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";