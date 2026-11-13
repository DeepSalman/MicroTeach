-- Existing accounts keep a NULL username until they choose one in a future profile flow.
SET @has_username = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'Users' AND column_name = 'username'
);
SET @add_username = IF(@has_username = 0,
  'ALTER TABLE Users ADD COLUMN username VARCHAR(30) CHARACTER SET ascii COLLATE ascii_general_ci NULL',
  'SELECT 1');
PREPARE add_username_stmt FROM @add_username;
EXECUTE add_username_stmt;
DEALLOCATE PREPARE add_username_stmt;

SET @has_username_unique = (
  SELECT COUNT(*) FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'Users'
    AND index_name = 'users_username_unique'
);
SET @add_username_unique = IF(@has_username_unique = 0,
  'ALTER TABLE Users ADD UNIQUE KEY users_username_unique (username)',
  'SELECT 1');
PREPARE add_username_unique_stmt FROM @add_username_unique;
EXECUTE add_username_unique_stmt;
DEALLOCATE PREPARE add_username_unique_stmt;
