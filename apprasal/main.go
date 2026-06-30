package main

import (
	"log"
	"strings"

	"apprasal/config"
	"apprasal/database"
	"apprasal/handlers"

	"github.com/kataras/iris/v12"
	"github.com/kataras/iris/v12/middleware/logger"
	"github.com/kataras/iris/v12/middleware/recover"
)

func main() {
	// 1. Load configuration from environment/defaults
	cfg := config.Load()

	// 2. Connect to database and run schema migrations
	database.Init(cfg)

	// 3. Initialize Iris application
	app := iris.New()

	// Attach logger and recovery middleware
	app.Use(recover.New())
	app.Use(logger.New())

	// 4. Setup API Routes
	api := app.Party("/api")
	{
		// Auth Routes
		api.Post("/login", handlers.ProcessLogin)
		api.Post("/logout", handlers.ProcessLogout)
		api.Get("/auth/me", handlers.GetAuthMe)

		// Public Reviewer Verification
		api.Post("/reviewer/code", handlers.VerifyCode)
		api.Post("/reviewer/login", handlers.ReviewerLogin)
		api.Post("/reviewer/logout", handlers.ReviewerLogout)

		// Protected Reviewer Flow
		reviewer := api.Party("/reviewer")
		reviewer.Use(handlers.RequireReviewerCode)
		{
			reviewer.Get("/roster", handlers.GetRoster)                                              // Code-only — for identity picker
			reviewer.Get("/data", handlers.RequireReviewerVoter, handlers.GetReviewerData)           // Voter required — for evaluation console
			reviewer.Post("/submit", handlers.RequireReviewerVoter, handlers.ProcessAppraisalSubmit) // Voter required — for submission
		}

		// Protected Admin Console
		admin := api.Party("/admin")
		admin.Use(handlers.RequireAuth("admin"))
		{
			admin.Get("/stats", handlers.GetAdminStats)
			admin.Get("/periods", handlers.GetPeriods)
			admin.Post("/period/create", handlers.CreatePeriod)
			admin.Post("/period/close", handlers.ClosePeriod)
			admin.Post("/period/activate", handlers.ActivatePeriod)

			admin.Get("/departments", handlers.GetDepartmentsData)
			admin.Post("/company/create", handlers.CreateCompany)
			admin.Post("/company/delete", handlers.DeleteCompany)
			admin.Post("/department/create", handlers.CreateDepartment)
			admin.Post("/department/delete", handlers.DeleteDepartment)

			admin.Get("/employees", handlers.GetEmployeesData)
			admin.Post("/employee/create", handlers.CreateEmployee)
			admin.Post("/employee/batch", handlers.BatchImportEmployees)
			admin.Post("/employee/delete", handlers.DeleteEmployee)

			admin.Get("/codes", handlers.GetCodesData)
			admin.Post("/code/generate", handlers.GenerateCode)
			admin.Post("/code/delete", handlers.DeleteCode)
		}

		// Protected HR Console
		hr := api.Party("/hr")
		hr.Use(handlers.RequireAuth("admin", "hr"))
		{
			hr.Get("/dashboard", handlers.GetHRDashboardData)
		}

		// Shared KPI Configuration Group (accessible to Admin & HR)
		kpis := api.Party("/kpis")
		kpis.Use(handlers.RequireAuth("admin", "hr"))
		{
			kpis.Get("/", handlers.GetKPIs)
			kpis.Post("/create", handlers.CreateKPI)
			kpis.Post("/delete", handlers.DeleteKPI)
		}
	}

	// 5. Serve Frontend Static SPA files
	// Serve static JS/CSS assets
	app.HandleDir("/assets", iris.Dir("./dist/assets"))
	app.HandleDir("/static", iris.Dir("./dist/static")) // fallback for any custom static assets
	
	// Serve SPA main files from root
	app.HandleDir("/", iris.Dir("./dist"))

	// SPA Fallback: Any unmatched route that is not API serves index.html
	app.OnErrorCode(iris.StatusNotFound, func(ctx iris.Context) {
		path := ctx.Path()
		if strings.HasPrefix(path, "/api") {
			ctx.StatusCode(iris.StatusNotFound)
			ctx.JSON(iris.Map{"error": "API route not found"})
			return
		}
		// Serve index.html for frontend routing
		_ = ctx.ServeFile("./dist/index.html")
	})

	// 6. Run Server
	addr := ":" + cfg.Port
	log.Printf("Appraisal system server starting on http://localhost%s", addr)
	if err := app.Run(iris.Addr(addr)); err != nil {
		log.Fatalf("Iris server runtime error: %v", err)
	}
}
