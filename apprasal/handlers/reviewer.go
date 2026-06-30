package handlers

import (
	"database/sql"
	"log"

	"apprasal/database"
	"apprasal/models"

	"github.com/kataras/iris/v12"
)

// GET /api/reviewer/data (Retrieves all session-specific reviewer data: colleagues, KPIs, welcome checklist)
func GetReviewerData(ctx iris.Context) {
	session := Sess.Start(ctx)
	deptID := session.GetIntDefault("dept_id", 0)
	periodID := session.GetIntDefault("period_id", 0)
	voterID := session.GetIntDefault("voter_id", 0)

	log.Printf("[GetReviewerData] Query parameters - SessionID: %s, deptID: %d, periodID: %d, voterID: %d", session.ID(), deptID, periodID, voterID)

	var deptName string
	var periodName string
	_ = database.DB.QueryRow("SELECT name FROM departments WHERE id = $1", deptID).Scan(&deptName)
	_ = database.DB.QueryRow("SELECT name FROM appraisal_periods WHERE id = $1", periodID).Scan(&periodName)

	log.Printf("[GetReviewerData] DeptName: '%s', PeriodName: '%s'", deptName, periodName)

	// Fetch colleague roster (excluding the voter, to prevent self-rating)
	colleagues := make([]models.Employee, 0)
	if voterID > 0 {
		rows, err := database.DB.Query(`
			SELECT id, name 
			FROM employees 
			WHERE department_id = $1 AND id != $2
			ORDER BY name ASC
		`, deptID, voterID)

		if err != nil {
			log.Printf("[GetReviewerData] Error querying colleagues: %v", err)
		} else {
			defer rows.Close()
			for rows.Next() {
				var c models.Employee
				_ = rows.Scan(&c.ID, &c.Name)
				colleagues = append(colleagues, c)
			}
			log.Printf("[GetReviewerData] Found %d colleagues", len(colleagues))
		}
	}

	// Fetch department-scoped KPIs
	kpis := make([]models.KPI, 0)
	kpiRows, err := database.DB.Query("SELECT id, department_id, name, description, sequence FROM kpis WHERE department_id = $1 ORDER BY sequence ASC, id ASC", deptID)
	if err != nil {
		log.Printf("[GetReviewerData] Error querying KPIs: %v", err)
	} else {
		defer kpiRows.Close()
		for kpiRows.Next() {
			var k models.KPI
			_ = kpiRows.Scan(&k.ID, &k.DepartmentID, &k.Name, &k.Description, &k.Sequence)
			kpis = append(kpis, k)
		}
		log.Printf("[GetReviewerData] Found %d KPIs for department %d", len(kpis), deptID)
	}

	// Fetch all employees in this department who haven't completed their appraisal yet (for identity selection)
	pendingEmployees := make([]models.Employee, 0)
	pendingRows, err := database.DB.Query(`
		SELECT e.id, e.name 
		FROM employees e
		WHERE e.department_id = $1 
		  AND NOT EXISTS (
		      SELECT 1 FROM appraisal_submissions s 
		      WHERE s.employee_id = e.id AND s.period_id = $2
		  )
		ORDER BY e.name ASC
	`, deptID, periodID)

	if err != nil {
		log.Printf("[GetReviewerData] Error querying pending employees: %v", err)
	} else {
		defer pendingRows.Close()
		for pendingRows.Next() {
			var e models.Employee
			_ = pendingRows.Scan(&e.ID, &e.Name)
			pendingEmployees = append(pendingEmployees, e)
		}
		log.Printf("[GetReviewerData] Found %d pending employees", len(pendingEmployees))
	}

	ctx.JSON(iris.Map{
		"department_name":   deptName,
		"period_name":       periodName,
		"colleagues":        colleagues,
		"kpis":              kpis,
		"pending_employees": pendingEmployees,
		"voter_id":          voterID,
		"voter_name":        session.GetString("voter_name"),
	})
}

// GET /api/reviewer/roster — only requires department code (not voter identity).
// Returns department name, period name, and pending employees for the identity picker (Screen 2).
func GetRoster(ctx iris.Context) {
	session := Sess.Start(ctx)
	deptID := session.GetIntDefault("dept_id", 0)
	periodID := session.GetIntDefault("period_id", 0)

	var deptName, periodName string
	_ = database.DB.QueryRow("SELECT name FROM departments WHERE id = $1", deptID).Scan(&deptName)
	_ = database.DB.QueryRow("SELECT name FROM appraisal_periods WHERE id = $1", periodID).Scan(&periodName)

	pendingEmployees := make([]models.Employee, 0)
	rows, err := database.DB.Query(`
		SELECT e.id, e.name
		FROM employees e
		WHERE e.department_id = $1
		  AND NOT EXISTS (
		      SELECT 1 FROM appraisal_submissions s
		      WHERE s.employee_id = e.id AND s.period_id = $2
		  )
		ORDER BY e.name ASC
	`, deptID, periodID)

	if err != nil {
		log.Printf("[GetRoster] Query error: %v", err)
	} else {
		defer rows.Close()
		for rows.Next() {
			var e models.Employee
			_ = rows.Scan(&e.ID, &e.Name)
			pendingEmployees = append(pendingEmployees, e)
		}
		log.Printf("[GetRoster] dept=%d period=%d found %d pending employees", deptID, periodID, len(pendingEmployees))
	}

	ctx.JSON(iris.Map{
		"department_name":   deptName,
		"period_name":       periodName,
		"pending_employees": pendingEmployees,
	})
}


