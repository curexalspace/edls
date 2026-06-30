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
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    sequence INTEGER NOT NULL DEFAULT 0
);

-- 9. Ratings (Completely Anonymous, no timestamp or voter link)
CREATE TABLE IF NOT EXISTS ratings (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE, -- colleague being rated
    period_id INTEGER REFERENCES appraisal_periods(id) ON DELETE CASCADE,
    kpi_id INTEGER REFERENCES kpis(id) ON DELETE CASCADE,
    score INT CHECK (score >= 1 AND score <= 5) -- NULL means N/A
);

-- Seed KPIs from the Everight appraisal sheet
INSERT INTO kpis (name, description, sequence) VALUES
('Quality of Work', 'Competence in operating machines perfectly to process clients'' samples for accurate test results/Competence in manual lab testing. Speed in performing tasks, ability to meet TAT, completion of tasks within work hours and following up with lab issues to confirm resolution', 1),
('Team work', 'Participating actively in meetings, covering for colleague''s absence, sharing of knowledge, helping others at work, knows when to ask for additional support from the team, no backbiting, gossips or fighting', 2),
('Communication', 'Easily understandable, polite & respectful in tone and choice of words, positive facial expressions, timely reporting/escalation of issues/whistleblowing & respectful of others'' opinions', 3),
('Resourcefulness & Productivity', 'Samples/results attendance rate, no spoiling of equipment/machines, no wasting of materials, consumables, etc. Ability to overcome resource constraints (e.g., limited supplies, reagent, equipment issues, staffing shortages) by using creativity to ensure continuous, efficient, and high-quality service. Not spending too much time on phone, not watching video or playing games while on duty. No issue of refund traceable to his/her behavior or negligence of duty', 4),
('Maintains Work Schedules', 'Punctuality, Availability on the duty post, Giving prior information before absence, Taking breaks & Time Off at the right time', 5),
('Ability to Work Under Pressure', 'Handling multiple tasks without becoming aggressive, adjusting to sudden changes or unexpected challenges without getting agitated or confused, Bouncing back from setbacks and Not slowing down work unnecessarily', 6),
('Health & Safety', 'Clearly conveying safety information and paying attention to safety issues, Regular washing of hands, proper use of PPE, Disposal of waste in designated bins/containers, no littering, Covering coughs/sneezes, using tissues, elbow pit or face mask, Disinfecting surfaces, equipment etc', 7),
('Dressing and Appearance', 'Complying with the company''s dress code, Clean haircut and not having hair falling on his/her faces and necks when at work, Wearing clothes that are free of stains, holes, or tears - not too revealing nor offensive, nor having inappropriate imagery', 8),
('Innovation', 'Being creative, Envisioning better ways to do things, making suggestions for improvements, Willingness to learn, receiving feedback in a positive, unbiased manner', 9),
('Attitude and Ethics', 'Being truthful, honest and trustworthy. Maintaining confidentiality, not revealing staffs, Everight''s and clients'' results/ secret information to others. Acknowledging his/her actions and their consequences, both good and bad, and being accountable for them instead of blaming others', 10)
ON CONFLICT DO NOTHING;
