-- Existing installations already create this table on startup; make the
-- private data column available before deploying memory-only uploads.
CREATE TABLE IF NOT EXISTS Teacher_Application_Documents (
  document_id INT AUTO_INCREMENT PRIMARY KEY,
  application_id INT NOT NULL,
  document_type ENUM('student_id_card','nid_card') NOT NULL,
  file_path VARCHAR(512) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size INT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_data LONGTEXT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (application_id) REFERENCES Teacher_Applications(application_id) ON DELETE CASCADE
);
SET @has_file_data = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'Teacher_Application_Documents'
    AND column_name = 'file_data'
);
SET @add_file_data = IF(@has_file_data = 0,
  'ALTER TABLE Teacher_Application_Documents ADD COLUMN file_data LONGTEXT NULL',
  'SELECT 1');
PREPARE add_file_data_stmt FROM @add_file_data;
EXECUTE add_file_data_stmt;
DEALLOCATE PREPARE add_file_data_stmt;

SET @has_student_id = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'Teacher_Applications'
    AND column_name = 'student_id'
);
SET @add_student_id = IF(@has_student_id = 0,
  'ALTER TABLE Teacher_Applications ADD COLUMN student_id VARCHAR(50) NULL',
  'SELECT 1');
PREPARE add_student_id_stmt FROM @add_student_id;
EXECUTE add_student_id_stmt;
DEALLOCATE PREPARE add_student_id_stmt;
