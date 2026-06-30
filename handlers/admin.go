package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"regexp"
	"strings"

	"apprasal/database"
	"apprasal/models"

	"github.com/kataras/iris/v12"
)

// Helper: Generate secure random hex string
func generateSecurePIN(length int) string {
	b := make([]byte, length)
	_, err := rand.Read(b)
	if err != nil {
		return "RAND88"
	}
	return strings.ToUpper(hex.EncodeToString(b))
}

// GET /api/admin/stats
func GetAdminStats(ctx iris.Context) {
	var totalCompanies, totalDepts, totalEmployees int
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM companies").Scan(&totalCompanies)
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM departments").Scan(&totalDepts)
	_ = database.DB.QueryRow("SELECT COUNT(*) FROM employees").Scan(&totalEmployees)

	var activePeriodName = "None"
	_ = database.DB.QueryRow("SELECT name FROM appraisal_periods WHERE status = 'active' LIMIT 1").Scan(&activePeriodName)

	ctx.JSON(iris.Map{
		"total_companies":    totalCompanies,
		"total_departments":  totalDepts,
		"total_employees":    totalEmployees,
		"active_period_name": activePeriodName,
	})
}

// GET /api/admin/periods
func GetPeriods(ctx iris.Context) {
	periods := make([]models.AppraisalPeriod, 0)
	rows, err := database.DB.Query("SELECT id, name, status, created_at FROM appraisal_periods ORDER BY id DESC")
	if err != nil {
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Failed to query periods"})
		return
	}
	defer rows.Close()
	for rows.Next() {
		var p models.AppraisalPeriod
		_ = rows.Scan(&p.ID, &p.Name, &p.Status, &p.CreatedAt)
		periods = append(periods, p)
	}

	ctx.JSON(periods)
}

// POST /api/admin/period/create
func CreatePeriod(ctx iris.Context) {
	var req struct {
		Name string `json:"name"`
	}
	if err := ctx.ReadJSON(&req); err != nil {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid request payload"})
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Period name cannot be empty"})
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Database transaction failed"})
		return
	}
	defer tx.Rollback()

	// Deactivate current active periods
	_, _ = tx.Exec("UPDATE appraisal_periods SET status = 'closed'")

	// Insert new active period
	_, err = tx.Exec("INSERT INTO appraisal_periods (name, status) VALUES ($1, 'active')", name)
	if err != nil {
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Period already exists or DB error: " + err.Error()})
		return
	}

	_ = tx.Commit()
	ctx.JSON(iris.Map{"success": true})
}

// POST /api/admin/period/close
func ClosePeriod(ctx iris.Context) {
	var req struct {
		ID int `json:"id"`
	}
	if err := ctx.ReadJSON(&req); err != nil {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid request payload"})
		return
	}

	_, err := database.DB.Exec("UPDATE appraisal_periods SET status = 'closed' WHERE id = $1", req.ID)
	if err != nil {
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Failed to close cycle: " + err.Error()})
		return
	}
	ctx.JSON(iris.Map{"success": true})
}

// POST /api/admin/period/activate
func ActivatePeriod(ctx iris.Context) {
	var req struct {
		ID int `json:"id"`
	}
	if err := ctx.ReadJSON(&req); err != nil {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid request payload"})
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Transaction failed"})
		return
	}
	defer tx.Rollback()

	_, _ = tx.Exec("UPDATE appraisal_periods SET status = 'closed'")
	_, err = tx.Exec("UPDATE appraisal_periods SET status = 'active' WHERE id = $1", req.ID)
	if err != nil {
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Failed to activate cycle: " + err.Error()})
		return
	}

	_ = tx.Commit()
	ctx.JSON(iris.Map{"success": true})
}

// GET /api/admin/departments
func GetDepartmentsData(ctx iris.Context) {
	companies := make([]models.Company, 0)
	rows, err := database.DB.Query("SELECT id, name, created_at FROM companies ORDER BY name ASC")
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var c models.Company
			_ = rows.Scan(&c.ID, &c.Name, &c.CreatedAt)
			companies = append(companies, c)
		}
	}

	depts := make([]models.Department, 0)
	rows2, err := database.DB.Query(`
		SELECT d.id, d.company_id, c.name, d.name, d.created_at 
		FROM departments d
		JOIN companies c ON d.company_id = c.id
		ORDER BY c.name ASC, d.name ASC
	`)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var d models.Department
			_ = rows2.Scan(&d.ID, &d.CompanyID, &d.CompanyName, &d.Name, &d.CreatedAt)
			depts = append(depts, d)
		}
	}

	ctx.JSON(iris.Map{
		"companies":   companies,
		"departments": depts,
	})
}

