-- Seed data for WhatsApp SaaS Database

-- Insert subscription plans
INSERT INTO subscription_plans (id, name, description, max_sessions, max_messages_per_month, max_concurrent_instances, price_monthly, features) VALUES
(
    uuid_generate_v4(),
    'Free',
    'Basic plan for testing and small usage',
    1,
    1000,
    1,
    0.00,
    '{"support": "community", "webhooks": false, "api_access": true, "custom_branding": false}'
),
(
    uuid_generate_v4(),
    'Starter',
    'Perfect for small businesses',
    3,
    10000,
    2,
    29.99,
    '{"support": "email", "webhooks": true, "api_access": true, "custom_branding": false, "analytics": "basic"}'
),
(
    uuid_generate_v4(),
    'Professional',
    'Ideal for growing businesses',
    10,
    50000,
    5,
    99.99,
    '{"support": "priority", "webhooks": true, "api_access": true, "custom_branding": true, "analytics": "advanced", "white_label": false}'
),
(
    uuid_generate_v4(),
    'Enterprise',
    'For large organizations with custom needs',
    100,
    500000,
    20,
    299.99,
    '{"support": "dedicated", "webhooks": true, "api_access": true, "custom_branding": true, "analytics": "advanced", "white_label": true, "custom_integration": true}'
);

-- Create a demo user (password: 'demo123')
INSERT INTO users (id, email, password_hash, name, phone, is_active, email_verified) VALUES
(
    uuid_generate_v4(),
    'demo@whatsapp-saas.com',
    '$2a$12$rBKmYQk7RDGwOZqJFJdVSeOwLJKr8kCklCT8vVLgOFZePYvuNhBp.',  -- demo123
    'Demo User',
    '+1234567890',
    true,
    true
);

-- Get the demo user ID for subscription creation
DO $$
DECLARE
    demo_user_id UUID;
    free_plan_id UUID;
    subscription_id UUID;
BEGIN
    -- Get demo user ID
    SELECT id INTO demo_user_id FROM users WHERE email = 'demo@whatsapp-saas.com';
    
    -- Get free plan ID
    SELECT id INTO free_plan_id FROM subscription_plans WHERE name = 'Free';
    
    -- Create subscription for demo user
    INSERT INTO subscriptions (id, user_id, plan_id, status, expires_at)
    VALUES (
        uuid_generate_v4(),
        demo_user_id,
        free_plan_id,
        'active',
        CURRENT_TIMESTAMP + INTERVAL '1 year'
    ) RETURNING id INTO subscription_id;
    
    -- Update user with subscription
    UPDATE users SET subscription_id = subscription_id WHERE id = demo_user_id;
    
    -- Create a demo session
    INSERT INTO sessions (id, user_id, session_name, status, settings) VALUES
    (
        uuid_generate_v4(),
        demo_user_id,
        'demo-session',
        'pending',
        '{"auto_reply": false, "webhook_events": ["message", "status"]}'
    );
    
    -- Create demo API key
    INSERT INTO api_keys (id, user_id, key_name, api_key, permissions) VALUES
    (
        uuid_generate_v4(),
        demo_user_id,
        'Demo API Key',
        'demo_' || encode(gen_random_bytes(32), 'hex'),
        '{"send_message": true, "read_messages": true, "manage_sessions": true}'
    );
END $$;

-- Insert some usage statistics for demo
INSERT INTO usage_stats (user_id, date, messages_sent, messages_received, api_calls)
SELECT 
    u.id,
    CURRENT_DATE - INTERVAL '1 day' * s.i,
    floor(random() * 50)::int,
    floor(random() * 100)::int,
    floor(random() * 200)::int
FROM users u
CROSS JOIN generate_series(1, 30) s(i)
WHERE u.email = 'demo@whatsapp-saas.com';

-- Create demo webhook
INSERT INTO webhooks (id, user_id, url, events, secret, is_active)
SELECT 
    uuid_generate_v4(),
    u.id,
    'https://webhook.site/unique-id',
    ARRAY['message', 'status', 'qr'],
    'webhook_secret_' || encode(gen_random_bytes(16), 'hex'),
    true
FROM users u
WHERE u.email = 'demo@whatsapp-saas.com';