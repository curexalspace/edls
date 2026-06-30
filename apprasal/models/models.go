package models

import "time"

type Company struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

type Department struct {
	ID          int       `json:"id"`
	CompanyID   int       `json:"company_id"`
	CompanyName string    `json:"company_name,omitempty"`
	Name        string    `json:"name"`
	CreatedAt   time.Time `json:"created_at"`
}

type Employee struct {
	ID             int       `json:"id"`
	DepartmentID   int       `json:"department_id"`
	DepartmentName string    `json:"department_name,omitempty"`
	Name           string    `json:"name"`
	CreatedAt      time.Time `json:"created_at"`
}

type KPI struct {
	ID           int    `json:"id"`
	DepartmentID int    `json:"department_id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	Sequence     int    `json:"sequence"`
}

type User struct {
	ID           int       `json:"id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"-"`
	Role         string    `json:"role"` // 'admin' or 'hr'
	CreatedAt    time.Time `json:"created_at"`
}

type AppraisalPeriod struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	Status    string    `json:"status"` // 'active' or 'closed'
	CreatedAt time.Time `json:"created_at"`
}

type DepartmentCode struct {
	ID             int       `json:"id"`
	DepartmentID   int       `json:"department_id"`
	DepartmentName string    `json:"department_name,omitempty"`
	PeriodID       int       `json:"period_id"`
	PeriodName     string    `json:"period_name,omitempty"`
	Code           string    `json:"code"`
	CreatedAt      time.Time `json:"created_at"`
}

type SubmitRatingPayload struct {
	PeriodID   int                   `json:"period_id"`
	VoterID    int                   `json:"voter_id"`    // Selected name of employee who is submitting (to log participation)
	Colleagues []ColleagueSubmission `json:"colleagues"`  // Ratings for colleagues
}

type ColleagueSubmission struct {
	EmployeeID int           `json:"employee_id"` // Colleague ID being rated
	Scores     []ScoreRating `json:"scores"`      // Rating scores
}

type ScoreRating struct {
	KPIID int  `json:"kpi_id"`
	Score *int `json:"score"` // Use pointer to int to allow NULL (for N/A)
}