// POST /api/admin/company/create
func CreateCompany(ctx iris.Context) {
	var req struct {
		Name string `json:"name"`
	}
	if err := ctx.ReadJSON(&req); err != nil {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid request payload"})
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Company name cannot be empty"})
		return
	}

	_, err := database.DB.Exec("INSERT INTO companies (name) VALUES ($1)", name)
	if err != nil {
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Company already exists or DB error"})
		return
	}
	ctx.JSON(iris.Map{"success": true})
}

// POST /api/admin/company/delete
func DeleteCompany(ctx iris.Context) {
	var req struct {
		ID int `json:"id"`
	}
	if err := ctx.ReadJSON(&req); err != nil {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid request payload"})
		return
	}

	_, err := database.DB.Exec("DELETE FROM companies WHERE id = $1", req.ID)
	if err != nil {
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Failed to delete company: " + err.Error()})
		return
	}
	ctx.JSON(iris.Map{"success": true})
}

// POST /api/admin/department/create
func CreateDepartment(ctx iris.Context) {
	var req struct {
		CompanyID int    `json:"company_id"`
		Name      string `json:"name"`
	}
	if err := ctx.ReadJSON(&req); err != nil {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid request payload"})
		return
	}
	name := strings.TrimSpace(req.Name)

	if req.CompanyID == 0 || name == "" {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Select a company and enter department name"})
		return
	}

	tx, err := database.DB.Begin()
	if err != nil {
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Failed to start database transaction"})
		return
	}
	defer tx.Rollback()

	var deptID int
	err = tx.QueryRow("INSERT INTO departments (company_id, name) VALUES ($1, $2) RETURNING id", req.CompanyID, name).Scan(&deptID)
	if err != nil {
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Department already exists in this company"})
		return
	}

	// Seed the 10 default Everight KPIs for the new department
	defaultKPIs := []struct {
		name string
		desc string
		seq  int
	}{
		{
			"Quality of Work",
			"Competence in operating machines perfectly to process clients' samples for accurate test results/Competence in manual lab testing. Competence in the use computer to type/enter result/data correctly. Speed in performing tasks, ability to meet TAT, completion of tasks within work hours and following up with lab issues to confirm resolution.",
			1,
		},
		{
			"Team work",
			"Participating actively in meetings, covering for colleague's absence, sharing of knowledge, helping others at work, knows when to ask for additional support from the team, no backbiting, gossips or fighting.",
			2,
		},
		{
			"Communication",
			"Easily understandable, polite & respectful in tone and choice of words, positive facial expressions, timely reporting/escalation of issues/whistleblowing & respectful of others' opinions.",
			3,
		},
		{
			"Resourcefulness & Productivity",
			"Samples/results attendance rate, no spoiling of equipment/machines, no wasting of materials, consumables, etc. Ability to overcome resource constraints (e.g., limited supplies, reagent, equipment issues, staffing shortages) by using creativity to ensure continuous, efficient, and high-quality service. Not spending too much time on phone, not watching video or playing games while on duty. No issue of refund traceable his/her behavior or negligence of duty.",
			4,
		},
		{
			"Maintains Work Schedules",
			"Punctuality, Availability on the duty post, Giving prior information before absence, Taking Breaks & Time Off at the right time.",
			5,
		},
		{
			"Ability to Work Under Pressure",
			"Handling multiple tasks without becoming aggressive, adjusting to sudden changes or unexpected challenges without getting agitated or confused, Bouncing back from setbacks and Not slowing down work unnecessarily.",
			6,
		},
		{
			"Health & Safety",
			"Clearly conveying safety information and paying attention to safety issues, Regular washing of hands, proper use of PPE, Disposal of waste in designated bins/containers, no litering, Covering coughs/sneezes, using tissues, elbow pit or face mask, Disinfecting surfaces, equipment etc.",
			7,
		},
		{
			"Dressing and Appearance",
			"Complying with the company's dress code, Clean haircut and not having hair falling on his/her faces and necks when at work, Wearing clothes that are free of stains, holes, or tears - not too revealing nor offensive, nor having inappropriate imagery.",
			8,
		},
		{
			"Innovation",
			"Being creative, Envisioning better ways to do things, making suggestions for improvements, Willingness to learn, receiving feedback in a positive, unbiased manner.",
			9,
		},
		{
			"Attitude and Ethics",
			"Being truthful, honest and trustworthy. Maintaining confidentiality, not revealing staff's, Everight's and clients' results/ secret information to others. Acknowledging his/her actions and their consequences, both good and bad, and being accountable for them instead of blaming others.",
			10,
		},
	}

	for _, kpi := range defaultKPIs {
		_, err = tx.Exec(
			"INSERT INTO kpis (department_id, name, description, sequence) VALUES ($1, $2, $3, $4)",
			deptID, kpi.name, kpi.desc, kpi.seq,
		)
		if err != nil {
			ctx.StatusCode(iris.StatusInternalServerError)
			ctx.JSON(iris.Map{"error": "Failed to seed default KPIs: " + err.Error()})
			return
		}
	}

	if err = tx.Commit(); err != nil {
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Transaction commit failed"})
		return
	}

	ctx.JSON(iris.Map{"success": true})
}

