-- Bootstrap marker only. Business migrations follow reviewed data contracts.
CREATE TABLE schema_metadata (
    id BIGINT PRIMARY KEY,
    product_name VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO schema_metadata (id, product_name) VALUES (1, '腿了个腿');
