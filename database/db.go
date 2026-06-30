package database

import (
	"context"
	"database/sql"
	_ "embed"
	"log"
	"time"

	"apprasal/config"

	_ "github.com/jackc/pgx/v5/stdlib"
	"golang.org/x/crypto/bcrypt"
)

//go:embed schema.sql
var schemaSQL string

var DB *sql.DB

func Init(cfg *config.Config) {
	var err error
	DB, err = sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to open database connection: %v", err)
	}

	// Configure pool parameters
	DB.SetMaxOpenConns(25)
	DB.SetMaxIdleConns(25)
	DB.SetConnMaxLifetime(5 * time.Minute)

	// Ping database to verify connection
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err = DB.PingContext(ctx); err != nil {
		log.Fatalf("Failed to ping database: %v", err)
	}

	log.Println("Database connection established successfully")

	// Run migrations
	runMigrations(cfg)
}

func runMigrations(cfg *config.Config) {
	log.Println("Running database migrations...")

	// Execute schema.sql (includes table creations and KPI seeding)
	_, err := DB.Exec(schemaSQL)
	if err != nil {
		log.Fatalf("Failed to execute database schema migrations: %v", err)
	}
	log.Println("Database schema migrations executed successfully")

	// Seed Default Admin User
	var exists bool
	err = DB.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE role = 'admin')").Scan(&exists)
	if err != nil {
		log.Fatalf("Failed to check for existing admin users: %v", err)
	}

	if !exists {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(cfg.AdminPassword), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("Failed to hash admin default password: %v", err)
		}

		_, err = DB.Exec("INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin')", cfg.AdminUsername, string(hashedPassword))
		if err != nil {
			log.Fatalf("Failed to seed default admin user: %v", err)
		}
		log.Printf("Seeded default admin user: %s", cfg.AdminUsername)
	}

	// Seed Default HR User
	err = DB.QueryRow("SELECT EXISTS(SELECT 1 FROM users WHERE role = 'hr')").Scan(&exists)
	if err != nil {
		log.Fatalf("Failed to check for existing HR users: %v", err)
	}

	if !exists {
		hrPassword := "hr123" // standard default
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(hrPassword), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("Failed to hash HR default password: %v", err)
		}

		_, err = DB.Exec("INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'hr')", "hr", string(hashedPassword))
		if err != nil {
			log.Fatalf("Failed to seed default HR user: %v", err)
		}
		log.Println("Seeded default HR user: hr (password: hr123)")
	}
}