// POST /api/admin/department/delete
func DeleteDepartment(ctx iris.Context) {
	var req struct {
		ID int `json:"id"`
	}
	if err := ctx.ReadJSON(&req); err != nil {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid request payload"})
		return
	}

	_, err := database.DB.Exec("DELETE FROM departments WHERE id = $1", req.ID)
	if err != nil {
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Failed to delete department: " + err.Error()})
		return
	}
	ctx.JSON(iris.Map{"success": true})
}

// GET /api/admin/employees
func GetEmployeesData(ctx iris.Context) {
	depts := make([]models.Department, 0)
	rows, err := database.DB.Query(`
		SELECT d.id, d.company_id, c.name, d.name, d.created_at 
		FROM departments d
		JOIN companies c ON d.company_id = c.id
		ORDER BY c.name ASC, d.name ASC
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var d models.Department
			_ = rows.Scan(&d.ID, &d.CompanyID, &d.CompanyName, &d.Name, &d.CreatedAt)
			depts = append(depts, d)
		}
	}

	employees := make([]models.Employee, 0)
	rows2, err := database.DB.Query(`
		SELECT e.id, e.department_id, d.name, e.name, e.created_at
		FROM employees e
		JOIN departments d ON e.department_id = d.id
		ORDER BY d.name ASC, e.name ASC
	`)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var e models.Employee
			_ = rows2.Scan(&e.ID, &e.DepartmentID, &e.DepartmentName, &e.Name, &e.CreatedAt)
			employees = append(employees, e)
		}
	}

	ctx.JSON(iris.Map{
		"departments": depts,
		"employees":   employees,
	})
}

// POST /api/admin/employee/create
func CreateEmployee(ctx iris.Context) {
	var req struct {
		DepartmentID int    `json:"department_id"`
		Name         string `json:"name"`
	}
	if err := ctx.ReadJSON(&req); err != nil {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid request payload"})
		return
	}
	name := strings.TrimSpace(req.Name)

	if req.DepartmentID == 0 || name == "" {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Select a department and enter employee name"})
		return
	}

	_, err := database.DB.Exec("INSERT INTO employees (department_id, name) VALUES ($1, $2)", req.DepartmentID, name)
	if err != nil {
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Error adding employee: " + err.Error()})
		return
	}
	ctx.JSON(iris.Map{"success": true})
}

// POST /api/admin/employee/batch
func BatchImportEmployees(ctx iris.Context) {
	var req struct {
		DepartmentID int    `json:"department_id"`
		Names        string `json:"names"`
	}
	if err := ctx.ReadJSON(&req); err != nil {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid request payload"})
		return
	}

	if req.DepartmentID == 0 || strings.TrimSpace(req.Names) == "" {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Select a department and provide names"})
		return
	}

	lines := strings.Split(req.Names, "\n")
	importedCount := 0
	ignoredCount := 0

	tx, err := database.DB.Begin()
	if err != nil {
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Transaction start failed"})
		return
	}
	defer tx.Rollback()

	for _, line := range lines {
		name := strings.TrimSpace(line)
		if name == "" {
			continue
		}

		re := regexp.MustCompile(`\s+`)
		name = re.ReplaceAllString(name, " ")

		_, err = tx.Exec("INSERT INTO employees (department_id, name) VALUES ($1, $2)", req.DepartmentID, name)
		if err != nil {
			log.Printf("Failed to batch import name '%s': %v", name, err)
			ignoredCount++
		} else {
			importedCount++
		}
	}

	_ = tx.Commit()
	ctx.JSON(iris.Map{
		"success":        true,
		"imported_count": importedCount,
		"ignored_count":  ignoredCount,
	})
}

// POST /api/admin/employee/delete
func DeleteEmployee(ctx iris.Context) {
	var req struct {
		ID int `json:"id"`
	}
	if err := ctx.ReadJSON(&req); err != nil {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid request payload"})
		return
	}

	_, err := database.DB.Exec("DELETE FROM employees WHERE id = $1", req.ID)
	if err != nil {
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Failed to delete employee: " + err.Error()})
		return
	}
	ctx.JSON(iris.Map{"success": true})
}

// GET /api/admin/codes
func GetCodesData(ctx iris.Context) {
	depts := make([]models.Department, 0)
	rows, err := database.DB.Query(`
		SELECT d.id, d.company_id, c.name, d.name, d.created_at 
		FROM departments d
		JOIN companies c ON d.company_id = c.id
		ORDER BY c.name ASC, d.name ASC
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var d models.Department
			_ = rows.Scan(&d.ID, &d.CompanyID, &d.CompanyName, &d.Name, &d.CreatedAt)
			depts = append(depts, d)
		}
	}

	periods := make([]models.AppraisalPeriod, 0)
	rows2, err := database.DB.Query("SELECT id, name, status, created_at FROM appraisal_periods ORDER BY id DESC")
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var p models.AppraisalPeriod
			_ = rows2.Scan(&p.ID, &p.Name, &p.Status, &p.CreatedAt)
			periods = append(periods, p)
		}
	}

	codes := make([]models.DepartmentCode, 0)
	rows3, err := database.DB.Query(`
		SELECT c.id, c.department_id, d.name, c.period_id, p.name, c.code, c.created_at
		FROM department_codes c
		JOIN departments d ON c.department_id = d.id
		JOIN appraisal_periods p ON c.period_id = p.id
		ORDER BY p.id DESC, d.name ASC
	`)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var c models.DepartmentCode
			_ = rows3.Scan(&c.ID, &c.DepartmentID, &c.DepartmentName, &c.PeriodID, &c.PeriodName, &c.Code, &c.CreatedAt)
			codes = append(codes, c)
		}
	}

	ctx.JSON(iris.Map{
		"departments": depts,
		"periods":     periods,
		"codes":       codes,
	})
}

