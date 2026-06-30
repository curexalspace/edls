package main

import (
	"database/sql"
	"fmt"
	"log"

	"apprasal/config"
	_ "github.com/jackc/pgx/v5/stdlib"
)

func main() {
	cfg := config.Load()
	db, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to open connection: %v", err)
	}
	defer db.Close()

	fmt.Println("=== COMPANIES ===")
	rows, err := db.Query("SELECT id, name FROM companies")
	if err == nil {
		for rows.Next() {
			var id int
			var name string
			_ = rows.Scan(&id, &name)
			fmt.Printf("ID: %d, Name: %s\n", id, name)
		}
		rows.Close()
	}

	fmt.Println("\n=== DEPARTMENTS ===")
	rows, err = db.Query("SELECT id, company_id, name FROM departments")
	if err == nil {
		for rows.Next() {
			var id, cid int
			var name string
			_ = rows.Scan(&id, &cid, &name)
			fmt.Printf("ID: %d, CompanyID: %d, Name: %s\n", id, cid, name)
		}
		rows.Close()
	}

	fmt.Println("\n=== ACTIVE APPRAISAL PERIODS ===")
	rows, err = db.Query("SELECT id, name, status FROM appraisal_periods")
	if err == nil {
		for rows.Next() {
			var id int
			var name, status string
			_ = rows.Scan(&id, &name, &status)
			fmt.Printf("ID: %d, Name: %s, Status: %s\n", id, name, status)
		}
		rows.Close()
	}

	fmt.Println("\n=== DEPARTMENT CODES ===")
	rows, err = db.Query("SELECT id, department_id, period_id, code FROM department_codes")
	if err == nil {
		for rows.Next() {
			var id, did, pid int
			var code string
			_ = rows.Scan(&id, &did, &pid, &code)
			fmt.Printf("ID: %d, DeptID: %d, PeriodID: %d, Code: %s\n", id, did, pid, code)
		}
		rows.Close()
	}

	fmt.Println("\n=== EMPLOYEES ===")
	rows, err = db.Query("SELECT id, department_id, name FROM employees")
	if err == nil {
		for rows.Next() {
			var id, did int
			var name string
			_ = rows.Scan(&id, &did, &name)
			fmt.Printf("ID: %d, DeptID: %d, Name: %s\n", id, did, name)
		}
		rows.Close()
	}
}
