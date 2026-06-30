package handlers

import (
	"database/sql"
	"log"
	"strconv"
	"time"

	"apprasal/database"
	"apprasal/models"

	"github.com/kataras/iris/v12"
	"github.com/kataras/iris/v12/sessions"
	"golang.org/x/crypto/bcrypt"
)

// formValueIntDefault reads a Form parameter and converts it to int, returning defaultValue on failure.
func formValueIntDefault(ctx iris.Context, name string, defaultValue int) int {
	valStr := ctx.FormValue(name)
	if valStr == "" {
		return defaultValue
	}
	val, err := strconv.Atoi(valStr)
	if err != nil {
		return defaultValue
	}
	return val
}

// getSessionBool retrieves a boolean value from the session, returning false if not found or invalid type.
func getSessionBool(session *sessions.Session, key string) bool {
	val := session.Get(key)
	if val == nil {
		return false
	}
	if b, ok := val.(bool); ok {
		return b
	}
	return false
}

var Sess = sessions.New(sessions.Config{
	Cookie:                      "everight_appraisal_sid",
	Expires:                     2 * time.Hour, // 2 hours session longevity
	DisableSubdomainPersistence: true,
})

// RequireAuth middleware protects Admin/HR pages
func RequireAuth(allowedRoles ...string) iris.Handler {
	return func(ctx iris.Context) {
		session := Sess.Start(ctx)
		userID := session.GetIntDefault("user_id", 0)
		role := session.GetString("role")

		log.Printf("[RequireAuth] Path: %s, Raw Cookies: %s", ctx.Path(), ctx.Request().Header.Get("Cookie"))
		log.Printf("[RequireAuth] SessionID: %s, UserID: %d, Role: %s, AllowedRoles: %v", session.ID(), userID, role, allowedRoles)

		if userID == 0 {
			log.Printf("[RequireAuth] Redirecting to /login because UserID is 0")
			ctx.Redirect("/login")
			return
		}

		// Check role authorization
		roleAllowed := false
		for _, r := range allowedRoles {
			if r == role {
				roleAllowed = true
				break
			}
		}

		if !roleAllowed {
			log.Printf("[RequireAuth] Forbidden: UserRole %s not in AllowedRoles %v", role, allowedRoles)
			ctx.StopWithStatus(iris.StatusForbidden)
			return
		}

		ctx.Next()
	}
}

// RequireReviewerCode middleware ensures a reviewer has a validated department code
func RequireReviewerCode(ctx iris.Context) {
	session := Sess.Start(ctx)
	if !getSessionBool(session, "dept_verified") {
		ctx.Redirect("/")
		return
	}
	ctx.Next()
}

// RequireReviewerVoter middleware ensures the reviewer has identified themselves
func RequireReviewerVoter(ctx iris.Context) {
	session := Sess.Start(ctx)
	if session.GetIntDefault("voter_id", 0) == 0 {
		ctx.Redirect("/")
		return
	}
	ctx.Next()
}

// Helper to populate layout fields (not used by SPA, but keep GetAuthMe instead)
func GetAuthMe(ctx iris.Context) {
	session := Sess.Start(ctx)
	userID := session.GetIntDefault("user_id", 0)
	role := session.GetString("role")
	username := session.GetString("username")

	isReviewer := getSessionBool(session, "dept_verified")
	reviewerID := session.GetIntDefault("voter_id", 0)
	reviewerName := session.GetString("voter_name")
	deptName := session.GetString("dept_name")
	deptID := session.GetIntDefault("dept_id", 0)
	periodID := session.GetIntDefault("period_id", 0)

	ctx.JSON(iris.Map{
		"authenticated": userID > 0,
		"user_id":       userID,
		"role":          role,
		"username":      username,
		"is_reviewer":   isReviewer,
		"voter_id":      reviewerID,
		"voter_name":    reviewerName,
		"dept_name":     deptName,
		"dept_id":       deptID,
		"period_id":     periodID,
	})
}

// POST /login
func ProcessLogin(ctx iris.Context) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := ctx.ReadJSON(&req); err != nil {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid request payload"})
		return
	}

	var user models.User
	err := database.DB.QueryRow("SELECT id, username, password_hash, role FROM users WHERE username = $1", req.Username).
		Scan(&user.ID, &user.Username, &user.PasswordHash, &user.Role)

	if err != nil {
		if err == sql.ErrNoRows {
			ctx.StatusCode(iris.StatusUnauthorized)
			ctx.JSON(iris.Map{"error": "Invalid username or password"})
			return
		}
		log.Printf("Login DB error: %v", err)
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Database error"})
		return
	}

	// Verify hashed password
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password))
	if err != nil {
		ctx.StatusCode(iris.StatusUnauthorized)
		ctx.JSON(iris.Map{"error": "Invalid username or password"})
		return
	}

	// Start Session
	session := Sess.Start(ctx)
	session.Set("user_id", user.ID)
	session.Set("username", user.Username)
	session.Set("role", user.Role)

	log.Printf("[ProcessLogin] Path: %s, Raw Cookies Received: %s", ctx.Path(), ctx.Request().Header.Get("Cookie"))
	log.Printf("[ProcessLogin] Login Success! UserID: %d, Username: %s, Role: %s, Assigned SessionID: %s", user.ID, user.Username, user.Role, session.ID())

	ctx.JSON(iris.Map{
		"success":  true,
		"role":     user.Role,
		"username": user.Username,
	})
}

