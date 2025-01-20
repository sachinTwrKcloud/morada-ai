WITH inserted_bot AS (
    INSERT INTO bots (props)
    VALUES ('{"chat": {"enabled": true, "clientToken": "sampleToken", "chatId": "uniqueChatId"}}')
    RETURNING id
),
inserted_message AS (
    INSERT INTO messages (id, content, from_user, to_user, type, status, direction, chat_id)
    VALUES 
    (uuid_generate_v4(), 'Hello, this is a test message', 'user_1', 'bot_1', 'text/plain', 'sent', 'outgoing', (SELECT id FROM inserted_bot))
    RETURNING id
),
inserted_chat_state AS (
    INSERT INTO chat_states (state, user_id)
    VALUES ('composing', 'user_1')
    RETURNING id
)
-- Insert into 'conversations' with proper JSON structure
INSERT INTO conversations (conversation_id, user_id, messages)
VALUES 
('conv_12345', 'user_1', 
    jsonb_build_object(
        'messages', jsonb_build_array(
            jsonb_build_object(
                'message_id', (SELECT id FROM inserted_message), 
                'content', 'Hello, this is a test message'
            )
        )
    )
);








-- test data 2

-- Insert test data into the users table
INSERT INTO users (username, password, email, role)
VALUES ('test_user', 'hashed_password', 'test_user@example.com', 'user');

-- Insert test data into the bots table
INSERT INTO bots (props, partner_id)
VALUES ('{"name": "Test Bot", "version": "1.0"}', 1);

-- Insert test data into the sessions table
INSERT INTO sessions (user_id, session_token)
VALUES ((SELECT id FROM users WHERE username = 'test_user'), 'test_session_token');

-- Insert test data into the partner_users table
INSERT INTO partner_users (user_id, partner_id)
VALUES ((SELECT id FROM users WHERE username = 'test_user'), 1);

-- Insert test data into the chat_states table
INSERT INTO chat_states (state, user_id)
VALUES ('active', 'user_1');

-- Insert test data into the conversations table
INSERT INTO conversations (conversation_id, user_id, messages, bot_id)
VALUES ('conv_12345', 'user_1', '{"messages": []}', (SELECT id FROM bots LIMIT 1));

-- Insert test data into the messages table
INSERT INTO messages (id, content, from_user, to_user, type, status, direction, chat_id)
VALUES (uuid_generate_v4(), 'Hello, this is a test message', 'user_1', 'bot_1', 'text', 'sent', 'outgoing', (SELECT id FROM bots LIMIT 1));

-- Insert additional data into the bots table to ensure it has a valid partner_id reference
INSERT INTO bots (props, partner_id)
VALUES ('{"name": "Partner Bot", "version": "2.0"}', 1);


INSERT INTO bots (props) VALUES (
  jsonb_build_object(
    'chat', jsonb_build_object(
      'id', 'test-chat-123',
      'clientToken', 'test-client-token-123',
      'systemToken', 'test-system-token-123',
      'enabled', true,
      'name', 'Test Chat Bot'
    )
  )
);

-- Insert a test bot
INSERT INTO bots (props) VALUES (
  jsonb_build_object(
    'chat', jsonb_build_object(
      'id', 'test-chat-123',
      'clientToken', 'test-client-token-123',
      'systemToken', 'test-system-token-123',
      'enabled', true,
      'name', 'Test Chat Bot'
    )
  )
) RETURNING id;

-- Insert a test person
INSERT INTO people (props) VALUES (
  jsonb_build_object(
    'messagingIdentifier', '58eacbe5-123a-407c-804d-bfb930f87d50@chat.channel.morada.ai'
  )
) RETURNING id;

-- Insert a test conversation (using the IDs from above)
INSERT INTO conversations (
    conversation_id,
    user_id,
    bot_id,
    person_id
) VALUES (
    'test-conv-1',
    'test-user-1',
    '5',
    '1'
);

UPDATE conversations
SET props = jsonb_build_object(
    'chat', jsonb_build_object(
        'roomId', '52a932d8-286d-46b6-a094-6d0202578b05'
    )
);

INSERT INTO conversations (
    conversation_id,
    user_id,
    bot_id,
    person_id,
    props
) VALUES (
    'test-conv-1',
    'test-user-1',
    (SELECT id FROM bots WHERE props->'chat'->>'id' = 'test-chat-123' LIMIT 1),
    (SELECT id FROM people LIMIT 1),
    jsonb_build_object(
        'chat', jsonb_build_object(
            'roomId', '52a932d8-286d-46b6-a094-6d0202578b05'
        )
    )
);