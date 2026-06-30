package handlers

import (
	"database/sql"
	"fmt"

	"apprasal/database"
	"apprasal/models"

	"github.com/kataras/iris/v12"
)

type EmployeeStat struct {
	ID           int     `json:"id"`
	Name         string  `json:"name"`
	AverageScore float64 `json:"average_score"`
	ReviewsCount int     `json:"reviews_count"`
}

type KpiAverage struct {
	ID           int     `json:"id"`
	Sequence     int     `json:"sequence"`
	KpiName      string  `json:"kpi_name"`
	KpiDesc      string  `json:"kpi_desc"`
	AverageScore float64 `json:"average_score"`
	ReviewsCount int     `json:"reviews_count"`
	Percent      float64 `json:"percent"`
}

type EmployeeDetail struct {
	ID           int          `json:"id"`
	Name         string       `json:"name"`
	AverageScore float64      `json:"average_score"`
	ReviewsCount int          `json:"reviews_count"`
	KpiAverages  []KpiAverage `json:"kpi_averages"`
}

// GET /api/hr/dashboard
func GetHRDashboardData(ctx iris.Context) {
	// Get Period lists
	var periods []models.AppraisalPeriod
	rows, err := database.DB.Query("SELECT id, name, status, created_at FROM appraisal_periods ORDER BY id DESC")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var p models.AppraisalPeriod
			_ = rows.Scan(&p.ID, &p.Name, &p.Status, &p.CreatedAt)
			periods = append(periods, p)
		}
	}

	// Get Departments list
	var depts []models.Department
	rows2, err := database.DB.Query(`
		SELECT d.id, d.company_id, c.name, d.name 
		FROM departments d
		JOIN companies c ON d.company_id = c.id
		ORDER BY c.name ASC, d.name ASC
	`)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var d models.Department
			_ = rows2.Scan(&d.ID, &d.CompanyID, &d.CompanyName, &d.Name)
			depts = append(depts, d)
		}
	}

	// Read filters from query params
	periodID := ctx.URLParamIntDefault("period_id", 0)
	deptID := ctx.URLParamIntDefault("department_id", 0)
	employeeID := ctx.URLParamIntDefault("employee_id", 0)

	// Default to active period if none selected
	if periodID == 0 && len(periods) > 0 {
		for _, p := range periods {
			if p.Status == "active" {
				periodID = p.ID
				break
			}
		}
		// If no active period exists, default to the latest created
		if periodID == 0 {
			periodID = periods[0].ID
		}
	}

	var participationCount int
	var totalEmployees int
	var participationPercent string = "0.0"
	var overallDeptAverage string = "N/A"
	var employeeStats []EmployeeStat
	var selectedEmployee *EmployeeDetail

	if deptID > 0 && periodID > 0 {
		// 1. Get total employees in this department
		_ = database.DB.QueryRow("SELECT COUNT(*) FROM employees WHERE department_id = $1", deptID).Scan(&totalEmployees)

		// 2. Get participation count (employees who completed submissions)
		_ = database.DB.QueryRow(`
			SELECT COUNT(DISTINCT employee_id) 
			FROM appraisal_submissions 
			WHERE period_id = $1 
			  AND employee_id IN (SELECT id FROM employees WHERE department_id = $2)
		`, periodID, deptID).Scan(&participationCount)

		if totalEmployees > 0 {
			pct := (float64(participationCount) / float64(totalEmployees)) * 100.0
			participationPercent = fmt.Sprintf("%.1f", pct)
		}

		// 3. Get overall department score average (across all employees & KPIs)
		var dbDeptAvg sql.NullFloat64
		err = database.DB.QueryRow(`
			SELECT AVG(r.score) 
			FROM ratings r
			JOIN employees e ON r.employee_id = e.id
			WHERE e.department_id = $1 AND r.period_id = $2
		`, deptID, periodID).Scan(&dbDeptAvg)

		if err == nil && dbDeptAvg.Valid {
			overallDeptAverage = fmt.Sprintf("%.2f / 5.0", dbDeptAvg.Float64)
		}

		// 4. Get individual statistics for all employees in this department
		empRows, err := database.DB.Query(`
			SELECT id, name FROM employees WHERE department_id = $1 ORDER BY name ASC
		`, deptID)

		if err == nil {
			defer empRows.Close()
			for empRows.Next() {
				var stat EmployeeStat
				_ = empRows.Scan(&stat.ID, &stat.Name)

				// Calculate average score (ignores NULL scores)
				var dbAvg sql.NullFloat64
				_ = database.DB.QueryRow(`
					SELECT AVG(score) FROM ratings 
					WHERE employee_id = $1 AND period_id = $2
				`, stat.ID, periodID).Scan(&dbAvg)

				if dbAvg.Valid {
					stat.AverageScore = dbAvg.Float64
				} else {
					stat.AverageScore = 0.0
				}

				// Calculate review submissions count
				_ = database.DB.QueryRow(`
					SELECT COUNT(*) FROM ratings 
					WHERE employee_id = $1 
					  AND period_id = $2 
					  AND kpi_id = (SELECT MIN(id) FROM kpis)
				`, stat.ID, periodID).Scan(&stat.ReviewsCount)

				employeeStats = append(employeeStats, stat)
			}
		}

		// 5. Load employee detail if selected
		if employeeID > 0 {
			var empName string
			// Confirm employee exists and belongs to this department
			err = database.DB.QueryRow("SELECT name FROM employees WHERE id = $1 AND department_id = $2", employeeID, deptID).Scan(&empName)
			if err == nil {
				var detail EmployeeDetail
				detail.ID = employeeID
				detail.Name = empName

				// Get overall average
				var dbAvg sql.NullFloat64
				_ = database.DB.QueryRow(`
					SELECT AVG(score) FROM ratings 
					WHERE employee_id = $1 AND period_id = $2
				`, employeeID, periodID).Scan(&dbAvg)

				if dbAvg.Valid {
					detail.AverageScore = dbAvg.Float64
				}

				// Count total reviews
				_ = database.DB.QueryRow(`
					SELECT COUNT(*) FROM ratings 
					WHERE employee_id = $1 
					  AND period_id = $2 
					  AND kpi_id = (SELECT MIN(id) FROM kpis)
				`, employeeID, periodID).Scan(&detail.ReviewsCount)

				// Query KPI level breakdown
				kpiRows, err := database.DB.Query(`
					SELECT k.id, k.name, k.description, k.sequence, AVG(r.score), COUNT(r.score)
					FROM kpis k
					LEFT JOIN ratings r ON r.kpi_id = k.id AND r.employee_id = $1 AND r.period_id = $2
					GROUP BY k.id, k.name, k.description, k.sequence
					ORDER BY k.sequence ASC
				`, employeeID, periodID)

				if err == nil {
					defer kpiRows.Close()
					for kpiRows.Next() {
						var ka KpiAverage
						var dbKpiAvg sql.NullFloat64

						err = kpiRows.Scan(&ka.ID, &ka.KpiName, &ka.KpiDesc, &ka.Sequence, &dbKpiAvg, &ka.ReviewsCount)
						if err == nil {
							if dbKpiAvg.Valid {
								ka.AverageScore = dbKpiAvg.Float64
								ka.Percent = (ka.AverageScore / 5.0) * 100.0
							} else {
								ka.AverageScore = 0.0
								ka.Percent = 0.0
							}
							detail.KpiAverages = append(detail.KpiAverages, ka)
						}
					}
				}
				selectedEmployee = &detail
			}
		}
	}

	ctx.JSON(iris.Map{
		"periods":               periods,
		"selected_period_id":    periodID,
		"departments":           depts,
		"selected_dept_id":      deptID,
		"participation_count":   participationCount,
		"total_employees":       totalEmployees,
		"participation_percent": participationPercent,
		"overall_dept_average":  overallDeptAverage,
		"employee_stats":        employeeStats,
		"selected_employee":     selectedEmployee,
	})
}
