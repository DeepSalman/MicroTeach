-- Apply on an existing local MySQL database before starting the updated backend.
CREATE TABLE IF NOT EXISTS Escrow_Settlements (
  post_id INT PRIMARY KEY,
  outcome VARCHAR(20) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO Escrow_Settlements (post_id, outcome)
SELECT DISTINCT reference_id, 'legacy'
FROM Transactions
WHERE reference_id IS NOT NULL
  AND type IN ('refund', 'bounty_received', 'bounty_payment')
ON DUPLICATE KEY UPDATE post_id = post_id;