// POST /reviewer/submit (Process appraisal results bulk payload)
func ProcessAppraisalSubmit(ctx iris.Context) {
	session := Sess.Start(ctx)

	// Retrieve session check limits
	sessionVoterID := session.GetIntDefault("voter_id", 0)
	sessionPeriodID := session.GetIntDefault("period_id", 0)
	sessionDeptID := session.GetIntDefault("dept_id", 0)

	if sessionVoterID == 0 || sessionPeriodID == 0 {
		ctx.StopWithJSON(iris.StatusUnauthorized, iris.Map{"message": "Session expired or unauthorized"})
		return
	}

	var payload models.SubmitRatingPayload
	if err := ctx.ReadJSON(&payload); err != nil {
		ctx.StopWithJSON(iris.StatusBadRequest, iris.Map{"message": "Invalid ratings payload format"})
		return
	}

	// Double-check session matches payload values
	if payload.PeriodID != sessionPeriodID || payload.VoterID != sessionVoterID {
		ctx.StopWithJSON(iris.StatusForbidden, iris.Map{"message": "Payload identity mismatch"})
		return
	}

	// Open transaction
	tx, err := database.DB.Begin()
	if err != nil {
		ctx.StopWithJSON(iris.StatusInternalServerError, iris.Map{"message": "Database transaction failure"})
		return
	}
	defer tx.Rollback()

	// Check if already submitted (concurrency guard)
	var alreadySubmitted bool
	err = tx.QueryRow("SELECT EXISTS(SELECT 1 FROM appraisal_submissions WHERE employee_id = $1 AND period_id = $2)", sessionVoterID, sessionPeriodID).Scan(&alreadySubmitted)
	if err != nil {
		ctx.StopWithJSON(iris.StatusInternalServerError, iris.Map{"message": "Database lookup failed"})
		return
	}
	if alreadySubmitted {
		ctx.StopWithJSON(iris.StatusConflict, iris.Map{"message": "Appraisal has already been submitted for this name"})
		return
	}

	// 1. Record voter completion (prevents double voting)
	_, err = tx.Exec("INSERT INTO appraisal_submissions (employee_id, period_id) VALUES ($1, $2)", sessionVoterID, sessionPeriodID)
	if err != nil {
		ctx.StopWithJSON(iris.StatusInternalServerError, iris.Map{"message": "Failed to log participation record"})
		return
	}

	// 2. Loop and record ratings
	for _, colleagueSub := range payload.Colleagues {
		colleagueID := colleagueSub.EmployeeID

		// Security: Validate colleague is in the same department and is NOT the voter
		var colleagueDeptID int
		err = tx.QueryRow("SELECT department_id FROM employees WHERE id = $1", colleagueID).Scan(&colleagueDeptID)
		if err != nil {
			if err == sql.ErrNoRows {
				ctx.StopWithJSON(iris.StatusBadRequest, iris.Map{"message": "One or more colleagues do not exist"})
				return
			}
			ctx.StopWithJSON(iris.StatusInternalServerError, iris.Map{"message": "Database lookup failed"})
			return
		}

		if colleagueDeptID != sessionDeptID {
			ctx.StopWithJSON(iris.StatusForbidden, iris.Map{"message": "Cannot rate employees from other departments"})
			return
		}

		if colleagueID == sessionVoterID {
			ctx.StopWithJSON(iris.StatusForbidden, iris.Map{"message": "Self-evaluation is strictly prohibited"})
			return
		}

		// Save each score rating anonymously (NO link to sessionVoterID)
		for _, scoreRating := range colleagueSub.Scores {
			// Validate score values (must be 1-5 or null)
			if scoreRating.Score != nil {
				scoreVal := *scoreRating.Score
				if scoreVal < 1 || scoreVal > 5 {
					ctx.StopWithJSON(iris.StatusBadRequest, iris.Map{"message": "Rating scores must be between 1 and 5"})
					return
				}

				_, err = tx.Exec(`
					INSERT INTO ratings (employee_id, period_id, kpi_id, score) 
					VALUES ($1, $2, $3, $4)
				`, colleagueID, sessionPeriodID, scoreRating.KPIID, scoreVal)
			} else {
				// N/A choice (stored as NULL)
				_, err = tx.Exec(`
					INSERT INTO ratings (employee_id, period_id, kpi_id, score) 
					VALUES ($1, $2, $3, NULL)
				`, colleagueID, sessionPeriodID, scoreRating.KPIID)
			}

			if err != nil {
				log.Printf("Insert rating database error: %v", err)
				ctx.StopWithJSON(iris.StatusInternalServerError, iris.Map{"message": "Failed to insert rating"})
				return
			}
		}
	}

	// Commit Transaction
	if err := tx.Commit(); err != nil {
		ctx.StopWithJSON(iris.StatusInternalServerError, iris.Map{"message": "Transaction commit failed"})
		return
	}

	ctx.JSON(iris.Map{"success": true})
}


