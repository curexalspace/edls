-- 1. Appraisal Periods (e.g., "May 2026")
CREATE TABLE IF NOT EXISTS appraisal_periods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active' or 'closed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Companies
CREATE TABLE IF NOT EXISTS companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Departments
CREATE TABLE IF NOT EXISTS departments (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(company_id, name)
);

-- 4. Employees
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Department Unique Access Codes for a Specific Period
CREATE TABLE IF NOT EXISTS department_codes (
    id SERIAL PRIMARY KEY,
    department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
    period_id INTEGER REFERENCES appraisal_periods(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Admin and HR Users
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL, -- 'admin' or 'hr'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Submission Tracking (Zero-correlation to ratings)
CREATE TABLE IF NOT EXISTS appraisal_submissions (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    period_id INTEGER REFERENCES appraisal_periods(id) ON DELETE CASCADE,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, period_id)
);

-- 8. Key Performance Indicators (KPIs)
CREATE TABLE IF NOT EXISTS kpis (
    id SERIAL PRIMARY KEY,
    department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    sequence INTEGER NOT NULL DEFAULT 0,
    UNIQUE(department_id, name)
);

-- 9. Ratings (Completely Anonymous, no timestamp or voter link)
CREATE TABLE IF NOT EXISTS ratings (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE, -- colleague being rated
    period_id INTEGER REFERENCES appraisal_periods(id) ON DELETE CASCADE,
    kpi_id INTEGER REFERENCES kpis(id) ON DELETE CASCADE,
    score INT CHECK (score >= 1 AND score <= 5) -- NULL means N/A
);

