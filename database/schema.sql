-- Roman Urdu Feedback Radar - database schema
-- Works on MySQL 8 and on XAMPP's MariaDB.
-- phpMyAdmin: open the "Import" tab, choose this file, click "Import".

CREATE DATABASE IF NOT EXISTS roman_urdu_feedback
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE roman_urdu_feedback;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(100) NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

-- One batch = one upload of customer messages (for example one CSV file)
CREATE TABLE IF NOT EXISTS batches (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NOT NULL,
  name          VARCHAR(150) NOT NULL,
  model_version VARCHAR(50)  NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_batches_user_created (user_id, created_at),
  CONSTRAINT fk_batches_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- One row per customer message with the model prediction.
-- corrected_label is filled when a human fixes the model (future training data).
CREATE TABLE IF NOT EXISTS messages (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  batch_id        INT UNSIGNED NOT NULL,
  text            TEXT NOT NULL,
  predicted_label ENUM('negative','neutral','positive') NOT NULL,
  confidence      DECIMAL(5,4) NOT NULL,
  prob_negative   DECIMAL(5,4) NOT NULL,
  prob_neutral    DECIMAL(5,4) NOT NULL,
  prob_positive   DECIMAL(5,4) NOT NULL,
  corrected_label ENUM('negative','neutral','positive') NULL,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_messages_batch_label (batch_id, predicted_label),
  KEY idx_messages_batch_conf (batch_id, confidence),
  CONSTRAINT fk_messages_batch FOREIGN KEY (batch_id) REFERENCES batches (id) ON DELETE CASCADE
) ENGINE=InnoDB;
