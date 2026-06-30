package config

import (
	"bufio"
	"os"
	"strings"
)

type Config struct {
	DatabaseURL   string
	Port          string
	AdminUsername string
	AdminPassword string
	SessionSecret string
}

// loadDotEnv reads the local .env file on startup and sets os environment variables
func loadDotEnv() {
	file, err := os.Open(".env")
	if err != nil {
		return // Ignore if .env file is missing
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
			value := strings.TrimSpace(parts[1])
			// Strip outer quotes
			if (strings.HasPrefix(value, "'") && strings.HasSuffix(value, "'")) ||
				(strings.HasPrefix(value, "\"") && strings.HasSuffix(value, "\"")) {
				value = value[1 : len(value)-1]
			}
			_ = os.Setenv(key, value)
		}
	}
}

func Load() *Config {
	// Load variables from .env if present
	loadDotEnv()

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgresql://neondb_owner:npg_zk03BvpsCejO@ep-silent-shape-atspogf1-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	adminUser := os.Getenv("ADMIN_USERNAME")
	if adminUser == "" {
		adminUser = "admin"
	}

	adminPass := os.Getenv("ADMIN_PASSWORD")
	if adminPass == "" {
		adminPass = "admin123"
	}

	sessionSec := os.Getenv("SESSION_SECRET")
	if sessionSec == "" {
		sessionSec = "super-secret-key-change-in-production"
	}

	return &Config{
		DatabaseURL:   dbURL,
		Port:          port,
		AdminUsername: adminUser,
		AdminPassword: adminPass,
		SessionSecret: sessionSec,
	}
}
