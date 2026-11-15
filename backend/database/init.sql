CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description VARCHAR(255),
  level INT NOT NULL
);

INSERT INTO roles (id, name, description, level) VALUES
  (1, 'Administrador', 'Control total y administración del sistema HRMS', 1),
  (2, 'Recursos Humanos', 'Gestión de personal, reclamos, solicitudes y comunicados', 2),
  (3, 'Líder de Área', 'Gestión de equipo y solicitudes departamentales', 3),
  (4, 'Empleado', 'Colaborador estándar con acceso a solicitudes y reclamos personales', 4)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  department VARCHAR(100),
  hire_date DATE,
  role_id INT NOT NULL REFERENCES roles(id),
  document_number VARCHAR(30) UNIQUE,
  file_number VARCHAR(30) UNIQUE,
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP,
  is_active BOOLEAN DEFAULT false,
  deactivation_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE TABLE claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  priority VARCHAR(50) DEFAULT 'normal',
  filed_by_id UUID NOT NULL REFERENCES users(id),
  assigned_to_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  resolution_notes TEXT
);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'system',
  user_id UUID NOT NULL REFERENCES users(id),
  sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  related_claim_id UUID REFERENCES claims(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE requests (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'indumentaria', 'licencia', 'materiales', 'herramientas', 'otro'
  title VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  resolution_notes VARCHAR(500),
  resolved_by UUID REFERENCES users(id),
  attachment_name VARCHAR(255),
  attachment_path VARCHAR(500),
  attachment_mime VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255),
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE disciplinary_actions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issued_by UUID NOT NULL REFERENCES users(id),
  type VARCHAR(50) NOT NULL CHECK (type IN ('llamado_atencion', 'apercibimiento', 'suspension', 'otro')),
  severity VARCHAR(20) NOT NULL DEFAULT 'leve' CHECK (severity IN ('leve', 'moderada', 'grave')),
  incident_date DATE NOT NULL,
  reason VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  suspension_days INTEGER DEFAULT 0 CHECK (suspension_days >= 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_shifts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_type VARCHAR(30) NOT NULL CHECK (shift_type IN ('trabajo', 'franco', 'licencia', 'feriado')),
  start_time TIME NULL,
  end_time TIME NULL,
  location VARCHAR(120),
  notes VARCHAR(300),
  assigned_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, shift_date)
);
