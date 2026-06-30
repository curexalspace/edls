package handlers

import (
	"apprasal/database"
	"apprasal/models"
	"log"
	"strings"

	"github.com/kataras/iris/v12"
)

// GET /api/kpis?department_id=X
func GetKPIs(ctx iris.Context) {
	deptID, err := ctx.URLParamInt("department_id")
	if err != nil || deptID == 0 {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid or missing department_id parameter"})
		return
	}

	kpis := make([]models.KPI, 0)
	rows, err := database.DB.Query(
		"SELECT id, department_id, name, description, sequence FROM kpis WHERE department_id = $1 ORDER BY sequence ASC, id ASC",
		deptID,
	)
	if err != nil {
		log.Printf("[GetKPIs] Query error: %v", err)
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Failed to fetch KPIs"})
		return
	}
	defer rows.Close()

	for rows.Next() {
		var k models.KPI
		_ = rows.Scan(&k.ID, &k.DepartmentID, &k.Name, &k.Description, &k.Sequence)
		kpis = append(kpis, k)
	}

	ctx.JSON(kpis)
}

// POST /api/kpis/create
func CreateKPI(ctx iris.Context) {
	var req struct {
		DepartmentID int    `json:"department_id"`
		Name         string `json:"name"`
		Description  string `json:"description"`
		Sequence     int    `json:"sequence"`
	}

	if err := ctx.ReadJSON(&req); err != nil {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid request payload"})
		return
	}

	name := strings.TrimSpace(req.Name)
	description := strings.TrimSpace(req.Description)

	if req.DepartmentID == 0 || name == "" || description == "" {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Missing required fields (department_id, name, description)"})
		return
	}

	// Set sequence default to 0 if not provided
	if req.Sequence <= 0 {
		req.Sequence = 1
	}

	_, err := database.DB.Exec(
		"INSERT INTO kpis (department_id, name, description, sequence) VALUES ($1, $2, $3, $4)",
		req.DepartmentID, name, description, req.Sequence,
	)
	if err != nil {
		log.Printf("[CreateKPI] Insert error: %v", err)
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "KPI already exists in this department or DB error"})
		return
	}

	ctx.JSON(iris.Map{"success": true})
}

// POST /api/kpis/delete
func DeleteKPI(ctx iris.Context) {
	var req struct {
		ID int `json:"id"`
	}

	if err := ctx.ReadJSON(&req); err != nil {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Invalid request payload"})
		return
	}

	if req.ID == 0 {
		ctx.StatusCode(iris.StatusBadRequest)
		ctx.JSON(iris.Map{"error": "Missing KPI ID"})
		return
	}

	_, err := database.DB.Exec("DELETE FROM kpis WHERE id = $1", req.ID)
	if err != nil {
		log.Printf("[DeleteKPI] Delete error: %v", err)
		ctx.StatusCode(iris.StatusInternalServerError)
		ctx.JSON(iris.Map{"error": "Failed to delete KPI"})
		return
	}

	ctx.JSON(iris.Map{"success": true})
}