// POST /logout
func ProcessLogout(ctx iris.Context) {
	session := Sess.Start(ctx)
	session.Clear()
	ctx.JSON(iris.Map{"success": true})
}

// POST /reviewer/code (Verify department code)
func VerifyCode(ctx iris.Context) {
	var req struct {
		Code string `json:"code"`
	}
	if err := ctx.ReadJSON(&req); err != nil {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid request payload"})
		return
	}

	var deptID int
	var deptName string
	var periodID int
	var periodStatus string

	err := database.DB.QueryRow(`
		SELECT c.department_id, d.name, c.period_id, p.status
		FROM department_codes c
		JOIN departments d ON c.department_id = d.id
		JOIN appraisal_periods p ON c.period_id = p.id
		WHERE UPPER(c.code) = UPPER($1)
	`, req.Code).Scan(&deptID, &deptName, &periodID, &periodStatus)

	if err != nil {
		if err == sql.ErrNoRows {
			ctx.StatusCode(iris.StatusUnauthorized)
			ctx.JSON(iris.Map{"error": "Invalid access code. Please double-check or ask your Admin."})
			return
		}
		log.Printf("Code verification error: %v", err)
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Database error"})
		return
	}

	if periodStatus != "active" {
		ctx.StatusCode(iris.StatusForbidden)
		ctx.JSON(iris.Map{"error": "The appraisal period for this code has been closed."})
		return
	}

	// Save code auth to session
	session := Sess.Start(ctx)
	session.Set("dept_verified", true)
	session.Set("dept_id", deptID)
	session.Set("dept_name", deptName)
	session.Set("period_id", periodID)

	ctx.JSON(iris.Map{
		"success":         true,
		"department_id":   deptID,
		"department_name": deptName,
		"period_id":       periodID,
	})
}

// POST /reviewer/login (Identify specific employee reviewer)
func ReviewerLogin(ctx iris.Context) {
	session := Sess.Start(ctx)
	if !getSessionBool(session, "dept_verified") {
		ctx.StatusCode(iris.StatusUnauthorized)
		ctx.JSON(iris.Map{"error": "Department code not verified"})
		return
	}

	var req struct {
		VoterID int `json:"voter_id"`
	}
	if err := ctx.ReadJSON(&req); err != nil {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid request payload"})
		return
	}

	deptID := session.GetIntDefault("dept_id", 0)
	periodID := session.GetIntDefault("period_id", 0)

	// Validate employee belongs to department
	var dbDeptID int
	var voterName string
	err := database.DB.QueryRow("SELECT id, department_id, name FROM employees WHERE id = $1", req.VoterID).Scan(&req.VoterID, &dbDeptID, &voterName)
	if err != nil || dbDeptID != deptID {
		ctx.StatusCode(iris.StatusForbidden)
		ctx.JSON(iris.Map{"error": "Employee does not belong to this department"})
		return
	}

	// Verify if employee already submitted their appraisal for this period
	var alreadySubmitted bool
	err = database.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM appraisal_submissions WHERE employee_id = $1 AND period_id = $2)", req.VoterID, periodID).Scan(&alreadySubmitted)
	if err != nil {
		log.Printf("Verification query error: %v", err)
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Database error"})
		return
	}

	if alreadySubmitted {
		// Log out code verification so they start over
		session.Delete("dept_verified")
		session.Delete("dept_id")
		session.Delete("dept_name")
		session.Delete("period_id")

		ctx.StatusCode(iris.StatusForbidden)
		ctx.JSON(iris.Map{"error": voterName + " has already submitted their appraisal for this period."})
		return
	}

	// Store voter session variables
	session.Set("voter_id", req.VoterID)
	session.Set("voter_name", voterName)

	ctx.JSON(iris.Map{
		"success":    true,
		"voter_id":   req.VoterID,
		"voter_name": voterName,
	})
}

// POST /reviewer/logout
func ReviewerLogout(ctx iris.Context) {
	session := Sess.Start(ctx)
	session.Delete("dept_verified")
	session.Delete("dept_id")
	session.Delete("dept_name")
	session.Delete("period_id")
	session.Delete("voter_id")
	session.Delete("voter_name")
	ctx.JSON(iris.Map{"success": true})
}
