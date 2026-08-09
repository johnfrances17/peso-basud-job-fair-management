DROP DATABASE IF EXISTS basud_db;
CREATE DATABASE basud_db;
USE basud_db;

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

CREATE TABLE members (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE member_personal_information (
  member_id INT UNSIGNED NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100) DEFAULT NULL,
  suffix VARCHAR(20) DEFAULT NULL,
  sex ENUM('M', 'F') NOT NULL,
  date_of_birth DATE DEFAULT NULL,
  place_of_birth VARCHAR(150) DEFAULT NULL,
  age INT UNSIGNED DEFAULT NULL,
  civil_status ENUM('Single', 'Married', 'Widowed', 'Separated') NOT NULL,
  nationality VARCHAR(100) DEFAULT NULL,
  religion VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (member_id),
  CONSTRAINT fk_personal_member
    FOREIGN KEY (member_id) REFERENCES members (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_personal_name (last_name, first_name)
);

CREATE TABLE member_contact_information (
  member_id INT UNSIGNED NOT NULL,
  mobile_number VARCHAR(30) DEFAULT NULL,
  email_address VARCHAR(150) DEFAULT NULL,
  facebook_profile VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (member_id),
  CONSTRAINT fk_contact_member
    FOREIGN KEY (member_id) REFERENCES members (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  INDEX idx_contact_mobile (mobile_number),
  INDEX idx_contact_email (email_address)
);

CREATE TABLE member_addresses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_id INT UNSIGNED NOT NULL,
  address_type ENUM('current', 'permanent') NOT NULL,
  same_as_current TINYINT(1) NOT NULL DEFAULT 0,
  house_no_street VARCHAR(255) DEFAULT NULL,
  barangay VARCHAR(150) DEFAULT NULL,
  municipality_city VARCHAR(150) DEFAULT NULL,
  province VARCHAR(150) DEFAULT NULL,
  zip_code VARCHAR(20) DEFAULT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_address_member
    FOREIGN KEY (member_id) REFERENCES members (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uq_member_address_type (member_id, address_type)
);

CREATE TABLE member_government_information (
  member_id INT UNSIGNED NOT NULL,
  philsys_national_id_number VARCHAR(50) DEFAULT NULL,
  sss_number VARCHAR(50) DEFAULT NULL,
  philhealth_number VARCHAR(50) DEFAULT NULL,
  pagibig_number VARCHAR(50) DEFAULT NULL,
  tin_number VARCHAR(50) DEFAULT NULL,
  passport_number VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (member_id),
  CONSTRAINT fk_government_member
    FOREIGN KEY (member_id) REFERENCES members (id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE member_employment_eligibility (
  member_id INT UNSIGNED NOT NULL,
  legally_eligible ENUM('Yes', 'No') NOT NULL,
  valid_government_id ENUM('Yes', 'No') NOT NULL,
  PRIMARY KEY (member_id),
  CONSTRAINT fk_eligibility_member
    FOREIGN KEY (member_id) REFERENCES members (id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE member_willing_to_work (
  member_id INT UNSIGNED NOT NULL,
  work_scope ENUM('Within Municipality', 'Within Province', 'Anywhere in the Philippines', 'Overseas') NOT NULL,
  PRIMARY KEY (member_id, work_scope),
  CONSTRAINT fk_willing_member
    FOREIGN KEY (member_id) REFERENCES members (id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE member_pwd_information (
  member_id INT UNSIGNED NOT NULL,
  is_person_with_disability ENUM('Yes', 'No') NOT NULL,
  disability_type VARCHAR(150) DEFAULT NULL,
  PRIMARY KEY (member_id),
  CONSTRAINT fk_pwd_member
    FOREIGN KEY (member_id) REFERENCES members (id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE member_special_categories (
  member_id INT UNSIGNED NOT NULL,
  category_code ENUM('4ps', 'indigenous_people', 'solo_parent', 'senior_citizen', 'returning_ofw') NOT NULL,
  PRIMARY KEY (member_id, category_code),
  CONSTRAINT fk_special_category_member
    FOREIGN KEY (member_id) REFERENCES members (id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE member_emergency_contacts (
  member_id INT UNSIGNED NOT NULL,
  full_name VARCHAR(150) DEFAULT NULL,
  relationship VARCHAR(100) DEFAULT NULL,
  contact_number VARCHAR(30) DEFAULT NULL,
  address VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (member_id),
  CONSTRAINT fk_emergency_member
    FOREIGN KEY (member_id) REFERENCES members (id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE member_educational_background (
  member_id INT UNSIGNED NOT NULL,
  highest_educational_attainment VARCHAR(150) DEFAULT NULL,
  school_name VARCHAR(150) DEFAULT NULL,
  course_program VARCHAR(150) DEFAULT NULL,
  year_graduated VARCHAR(20) DEFAULT NULL,
  honors_awards VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (member_id),
  CONSTRAINT fk_education_member
    FOREIGN KEY (member_id) REFERENCES members (id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE member_employment_information (
  member_id INT UNSIGNED NOT NULL,
  employment_status ENUM('Employment', 'Unemployed', 'Self-Employed', 'Student', 'Fresh Graduate') NOT NULL,
  desired_position VARCHAR(150) DEFAULT NULL,
  preferred_industry VARCHAR(150) DEFAULT NULL,
  expected_salary VARCHAR(50) DEFAULT NULL,
  years_of_experience VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (member_id),
  CONSTRAINT fk_employment_member
    FOREIGN KEY (member_id) REFERENCES members (id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE member_skills (
  member_id INT UNSIGNED NOT NULL,
  technical_skills TEXT DEFAULT NULL,
  soft_skills TEXT DEFAULT NULL,
  language_spoken VARCHAR(255) DEFAULT NULL,
  computer_skills VARCHAR(255) DEFAULT NULL,
  certifications_license VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (member_id),
  CONSTRAINT fk_skills_member
    FOREIGN KEY (member_id) REFERENCES members (id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE member_documents (
  member_id INT UNSIGNED NOT NULL,
  resume_attached TINYINT(1) NOT NULL DEFAULT 0,
  valid_id_attached TINYINT(1) NOT NULL DEFAULT 0,
  certificate_attached TINYINT(1) NOT NULL DEFAULT 0,
  other_documents_attached TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (member_id),
  CONSTRAINT fk_documents_member
    FOREIGN KEY (member_id) REFERENCES members (id)
    ON DELETE CASCADE ON UPDATE CASCADE
);
