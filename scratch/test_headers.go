package main

import (
	"fmt"
	"log"
	"net/http"
	"net/http/cookiejar"
	"net/url"
)

func main() {
	// Create a cookie jar to simulate browser cookie handling
	jar, err := cookiejar.New(nil)
	if err != nil {
		log.Fatalf("Failed to create cookie jar: %v", err)
	}

	client := &http.Client{
		Jar: jar,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			// Don't follow redirects automatically so we can see the 302 response headers
			return http.ErrUseLastResponse
		},
	}

	// 1. GET /login
	fmt.Println("--- Sending GET /login ---")
	respGet, err := client.Get("http://localhost:8080/login")
	if err != nil {
		log.Fatalf("GET /login failed: %v", err)
	}
	defer respGet.Body.Close()

	fmt.Printf("GET Status: %s\n", respGet.Status)
	fmt.Println("GET Response Headers:")
	for name, values := range respGet.Header {
		if name == "Set-Cookie" {
			for _, value := range values {
				fmt.Printf("  %s: %s\n", name, value)
			}
		}
	}

	// 2. POST /login
	fmt.Println("\n--- Sending POST /login ---")
	formData := url.Values{}
	formData.Set("username", "admin")
	formData.Set("password", "admin123") // using the default admin password

	respPost, err := client.PostForm("http://localhost:8080/login", formData)
	if err != nil {
		log.Fatalf("POST /login failed: %v", err)
	}
	defer respPost.Body.Close()

	fmt.Printf("POST Status: %s\n", respPost.Status)
	fmt.Println("POST Response Headers:")
	for name, values := range respPost.Header {
		if name == "Set-Cookie" || name == "Location" {
			for _, value := range values {
				fmt.Printf("  %s: %s\n", name, value)
			}
		}
	}
}