// POST /api/admin/code/generate
func GenerateCode(ctx iris.Context) {
	var req struct {
		DepartmentID int `json:"department_id"`
		PeriodID     int `json:"period_id"`
	}
	if err := ctx.ReadJSON(&req); err != nil {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid request payload"})
		return
	}

	if req.DepartmentID == 0 || req.PeriodID == 0 {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Please select both department and appraisal period"})
		return
	}

	var deptName string
	var periodName string
	_ = database.DB.QueryRow("SELECT name FROM departments WHERE id = $1", req.DepartmentID).Scan(&deptName)
	_ = database.DB.QueryRow("SELECT name FROM appraisal_periods WHERE id = $1", req.PeriodID).Scan(&periodName)

	cleanDept := regexp.MustCompile(`[^a-zA-Z]`).ReplaceAllString(deptName, "")
	if len(cleanDept) > 4 {
		cleanDept = cleanDept[:4]
	}
	cleanPeriod := regexp.MustCompile(`[^a-zA-Z0-9]`).ReplaceAllString(periodName, "")

	randomSuffix := generateSecurePIN(2)
	newCode := fmt.Sprintf("%s-%s-%s", strings.ToUpper(cleanDept), strings.ToUpper(cleanPeriod), randomSuffix)

	_, err := database.DB.Exec("INSERT INTO department_codes (department_id, period_id, code) VALUES ($1, $2, $3)", req.DepartmentID, req.PeriodID, newCode)
	if err != nil {
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "A login code has already been generated for this department in this cycle."})
		return
	}

	ctx.JSON(iris.Map{
		"success": true,
		"code":    newCode,
	})
}

// POST /api/admin/code/delete
func DeleteCode(ctx iris.Context) {
	var req struct {
		ID int `json:"id"`
	}
	if err := ctx.ReadJSON(&req); err != nil {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid request payload"})
		return
	}

	_, err := database.DB.Exec("DELETE FROM department_codes WHERE id = $1", req.ID)
	if err != nil {
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Failed to delete login code: " + err.Error()})
		return
	}
	ctx.JSON(iris.Map{"success": true})
}
