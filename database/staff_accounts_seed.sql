USE basud_db;

DROP TABLE IF EXISTS staff_accounts;

CREATE TABLE staff_accounts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  role ENUM('staff') NOT NULL DEFAULT 'staff',
  account_status ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_accounts_email (email)
);

-- PESO admin account. Password: pesoadmin121314
-- Regenerate the hash if the password changes:
--   node -e "console.log(require('bcryptjs').hashSync('pesoadmin121314', 10))"
INSERT INTO staff_accounts (email, password_hash, display_name, role, account_status)
VALUES (
  'pesoadmin@gmail.com',
  '$2b$10$OUNgCiP39MMK/97LHxFrKeV5h94jdihDWeEV1WNyJcdl1mMGjT32e',
  'PESO Administrator',
  'staff',
  'Active'
);
