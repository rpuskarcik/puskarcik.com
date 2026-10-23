CREATE DATABASE IF NOT EXISTS puskarcik_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE puskarcik_db;

-- 1. Users Table (Authentication)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. People Table (Genealogy / Directory Entities)
CREATE TABLE IF NOT EXISTS people (
    id VARCHAR(36) PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    bio TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Relationships Table (Connections between entities)
CREATE TABLE IF NOT EXISTS relationships (
    id INT AUTO_INCREMENT PRIMARY KEY,
    kind VARCHAR(50) NOT NULL, -- 'parent_child', 'spouse', etc.
    a_id VARCHAR(36) NOT NULL,
    b_id VARCHAR(36) NOT NULL,
    FOREIGN KEY (a_id) REFERENCES people(id) ON DELETE CASCADE,
    FOREIGN KEY (b_id) REFERENCES people(id) ON DELETE CASCADE,
    INDEX idx_kind (kind),
    INDEX idx_a_id (a_id),
    INDEX idx_b_id (b_id)
) ENGINE=InnoDB;

-- 4. Meta Table (Site configuration settings)
CREATE TABLE IF NOT EXISTS meta (
    meta_key VARCHAR(100) PRIMARY KEY,
    meta_value TEXT
) ENGINE=InnoDB;
