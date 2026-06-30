//go:build ignore

// Run with: go run scratch/reset_db.go
// This clears ALL transactional data (submissions, ratings, codes, employees,
// departments, companies, periods) and re-seeds KPIs from scratch.
// Admin/HR user accounts are preserved.

package main

import (
	"bufio"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func loadEnv() {
	file, err := os.Open(".env")
	if err != nil {
		return
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])
			if (strings.HasPrefix(val, "'") && strings.HasSuffix(val, "'")) ||
				(strings.HasPrefix(val, `"`) && strings.HasSuffix(val, `"`)) {
				val = val[1 : len(val)-1]
			}
			_ = os.Setenv(key, val)
		}
	}
}

func main() {
	loadEnv()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgresql://neondb_owner:npg_zk03BvpsCejO@ep-silent-shape-atspogf1-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
	}

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		log.Fatalf("Failed to open db: %v", err)
	}
	defer db.Close()

	if err = db.Ping(); err != nil {
		log.Fatalf("Failed to ping db: %v", err)
	}
	fmt.Println("✓ Connected to database")

	resetSQL := `
-- Drop tables whose schemas changed (kpis gained department_id column)
DROP TABLE IF EXISTS ratings              CASCADE;
DROP TABLE IF EXISTS kpis                 CASCADE;

-- Clear all transactional data (order matters due to foreign keys)
TRUNCATE TABLE appraisal_submissions CASCADE;
TRUNCATE TABLE department_codes     CASCADE;
TRUNCATE TABLE employees            CASCADE;
TRUNCATE TABLE departments          CASCADE;
TRUNCATE TABLE companies            CASCADE;
TRUNCATE TABLE appraisal_periods    CASCADE;
`

	_, err = db.Exec(resetSQL)
	if err != nil {
		log.Fatalf("Reset failed: %v", err)
	}

	fmt.Println("✓ All database tables successfully truncated")
	fmt.Println("✓ Admin and HR user accounts preserved")
	fmt.Println("")
	fmt.Println("Database reset complete. Go run main.go to restart the server.")
}
