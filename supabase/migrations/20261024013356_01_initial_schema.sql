-- Initial schema for Leave & Gate Pass Management System
-- Creates core business tables: departments, teams, users, leave_requests, out_office_requests

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('STAFF', 'TEAM_LEAD', 'MANAGER', 'ACCOUNTANT', 'DIRECTOR')),
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_days DECIMAL(4, 1) NOT NULL,
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED_BY_LEAD', 'WAITING_FOR_DOC', 'COMPLETED', 'REJECTED')),
    document_url TEXT,
    approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    CONSTRAINT chk_leave_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_leave_duration CHECK (duration_days > 0)
);

CREATE TABLE IF NOT EXISTS out_office_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    request_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    estimated_hours DECIMAL(4, 2) NOT NULL,
    reason_type VARCHAR(50) NOT NULL CHECK (reason_type IN ('WORK', 'PERSONAL')),
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED')),
    approver_id UUID REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason TEXT,
    CONSTRAINT chk_out_office_time CHECK (end_time > start_time),
    CONSTRAINT chk_out_office_hours CHECK (estimated_hours > 0)
);